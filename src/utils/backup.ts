import { db } from '../db';



// Since I didn't install file-saver, I'll implement a simple download function
const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
};


export const getBackupData = async (logIds?: number[]) => {
    let logs = await db.logs.toArray();
    const models = await db.models.toArray();
    let comments = await db.comments.toArray();

    if (logIds && logIds.length > 0) {
        logs = logs.filter(l => l.id !== undefined && logIds.includes(l.id));
        comments = comments.filter(c => logIds.includes(c.logId));
        // Keep all models to ensure references work, they are small anyway
    }

    return {
        version: 1,
        timestamp: new Date().toISOString(),
        logs,
        models,
        comments
    };
};

export const exportData = async (selectedLogIds?: number[], customFileName?: string) => {
    let data = await getBackupData(selectedLogIds);

    let fileName = customFileName;
    if (!fileName) {
        fileName = selectedLogIds && selectedLogIds.length > 0
            ? `llmemo-partial-${new Date().toISOString().slice(0, 10)}.json`
            : `llmemo-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
                await mergeBackupData(data);
                resolve();
            } catch (err) {
                reject(err);
            }
        };

        reader.readAsText(file);
    });
};

export const mergeBackupData = async (data: any) => {
    if (!data.logs || !data.models) {
        throw new Error('Invalid backup file format');
    }

    await db.transaction('rw', db.logs, db.models, db.comments, async () => {
        const modelIdMap = new Map<number, number>();

        for (const m of data.models) {
            const oldId = m.id;
            const existing = await db.models.where('name').equals(m.name).first();

            if (existing) {
                modelIdMap.set(oldId, existing.id!);
            } else {
                // Ensure we don't try to add with an ID if it's auto-increment, though we should strip it
                // Actually, let's just strip ID to be safe and let Dexie assign
                const { id, ...modelData } = m;
                const newId = await db.models.add(modelData);
                modelIdMap.set(oldId, newId as number);
            }
        }

        const logIdMap = new Map<number, number>();

        for (const l of data.logs) {
            const oldId = l.id; // Store old ID for mapping comments

            // Check if log already exists (by some criteria? or just always add?)
            // Requirement says "Merge".
            // Let's check if a log with same Title and CreatedAt exists? 
            // This prevents duplicate imports of the same backup.
            let existingLog = null;
            /* 
               Dexie doesn't support multi-key unique constraint easily on object store creation unless specified.
               We will check manually.
           */
            // Hydrate dates first for comparison
            const createdAt = typeof l.createdAt === 'string' ? new Date(l.createdAt) : l.createdAt;

            // Try to find exact match
            const potentialMatches = await db.logs.where('title').equals(l.title).toArray();
            existingLog = potentialMatches.find(pl => Math.abs(pl.createdAt.getTime() - createdAt.getTime()) < 1000); // 1s tolerance

            if (existingLog) {
                logIdMap.set(oldId, existingLog.id!);
            } else {
                const { id, ...logData } = l;
                logData.createdAt = createdAt;
                logData.updatedAt = typeof l.updatedAt === 'string' ? new Date(l.updatedAt) : l.updatedAt;

                if (logData.modelId !== undefined) {
                    if (modelIdMap.has(logData.modelId)) {
                        logData.modelId = modelIdMap.get(logData.modelId);
                    } else {
                        logData.modelId = undefined;
                    }
                }
                const newId = await db.logs.add(logData);
                logIdMap.set(oldId, newId as number);
            }
        }

        if (data.comments) {
            for (const c of data.comments) {
                const { id, ...commentData } = c;
                commentData.createdAt = typeof c.createdAt === 'string' ? new Date(c.createdAt) : c.createdAt;
                commentData.updatedAt = typeof c.updatedAt === 'string' ? new Date(c.updatedAt) : c.updatedAt;

                if (commentData.logId && logIdMap.has(commentData.logId)) {
                    commentData.logId = logIdMap.get(commentData.logId);

                    // Check for duplicates? Content + Date + LogId
                    const duplicates = await db.comments.where('logId').equals(commentData.logId).toArray();
                    const exists = duplicates.some(d =>
                        d.content === commentData.content &&
                        Math.abs(d.createdAt.getTime() - commentData.createdAt.getTime()) < 1000
                    );

                    if (!exists) {
                        await db.comments.add(commentData);
                    }
                }
            }
        }
    });
};
