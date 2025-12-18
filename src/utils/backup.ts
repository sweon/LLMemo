import { db } from '../db';



// Since I didn't install file-saver, I'll implement a simple download function
const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
};

export const exportData = async (selectedLogIds?: number[], customFileName?: string) => {
    let logs = await db.logs.toArray();

    if (selectedLogIds && selectedLogIds.length > 0) {
        logs = logs.filter(l => l.id !== undefined && selectedLogIds.includes(l.id));
    }

    const models = await db.models.toArray();
    let comments = await db.comments.toArray();

    if (selectedLogIds && selectedLogIds.length > 0) {
        comments = comments.filter(c => selectedLogIds.includes(c.logId));
    }

    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        logs,
        models,
        comments
    };

    let fileName = customFileName;
    if (!fileName) {
        fileName = selectedLogIds && selectedLogIds.length > 0
            ? `llm-logs-partial-${new Date().toISOString().slice(0, 10)}.json`
            : `llm-logs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    }

    if (!fileName.toLowerCase().endsWith('.json')) {
        fileName += '.json';
    }

    downloadFile(JSON.stringify(data, null, 2), fileName, 'application/json');
};

export const importData = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);

                if (!data.logs || !data.models) {
                    throw new Error('Invalid backup file format');
                }

                await db.transaction('rw', db.logs, db.models, db.comments, async () => {
                    // Merge strategy: Add all. Dexie handles auto-increment IDs.
                    // However, if we blindly add, we duplicate.
                    // A smarter merge would preserve content but map IDs?
                    // Or just clear and replace?
                    // User said "Merge", "Existing data maintained while adding".
                    // If we allow ID conflict, Dexie will error if key exists.
                    // Since we use auto-increment keys, if we strip IDs from import, they get new IDs.
                    // But relations (LogId -> ModelId) need to be preserved.

                    // Complex Merge Logic:
                    // 1. Import Models. Match by name. If exists, use existing ID. If not, add and get new ID. Map oldModelId -> newModelId.
                    // 2. Import Logs. Strip ID. Add. Map oldLogId -> newLogId. Update modelId using map.
                    // 3. Import Comments. Strip ID. Update logId using map.

                    const modelIdMap = new Map<number, number>();

                    for (const m of data.models) {
                        const oldId = m.id;
                        delete m.id; // Let DB assign new ID

                        // Check if model with same name exists
                        const existing = await db.models.where('name').equals(m.name).first();
                        if (existing) {
                            modelIdMap.set(oldId, existing.id!);
                        } else {
                            const newId = await db.models.add(m);
                            modelIdMap.set(oldId, newId as number);
                        }
                    }

                    const logIdMap = new Map<number, number>();

                    for (const l of data.logs) {
                        const oldId = l.id;
                        delete l.id;
                        // Update modelId
                        if (l.modelId && modelIdMap.has(l.modelId)) {
                            l.modelId = modelIdMap.get(l.modelId);
                        }
                        // Add log
                        const newId = await db.logs.add(l);
                        logIdMap.set(oldId, newId as number);
                    }

                    for (const c of data.comments) {
                        delete c.id;
                        if (c.logId && logIdMap.has(c.logId)) {
                            c.logId = logIdMap.get(c.logId);
                            await db.comments.add(c);
                        }
                    }
                });

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};
