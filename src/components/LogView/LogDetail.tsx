import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSearch } from '../../contexts/SearchContext';

import { MarkdownEditor } from '../Editor/MarkdownEditor';
import { MarkdownView } from '../Editor/MarkdownView';
import { FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { format } from 'date-fns';
import { CommentsSection } from './CommentsSection';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
`;

const Header = styled.div`
  margin-bottom: 2rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: 1rem;
`;

const TitleInput = styled.input`
  font-size: 2rem;
  font-weight: 700;
  width: 100%;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 0.5rem;
  
  &:focus {
    outline: none;
    border-bottom: 2px solid ${({ theme }) => theme.colors.primary};
  }
`;

const TitleDisplay = styled.h1`
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
  color: ${({ theme }) => theme.colors.text};
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.9rem;
  flex-wrap: wrap;
`;

const TagInput = styled.input`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $variant }) =>
        $variant === 'primary' ? theme.colors.primary :
            $variant === 'danger' ? theme.colors.surface : theme.colors.surface};
  color: ${({ theme, $variant }) =>
        $variant === 'primary' ? '#fff' :
            $variant === 'danger' ? theme.colors.danger : theme.colors.text};
  cursor: pointer;
  font-weight: 500;

  &:hover {
    background: ${({ theme, $variant }) =>
        $variant === 'primary' ? theme.colors.primaryHover : theme.colors.border};
  }
`;

const ModelSelect = styled.select`
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0.25rem;
  border-radius: 4px;
`;

export const LogDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { setSearchQuery } = useSearch();
    const isNew = id === undefined;

    const [isEditing, setIsEditing] = useState(isNew);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState(''); // Comma separated for editing
    const [modelId, setModelId] = useState<number | undefined>(undefined);

    const log = useLiveQuery(
        () => (id ? db.logs.get(Number(id)) : undefined),
        [id]
    );

    const models = useLiveQuery(() => db.models.orderBy('order').toArray());

    useEffect(() => {
        if (log) {
            setTitle(log.title);
            setContent(log.content);
            setTags(log.tags.join(', '));
            setModelId(log.modelId);
            setIsEditing(false); // Reset to view mode when ID changes
        } else if (isNew) {
            setTitle('');
            setContent('');
            setTags('');
            setModelId(undefined); // Should set default model
            setIsEditing(true);
        }
    }, [log, isNew, id]);

    // Set default model if new and models loaded
    useEffect(() => {
        if (isNew && !modelId && models && models.length > 0) {
            setModelId(models[0].id);
        }
    }, [isNew, modelId, models]);

    const handleSave = async () => {
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        const now = new Date();

        if (id) {
            await db.logs.update(Number(id), {
                title,
                content,
                tags: tagArray,
                modelId: modelId ? Number(modelId) : undefined,
                updatedAt: now
            });
            setIsEditing(false);
        } else {
            const newId = await db.logs.add({
                title: title || 'Untitled',
                content,
                tags: tagArray,
                modelId: modelId ? Number(modelId) : undefined,
                createdAt: now,
                updatedAt: now
            });
            navigate(`/log/${newId}`);
        }
    };

    const handleDelete = async () => {
        if (id && confirm('Are you sure you want to delete this log?')) {
            await db.logs.delete(Number(id));
            await db.comments.where('logId').equals(Number(id)).delete();
            navigate('/');
        }
    };

    const currentModelName = models?.find(m => m.id === modelId)?.name || 'Unknown';

    if (!isNew && !log) return <Container>Loading...</Container>;

    return (
        <Container>
            <Header>
                {isEditing ? (
                    <TitleInput
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Log Title"
                        autoFocus
                    />
                ) : (
                    <TitleDisplay>{log?.title}</TitleDisplay>
                )}

                <MetaRow>
                    {isEditing ? (
                        <>
                            <ModelSelect
                                value={modelId || ''}
                                onChange={e => setModelId(Number(e.target.value))}
                            >
                                {models?.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </ModelSelect>
                            <TagInput
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="Tags (comma separated)"
                            />
                        </>
                    ) : (
                        <>
                            <span>{currentModelName}</span>
                            <span>•</span>
                            <span>{log && format(log.createdAt, 'MMM d, yyyy')}</span>
                            {log?.tags.map(t => (
                                <span
                                    key={t}
                                    onClick={() => setSearchQuery(`tag:${t}`)}
                                    style={{
                                        background: '#eee',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: '#333',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t}
                                </span>
                            ))}
                        </>
                    )}
                </MetaRow>

                <ActionBar>
                    {isEditing ? (
                        <>
                            <ActionButton $variant="primary" onClick={handleSave}>
                                <FiSave /> Save
                            </ActionButton>
                            {!isNew && (
                                <ActionButton onClick={() => setIsEditing(false)}>
                                    <FiX /> Cancel
                                </ActionButton>
                            )}
                        </>
                    ) : (
                        <>
                            <ActionButton onClick={() => setIsEditing(true)}>
                                <FiEdit2 /> Edit
                            </ActionButton>
                            <ActionButton $variant="danger" onClick={handleDelete}>
                                <FiTrash2 /> Delete
                            </ActionButton>
                        </>
                    )}
                </ActionBar>
            </Header>

            {isEditing ? (
                <MarkdownEditor value={content} onChange={setContent} />
            ) : (
                <>
                    <MarkdownView content={content} />
                    {!isNew && log && <CommentsSection logId={log.id!} />}
                </>
            )}
        </Container>
    );
};
