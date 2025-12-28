import { getBackupData, mergeBackupData } from '../utils/backup';
import { encryptData, decryptData } from '../utils/crypto';
import { db } from '../db';

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'completed' | 'error' | 'ready';

export interface SyncServiceOptions {
    onStatusChange: (status: SyncStatus, message?: string) => void;
    onDataReceived: () => void;
    initialDataLogId?: number; // If set, only this log is synced initially
}

export const cleanRoomId = (roomId: string): string => {
    return roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
};

const RELAY_BASE = 'https://ntfy.sh';
const WS_BASE = 'wss://ntfy.sh';

export class SyncService {
    private options: SyncServiceOptions;
    private ws: WebSocket | null = null;
    private roomId: string | null = null;
    private isHost: boolean = false;
    private lastMessageId: string | null = null;
    private isSyncing: boolean = false;
    private instanceId: string = Math.random().toString(36).substring(2, 10);

    constructor(options: SyncServiceOptions) {
        this.options = options;
    }

    public async initialize(roomId: string): Promise<string> {
        this.isHost = true;
        this.roomId = cleanRoomId(roomId);

        this.options.onStatusChange('connecting', 'Connecting to relay...');
        await this.connectRelay();

        this.options.onStatusChange('ready', `Room ID: ${this.roomId}`);
        return this.roomId;
    }

    public async connect(targetRoomId: string) {
        this.isHost = false;
        this.roomId = cleanRoomId(targetRoomId);

        this.options.onStatusChange('connecting', 'Connecting to relay...');
        await this.connectRelay();

        this.options.onStatusChange('syncing', 'Requesting data...');
        // Notify host that we are ready
        await this.sendRelayMessage({ type: 'join' });
    }

