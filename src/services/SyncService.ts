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

    constructor(options: SyncServiceOptions) {
        this.options = options;
        this.handleConnection = this.handleConnection.bind(this);
    }

    public async initialize(roomId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.peer) {
                this.peer.destroy();
            }

            const cleanId = cleanRoomId(roomId);
            this.peer = new Peer(cleanId);

            this.peer.on('open', (id) => {
                this.options.onStatusChange('ready', `Room: ${id}`);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                this.options.onStatusChange('error', `Error: ${err.type}`);
                reject(err);
            });
        });
    }

    public connect(targetPeerId: string) {
        this.options.onStatusChange('connecting', 'Initializing...');

        if (!this.peer || this.peer.destroyed) {
            this.peer = new Peer();
            this.peer.on('open', () => {
                this._connect(cleanRoomId(targetPeerId));
            });
            this.peer.on('error', (err) => {
                this.options.onStatusChange('error', `Error: ${err.type}`);
            });
        } else {
            this._connect(cleanRoomId(targetPeerId));
        }
    }

    private _connect(targetPeerId: string) {
        this.options.onStatusChange('connecting', `Dialing ${targetPeerId}...`);
        if (!this.peer) return;

        const conn = this.peer.connect(targetPeerId, {
            reliable: true
        });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        if (this.conn) {
            this.conn.close();
        }
        this.conn = conn;

        conn.on('open', () => {
            this.options.onStatusChange('connected', 'Connected!');

            // Automatic bidirectional sync after a small delay
            setTimeout(() => {
                this.syncData();
            }, 1000);
        });

        conn.on('data', async (data: any) => {
            // Simple ping-pong or data
            if (data === 'ping') {
                this.conn?.send('pong');
                return;
            }

            if (data && data.logs && data.models) {
                this.options.onStatusChange('syncing', 'Merging data...');
                try {
                    await mergeBackupData(data);
                    this.options.onStatusChange('completed', 'Sync Completed!');
                    this.options.onDataReceived();
                } catch (err: any) {
                    this.options.onStatusChange('error', `Sync Failed: ${err.message}`);
                }
            }
        });

        conn.on('close', () => {
            this.stopHeartbeat();
            this.options.onStatusChange('disconnected', 'Disconnected');
            this.conn = null;
        });

        conn.on('error', () => {
            this.options.onStatusChange('error', 'Connection Error');
            this.stopHeartbeat();
        });

        this.startHeartbeat();
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
                this.conn.send('ping');
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
            this.options.onStatusChange('error', 'Sync Failed');
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
