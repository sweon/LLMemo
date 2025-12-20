import Peer, { type DataConnection } from 'peerjs';
import { getBackupData, mergeBackupData } from '../utils/backup';

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'completed' | 'error' | 'ready';

export interface SyncServiceOptions {
    onStatusChange: (status: SyncStatus, message?: string) => void;
    onDataReceived: () => void;
}

export const cleanRoomId = (roomId: string): string => {
    return roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
};

export class SyncService {
    private peer: Peer | null = null;
    private conn: DataConnection | null = null;
    private options: SyncServiceOptions;
    private heartbeatInterval: any = null;
    private lastPong: number = 0;
    private isHost: boolean = false;

    constructor(options: SyncServiceOptions) {
        this.options = options;
        // Bind methods to avoid context loss
        this.handleConnection = this.handleConnection.bind(this);
    }

    public async initialize(roomId: string): Promise<string> {
        this.isHost = true;
        return new Promise((resolve, reject) => {
            if (this.peer) {
                this.peer.destroy();
            }

            // Clean the ID to be safe for PeerJS
            const cleanId = cleanRoomId(roomId);

            // Highly optimized PeerJS config for stability
            this.peer = new Peer(cleanId, {
                debug: 0, // Disable debug logs
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ],
                    'sdpSemantics': 'unified-plan'
                }
            });

            this.peer.on('open', (id) => {
                this.options.onStatusChange('ready', `Host Mode: ${id}`);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer Error:', err);
                this.options.onStatusChange('error', `Peer Error: ${err.message}`);
                reject(err);
            });

            this.peer.on('disconnected', () => {
                console.log('Peer disconnected from server, attempting reconnect...');
                this.peer?.reconnect();
            });
        });
    }

    public connect(targetPeerId: string) {
        this.isHost = false;
        if (!this.peer) {
            // If connecting as client without hosting, we need a random ID
            this.peer = new Peer({
                debug: 0,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            this.peer.on('open', () => {
                this._connect(cleanRoomId(targetPeerId));
            });
            this.peer.on('error', (err) => {
                this.options.onStatusChange('error', `Peer Error: ${err.message}`);
            });
        } else {
            this._connect(cleanRoomId(targetPeerId));
        }
    }

    private _connect(targetPeerId: string) {
        this.options.onStatusChange('connecting', `Connecting to ${targetPeerId}...`);
        if (!this.peer) return;

        const conn = this.peer.connect(targetPeerId, {
            reliable: true
        });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        // If we already have a connection, close it before accepting new one
        if (this.conn && this.conn.open) {
            this.conn.close();
        }

        this.conn = conn;

        conn.on('open', async () => {
            console.log('Connection established with:', conn.peer);
            this.options.onStatusChange('connected', 'Peer Connected!');

            this.lastPong = Date.now();
            this.startHeartbeat();

            // Host side needs to wait longer for the data channel to be fully ready
            // especially on mobile/Android.
            const delay = this.isHost ? 3000 : 800;

            setTimeout(async () => {
                if (this.conn && this.conn.open) {
                    await this.syncData();
                }
            }, delay);
        });

        conn.on('data', async (data: any) => {
            // Handle Heartbeat
            if (data && data.type === 'ping') {
                this.conn?.send({ type: 'pong' });
                return;
            }
            if (data && data.type === 'pong') {
                this.lastPong = Date.now();
                return;
            }

            // Actual data received
            if (data && data.logs && data.models) {
                const logCount = data.logs.length;
                this.options.onStatusChange('syncing', `Receiving ${logCount} logs and ${data.models.length} models...`);

                try {
                    await mergeBackupData(data);
                    this.options.onStatusChange('completed', `Sync Completed! Merged ${logCount} logs.`);

                    // Signal data received - the UI will handle the reload with delay
                    setTimeout(() => {
                        this.options.onDataReceived();
                    }, 1000);
                } catch (err: any) {
                    this.options.onStatusChange('error', `Merge Failed: ${err.message}`);
                }
            }
        });

        conn.on('close', () => {
            this.stopHeartbeat();
            if (this.conn) {
                this.options.onStatusChange('disconnected', 'Connection Closed');
                this.conn = null;
            }
        });

        conn.on('error', (err) => {
            console.error('Connection Error:', err);
            this.stopHeartbeat();
            this.options.onStatusChange('error', `Connection Error: ${err.message}`);
        });
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
                // Check if last pong was too long ago
                if (Date.now() - this.lastPong > 15000) {
                    console.warn('Heartbeat timeout, closing connection');
                    this.conn.close();
                    this.stopHeartbeat();
                    return;
                }
                this.conn.send({ type: 'ping' });
            } else {
                this.stopHeartbeat();
            }
        }, 3000); // More frequent heartbeat (3s) for mobile stability
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    public async syncData() {
        if (!this.conn || !this.conn.open) {
            console.warn('Sync attempt failed: connection not open');
            return;
        }

        try {
            this.options.onStatusChange('syncing', 'Gathering data to send...');
            const data = await getBackupData();

            if (this.conn && this.conn.open) {
                const logCount = data.logs.length;
                this.options.onStatusChange('syncing', `Sending ${logCount} logs to peer...`);
                this.conn.send(data);
            }
        } catch (err: any) {
            console.error('Send Error:', err);
            this.options.onStatusChange('error', `Send Failed: ${err.message}`);
        }
    }

    public destroy() {
        this.stopHeartbeat();
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