    private async connectRelay() {
        if (this.ws) {
            this.ws.close();
        }

        return new Promise<void>((resolve, reject) => {
            const url = `${WS_BASE}/${this.roomId}/ws`;
            const timeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    this.ws.close();
                    reject(new Error('Relay connection timeout'));
                }
            }, 10000);

            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                clearTimeout(timeout);
                console.log('Relay connected');
                resolve();
            };

            this.ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.event === 'message') {
                        if (msg.id === this.lastMessageId) return;
                        this.lastMessageId = msg.id;

                        await this.handleRelayMessage(msg);
                    }
                } catch (e) {
                }
            };

            this.ws.onerror = (err) => {
                clearTimeout(timeout);
                console.error('Relay error:', err);
                this.options.onStatusChange('error', 'Relay connection failed');
                reject(err);
            };

            this.ws.onclose = () => {
                clearTimeout(timeout);
                console.log('Relay disconnected');
                if (this.roomId) {
                    this.options.onStatusChange('disconnected', 'Relay disconnected');
                }
            };
        });
    }

    private async handleRelayMessage(msg: any) {
        if (msg.attachment) {
            // Check if this is an attachment we sent ourselves
            if (msg.tags && msg.tags.includes(`inst_${this.instanceId}`)) {
                console.log('Ignoring own attachment');
                return;
            }
            console.log('Received attachment:', msg.attachment.url);
            this.options.onStatusChange('syncing', 'Downloading data...');
            await this.downloadAndProcessAttachment(msg.attachment.url);
            return;
        }

        let payload: any;
        try {
            payload = JSON.parse(msg.message || msg);
        } catch (e) {
            return; // Not a message for us
        }

        console.log('Received relay message:', payload.type);

        switch (payload.type) {
            case 'join':
                if (this.isHost) {
                    console.log('Client joined, sending data...');
                    this.options.onStatusChange('connected', 'Client joined!');
                    // Small delay to ensure client is ready to receive
                    setTimeout(() => this.syncData(), 1000);
                }
                break;
            case 'sync_data':
                if (!this.isHost && payload.data) {
                    this.options.onStatusChange('syncing', 'Decrypting data...');
                    await this.processReceivedEncodedData(payload.data);
                }
                break;
            case 'ping':
                break;
        }
    }

    public async syncData() {
        if (!this.roomId || this.isSyncing) return;

        try {
            this.isSyncing = true;
            this.options.onStatusChange('syncing', 'Preparing data...');

            let targetLogIds: number[] | undefined;

            if (this.options.initialDataLogId) {
                const log = await db.logs.get(this.options.initialDataLogId);
                if (log && log.threadId) {
                    const threadLogs = await db.logs.where('threadId').equals(log.threadId).sortBy('threadOrder');
                    // Check if current log is the first one (Head)
                    if (threadLogs.length > 0 && threadLogs[0].id === log.id) {
                        // Is Head -> Share ALL
                        targetLogIds = threadLogs.map(l => l.id!);
                    } else {
                        // Is Body or otherwise -> Share SINGLE
                        targetLogIds = [this.options.initialDataLogId];
                    }
                } else {
                    targetLogIds = [this.options.initialDataLogId];
                }
            }

            // Allow syncing only specific log if requested
            const data = await getBackupData(targetLogIds);
            const jsonStr = JSON.stringify(data);

            this.options.onStatusChange('syncing', 'Encrypting...');
            const encrypted = await encryptData(jsonStr, this.roomId);

            if (encrypted.length > 2000) {
                this.options.onStatusChange('syncing', 'Uploading attachment...');
                await this.sendRelayAttachment(encrypted);
            } else {
                this.options.onStatusChange('syncing', 'Sending message...');
                await this.sendRelayMessage({
                    type: 'sync_data',
                    data: encrypted
                });
            }
            console.log('Data sent to relay');
            if (this.options.initialDataLogId) {
                this.options.onStatusChange('completed', 'Data sent successfully!');
            } else {
                this.options.onStatusChange('connected', 'Data sent!');
            }
        } catch (err: any) {
            console.error('Sync failed:', err);
            this.options.onStatusChange('error', `Sync failed: ${err.message}`);
        } finally {
            this.isSyncing = false;
        }
    }

    private async sendRelayAttachment(encryptedData: string) {
        if (!this.roomId) return;
        const tags = [this.isHost ? 'host' : 'client', `inst_${this.instanceId}`];

        await fetch(`${RELAY_BASE}/${this.roomId}`, {
            method: 'PUT',
            body: encryptedData,
            headers: {
                'Filename': 'sync.enc',
                'Title': 'LLMemo Sync Data',
                'Tags': tags.join(',')
            }
        });
    }

    private async sendRelayMessage(payload: any) {
        if (!this.roomId) return;

        try {
            const tags = [this.isHost ? 'host' : 'client', `inst_${this.instanceId}`];
            payload.sender = this.isHost ? 'host' : 'client';
            payload.instanceId = this.instanceId;

            await fetch(`${RELAY_BASE}/${this.roomId}`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Tags': tags.join(',')
                }
            });
        } catch (e) {
            console.error('Failed to send relay message:', e);
            throw e;
        }
    }

    private async downloadAndProcessAttachment(url: string) {
        try {
            const response = await fetch(url);
            const encodedData = await response.text();
            await this.processReceivedEncodedData(encodedData);
        } catch (e: any) {
            console.error('Download error:', e);
            this.options.onStatusChange('error', `Download failed: ${e.message}`);
        }
    }

    private async processReceivedEncodedData(encodedData: string) {
        try {
            const decrypted = await decryptData(encodedData, this.roomId!);
            const data = JSON.parse(decrypted);

            // If we are in single-log sharing mode (Sender), we usually don't want to merge the Receiver's full backup.
            if (this.options.initialDataLogId && this.isHost) {
                console.log("In single log share mode, skipping merge of incoming data.");
                this.options.onStatusChange('completed', 'Log shared successfully!');
                return;
            }

            this.options.onStatusChange('syncing', 'Merging data...');
            await mergeBackupData(data);

            if (this.isHost) {
                // Host received data (bidirectional sync return)
                this.options.onStatusChange('completed', 'Sync Completed!');
                this.options.onDataReceived();
            } else {
                // Client received data
                this.options.onStatusChange('syncing', 'Synchronizing back...');
                await this.syncData();

                this.options.onStatusChange('completed', 'Sync Completed!');
                this.options.onDataReceived();
            }
        } catch (e: any) {
            console.error('Process error:', e);
            this.options.onStatusChange('error', `Decrypt/Merge failed: ${e.message}`);
        }
    }

    public destroy() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.roomId = null;
    }
}
