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
    private isInitiator: boolean = false;

    constructor(options: SyncServiceOptions) {
        this.options = options;
        this.handleConnection = this.handleConnection.bind(this);
    }

    private isInitializing: boolean = false;

    public async initialize(roomId: string): Promise<string> {
        if (this.isInitializing) return "";
        this.isInitializing = true;

        this.isHost = true;
        this.isInitiator = false;
        this.options.onStatusChange('connecting', 'Linking to global sync network...');

        if (this.peer) {
            this.peer.destroy();
            await new Promise(r => setTimeout(r, 1000));
        }

        return new Promise(async (resolve, reject) => {
            const cleanId = cleanRoomId(roomId);

            this.peer = new Peer(cleanId, {
                debug: 2,
                secure: true,
                pingInterval: 5000,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Host registered with ID:', id);
                this.options.onStatusChange('ready', `Host Active: ${id}`);
                this.isInitializing = false;
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                console.log('Incoming connection from:', conn.peer);
                this.handleConnection(conn);
            });

            this.peer.on('error', (err: any) => {
                // If ID is taken, this IS fatal
                if (err.type === 'unavailable-id') {
                    this.isInitializing = false;
                    this.options.onStatusChange('error', 'Room ID already in use.');
                    reject(err);
                    return;
                }

                // For other errors, if P2P is active, ignore
                if (this.conn?.open) {
                    console.warn('Signaling error (P2P active):', err.type);
                    return;
                }

                console.error('Host Peer Error:', err.type, err);
                // Don't show error immediately for network hiccups unless it's a critical incompatibility
                if (err.type === 'network' || err.type === 'disconnected' || err.type === 'socket-error') {
                    console.log('Signaling server link issue, waiting for auto-recovery...');
                    return;
                }

                this.isInitializing = false;
                this.options.onStatusChange('error', `Status: ${err.type}`);
                reject(err);
            });

            this.peer.on('disconnected', () => {
                console.log('Host disconnected from signaling server, reconnecting...');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });
        });
    }

    public async connect(targetPeerId: string) {
        if (this.isInitializing) return;

        const cleanTargetId = cleanRoomId(targetPeerId);

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
            await new Promise(r => setTimeout(r, 1000));
        }

        this.isHost = false;
        this.isInitiator = true;

        if (!this.peer) {
            this.isInitializing = true;
            this.options.onStatusChange('connecting', 'Initializing client...');
            this.peer = new Peer({
                debug: 2,
                secure: true,
                pingInterval: 5000,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Client identity:', id);
                this.isInitializing = false;
                this._connect(cleanTargetId);
            });

            this.peer.on('error', (err: any) => {
                if (this.conn?.open) return;
                this.isInitializing = false;
                this.options.onStatusChange('error', `Link failed: ${err.type}`);
            });
        } else {
            this._connect(cleanTargetId);
        }
    }

    private _connect(targetPeerId: string) {
        this.options.onStatusChange('connecting', `Dialing ${targetPeerId}...`);
        if (!this.peer) return;

        const conn = this.peer.connect(targetPeerId, { reliable: true });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        // Prevent duplicate connection handling for the same peer
        if (this.conn && this.conn.peer === conn.peer && this.conn.open) {
            console.log('Ignoring redundant connection from:', conn.peer);
            return;
        }

        if (this.conn) {
            this.conn.close();
        }

        this.conn = conn;

        conn.on('open', async () => {
            console.log('Data channel open with:', conn.peer);
            this.options.onStatusChange('connected', 'Peers linked.');

            this.lastPong = Date.now();
            this.startHeartbeat();

            // Sequential Sync: Initiator (Client) sends first
            if (this.isInitiator) {
                console.log('Initiating data transfer...');
                setTimeout(() => this.syncData(), 1000);
            }
        });

        conn.on('data', async (data: any) => {
            if (data?.type === 'ping') {
                this.conn?.send({ type: 'pong' });
                return;
            }
            if (data?.type === 'pong') {
                this.lastPong = Date.now();
                return;
            }

            // Sync Payload
            if (data && data.logs && data.models) {
                const logCount = data.logs.length;
                this.options.onStatusChange('syncing', `Merging ${logCount} logs...`);

                try {
                    await mergeBackupData(data);
                    console.log('Merge complete.');

                    // Host: Now send our data back to client to complete bilateral sync
                    if (this.isHost) {
                        this.options.onStatusChange('syncing', 'Updating client with merged data...');
                        setTimeout(() => this.syncData(), 500);
                    } else {
                        // Client: We are done
                        this.options.onStatusChange('completed', 'Sync finalized.');
                        this.options.onDataReceived();
                    }
                } catch (err: any) {
                    this.options.onStatusChange('error', `Sync failed: ${err.message}`);
                }
            }
        });

        conn.on('close', () => {
            console.log('Connection closed.');
            this.stopHeartbeat();
            if (this.conn === conn) {
                this.options.onStatusChange('disconnected', 'Disconnected');
                this.conn = null;
            }
        });

        conn.on('error', (err) => {
            console.error('Socket error:', err);
            this.options.onStatusChange('error', 'Socket error occurred.');
        });
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
                if (Date.now() - this.lastPong > 20000) {
                    console.warn('Heartbeat timeout.');
                    this.conn.close();
                    return;
                }
                this.conn.send({ type: 'ping' });
            } else {
                this.stopHeartbeat();
            }
        }, 5000);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    public async syncData() {
        if (!this.conn || !this.conn.open) return;

        try {
            const data = await getBackupData();
            if (this.conn && this.conn.open) {
                console.log('Sending payload, size:', data.logs.length);
                this.conn.send(data);
            }
        } catch (err: any) {
            this.options.onStatusChange('error', 'Data preparation failed.');
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
