import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { exportData, importData } from '../utils/backup';
import { FiTrash2, FiPlus, FiDownload, FiUpload } from 'react-icons/fi';

const Container = styled.div`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

const Section = styled.div`
  margin-bottom: 3rem;
`;

const Title = styled.h2`
  margin-bottom: 1.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: 0.5rem;
`;

const ModelList = styled.ul`
  list-style: none;
  padding: 0;
`;

const ModelItem = styled.li`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 6px;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
  &:hover { color: ${({ theme }) => theme.colors.danger}; }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const ModalHeader = styled.h3`
  margin-top: 0;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.text};
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1.5rem;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
`;

const ScrollableList = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  background: ${({ theme }) => theme.colors.background};
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
`;

export const SettingsPage: React.FC = () => {
    const models = useLiveQuery(() => db.models.orderBy('id').reverse().toArray());
    const [newModel, setNewModel] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMode, setExportMode] = useState<'all' | 'selected'>('all');
    const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
    const [exportFileName, setExportFileName] = useState('');
    const allLogs = useLiveQuery(() => db.logs.orderBy('createdAt').reverse().toArray());

    const handleExportClick = () => {
        setShowExportModal(true);
        setExportMode('all');
        setSelectedLogs(new Set());
        setExportFileName(`llm-logs-backup-${new Date().toISOString().slice(0, 10)}`);
    };

    const confirmExport = async () => {
        if (exportMode === 'all') {
            await exportData(undefined, exportFileName);
        } else {
            await exportData(Array.from(selectedLogs), exportFileName);
        }
        setShowExportModal(false);
    };

    const toggleLogSelection = (id: number) => {
        const next = new Set(selectedLogs);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedLogs(next);
    };

    const handleAddModel = async () => {
        if (newModel.trim()) {
            await db.models.add({ name: newModel.trim() });
            setNewModel('');
        }
    };

    const handleDeleteModel = async (id: number) => {
        if (confirm('Delete this model? Existing logs linked to this model will lose the reference.')) {
            await db.models.delete(id);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (confirm('Import data? This will merge with existing data.')) {
                try {
                    await importData(file);
                    alert('Import successful!');
                } catch (err) {
                    alert('Import failed: ' + err);
                }
            }
        }
    };

    return (
        <Container>
            <Section>
                <Title>Manage LLM Models</Title>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <Input
                        value={newModel}
                        onChange={e => setNewModel(e.target.value)}
                        placeholder="Add new model name..."
                    />
                    <Button onClick={handleAddModel} disabled={!newModel.trim()}><FiPlus /> Add</Button>
                </div>

                <ModelList>
                    {models?.map(m => (
                        <ModelItem key={m.id}>
                            <span style={{ flex: 1 }}>{m.name}</span>
                            <IconButton onClick={() => handleDeleteModel(m.id!)}><FiTrash2 /></IconButton>
                        </ModelItem>
                    ))}
                </ModelList>
            </Section>

            <Section>
                <Title>Data Management</Title>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button onClick={handleExportClick}><FiDownload /> Export / Backup</Button>

                    <Button onClick={() => fileInputRef.current?.click()} style={{ background: '#10b981' }}>
                        <FiUpload /> Import / Restore
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleImport}
                    />
                </div>
                <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
                    Note: Importing merges data. Duplicate items (by ID) are treated as new entries with mapped relationships.
                </p>
            </Section>

            {showExportModal && (
                <ModalOverlay onClick={() => setShowExportModal(false)}>
                    <ModalContent onClick={e => e.stopPropagation()}>
                        <ModalHeader>Export Data</ModalHeader>
                        <ModalBody>
                            <RadioLabel>
                                <input
                                    type="radio"
                                    checked={exportMode === 'all'}
                                    onChange={() => setExportMode('all')}
                                />
                                All Data (Default)
                            </RadioLabel>

                            <RadioLabel>
                                <input
                                    type="radio"
                                    checked={exportMode === 'selected'}
                                    onChange={() => setExportMode('selected')}
                                />
                                Select Logs
                            </RadioLabel>

                            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Filename (optional):</label>
                                <Input
                                    value={exportFileName}
                                    onChange={e => setExportFileName(e.target.value)}
                                    placeholder="Enter filename..."
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {exportMode === 'selected' && (
                                <ScrollableList>
                                    {allLogs?.length === 0 ? (
                                        <div style={{ padding: '0.5rem', opacity: 0.6 }}>No logs found.</div>
                                    ) : (
                                        allLogs?.map(log => (
                                            <CheckboxLabel key={log.id}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLogs.has(log.id!)}
                                                    onChange={() => toggleLogSelection(log.id!)}
                                                />
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {log.title || 'Untitled'}
                                                </span>
                                            </CheckboxLabel>
                                        ))
                                    )}
                                </ScrollableList>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button onClick={() => setShowExportModal(false)} style={{ background: 'transparent', border: '1px solid #ccc', color: 'inherit' }}>
                                Cancel
                            </Button>
                            <Button onClick={confirmExport} disabled={exportMode === 'selected' && selectedLogs.size === 0}>
                                <FiDownload /> Export
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </ModalOverlay>
            )}
        </Container>
    );
};
