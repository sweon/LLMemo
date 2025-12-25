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

    private getPeerConfig() {
        return {
            debug: 2,
            secure: true,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        };
    }

    public async initialize(roomId: string): Promise<string> {
        this.destroy(); // Always cleanup before new session
        this.isHost = true;
        this.isInitiator = false;

        this.options.onStatusChange('connecting', 'Waiting for connection...');

        return new Promise((resolve, reject) => {
            const cleanId = cleanRoomId(roomId);
            this.peer = new Peer(cleanId, this.getPeerConfig());

            this.peer.on('open', (id) => {
                this.options.onStatusChange('ready', `Room ID: ${id}`);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err: any) => {
                console.error('Host Peer Error:', err.type);
                this.options.onStatusChange('error', `Link Error: ${err.type}`);
                reject(err);
            });
        });
    }

    public connect(targetPeerId: string) {
        this.destroy();
        this.isHost = false;
        this.isInitiator = true;

        this.options.onStatusChange('connecting', 'Initializing link...');

        this.peer = new Peer(this.getPeerConfig());

        this.peer.on('open', (id) => {
            console.log('Client identity established:', id);
            this.options.onStatusChange('connecting', `Dialing ${targetPeerId}...`);
            this._connect(cleanRoomId(targetPeerId));
        });

        this.peer.on('error', (err: any) => {
            console.error('Client Peer Error:', err.type);
            this.options.onStatusChange('error', `Setup Error: ${err.type}`);
        });
    }

    private _connect(targetPeerId: string) {
        if (!this.peer) return;
        const conn = this.peer.connect(targetPeerId, {
            reliable: true,
            serialization: 'binary' // Binary is more stable for large data on mobile
        });
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        if (this.conn) {
            this.conn.close();
        }
        this.conn = conn;

        conn.on('open', () => {
            console.log('Connection open with:', conn.peer);
            this.options.onStatusChange('connected', 'Peers Linked.');
            this.lastPong = Date.now();
            this.startHeartbeat();

            // SEQUENTIAL SYNC: Initiator (Client) sends first
            if (this.isInitiator) {
                this.options.onStatusChange('syncing', 'Uploading data...');
                setTimeout(() => this.syncData(), 1000);
            }
        });

        conn.on('data', async (data: any) => {
            if (data === 'ping') {
                this.conn?.send('pong');
                return;
            }
            if (data === 'pong') {
                this.lastPong = Date.now();
                return;
            }

            if (data && data.logs && data.models) {
                const logCount = data.logs.length;
                this.options.onStatusChange('syncing', `Merging ${logCount} logs...`);

                try {
                    await mergeBackupData(data);

                    if (this.isHost) {
                        // Host: Data merged, now send back current state to client
                        this.options.onStatusChange('syncing', 'Bilateral update in progress...');
                        setTimeout(() => this.syncData(), 500);
                    } else {
                        // Client: Sync complete
                        this.options.onStatusChange('completed', 'Sync Successful!');
                        this.options.onDataReceived();
                    }
                } catch (err: any) {
                    this.options.onStatusChange('error', `Sync Failed: ${err.message}`);
                }
            }
        });

        conn.on('close', () => {
            this.stopHeartbeat();
            if (this.conn === conn) {
                this.options.onStatusChange('disconnected', 'Link Closed');
                this.conn = null;
            }
        });

        conn.on('error', (err) => {
            console.error('Conn Error:', err);
            this.options.onStatusChange('error', 'Socket Error');
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
        } catch (err) {
            this.options.onStatusChange('error', 'Data prep failed');
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
