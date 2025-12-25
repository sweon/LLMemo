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

    constructor(options: SyncServiceOptions) {
        this.options = options;
        this.handleConnection = this.handleConnection.bind(this);
    }

    public async initialize(roomId: string): Promise<string> {
        this.destroy(); // Start fresh

        this.options.onStatusChange('connecting', 'Connecting...');

        return new Promise((resolve, reject) => {
            const cleanId = cleanRoomId(roomId);
            this.peer = new Peer(cleanId, {
                debug: 2,
                secure: true,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.options.onStatusChange('ready', `Room: ${id}`);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err: any) => {
                console.error('Peer error:', err);
                this.options.onStatusChange('error', `Peer Error: ${err.type || err.message}`);
                reject(err);
            });

            this.peer.on('disconnected', () => {
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });
        });
    }

    public connect(targetPeerId: string) {
        this.destroy(); // Start fresh

        this.options.onStatusChange('connecting', 'Initializing...');

        this.peer = new Peer({
            debug: 2,
            secure: true,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        this.peer.on('open', () => {
            this.options.onStatusChange('connecting', `Dialing ${targetPeerId}...`);
            const conn = this.peer!.connect(cleanRoomId(targetPeerId), {
                reliable: true
            });
            this.handleConnection(conn);
        });

        this.peer.on('error', (err: any) => {
            console.error('Peer error:', err);
            this.options.onStatusChange('error', `Peer Error: ${err.type || err.message}`);
        });
    }

    private handleConnection(conn: DataConnection) {
        if (this.conn) {
            this.conn.close();
        }
        this.conn = conn;

        conn.on('open', () => {
            console.log('Connection established with:', conn.peer);
            this.options.onStatusChange('connected', 'Connected!');

            this.lastPong = Date.now();
            this.startHeartbeat();

            // Automatic data exchange on connection
            // Adding a small delay to ensure the data channel is fully ready for transfer
            setTimeout(() => {
                if (this.conn && this.conn.open) {
                    this.syncData();
                }
            }, 500);
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

            if (data && data.logs && data.models) {
                this.options.onStatusChange('syncing', `Merging data...`);
                try {
                    await mergeBackupData(data);
                    this.options.onStatusChange('completed', 'Sync Successful!');
                    this.options.onDataReceived();
                } catch (err: any) {
                    this.options.onStatusChange('error', `Sync Failed: ${err.message}`);
                }
            }
        });

        conn.on('close', () => {
            console.log('Connection closed');
            this.stopHeartbeat();
            if (this.conn === conn) {
                this.options.onStatusChange('disconnected', 'Disconnected');
                this.conn = null;
            }
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.options.onStatusChange('error', 'Connection Error');
        });
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
                if (Date.now() - this.lastPong > 30000) {
                    this.conn.close();
                    return;
                }
                this.conn.send({ type: 'ping' });
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
                this.conn.send(data);
            }
        } catch (err: any) {
            this.options.onStatusChange('error', 'Sync Preparation Failed');
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
