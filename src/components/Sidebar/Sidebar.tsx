import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useNavigate, useParams } from 'react-router-dom'; // Ensure react-router-dom is installed
import { FiPlus, FiMinus, FiSettings, FiSun, FiMoon, FiSearch, FiX, FiRefreshCw, FiArrowUpCircle } from 'react-icons/fi';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Tooltip } from '../UI/Tooltip';
import { SyncModal } from '../Sync/SyncModal';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult, DragUpdate } from '@hello-pangea/dnd';
import { Toast } from '../UI/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { format } from 'date-fns';
import { SidebarLogItem } from './SidebarLogItem';
import { SidebarThreadItem } from './SidebarThreadItem';

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`;

const Header = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const SearchInputWrapper = styled.div`
  position: relative;
  margin-bottom: 0.5rem;
`;

const SearchIcon = styled(FiSearch)`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 2rem;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background-color: ${({ theme }) => theme.colors.surface};
  }
`;


const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  font-weight: 500;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
`;

const LogList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;



const IconButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.text};
  }
`;

interface SidebarProps {
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { searchQuery, setSearchQuery } = useSearch();
  const { t } = useLanguage();
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'model-desc' | 'model-asc' | 'comment-desc'>('date-desc');

  // Collapse state
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [combineTargetId, setCombineTargetId] = useState<string | null>(null);

  const toggleThread = (threadId: string) => {
    const newSet = new Set(collapsedThreads);
    if (newSet.has(threadId)) newSet.delete(threadId);
    else newSet.add(threadId);
    setCollapsedThreads(newSet);
  };
  const { mode, toggleTheme, increaseFontSize, decreaseFontSize } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckedManually, setUpdateCheckedManually] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const needRefreshRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  });

  // Keep ref in sync for use in async handlers
  useEffect(() => {
    needRefreshRef.current = needRefresh;
  }, [needRefresh]);

  const handleUpdateCheck = async () => {
    // First click or explicit check: reveal the status
    if (!updateCheckedManually) {
      setUpdateCheckedManually(true);
      setIsCheckingUpdate(true);

      // If we already know there's a refresh needed, just show the indicator and toast
      if (needRefresh) {
        setIsCheckingUpdate(false);
        setToastMessage(t.sidebar.update_found);
        return;
      }
    }

    // If update is available and user already checked, install it
    if (needRefresh) {
      setToastMessage(t.sidebar.install_update);
      setTimeout(() => {
        updateServiceWorker(true);
        setTimeout(() => window.location.reload(), 3000);
      }, 500);
      return;
    }

    if (isCheckingUpdate && updateCheckedManually) return;

    setIsCheckingUpdate(true);
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();

        setTimeout(() => {
          setIsCheckingUpdate(false);
          setUpdateCheckedManually(true); // Ensure manual check is makred
          if (needRefreshRef.current) {
            setToastMessage(t.sidebar.update_found);
          } else {
            setToastMessage(t.sidebar.up_to_date);
          }
        }, 1500);
      } catch (error) {
        console.error('Error checking for updates:', error);
        setIsCheckingUpdate(false);
        setToastMessage(t.sidebar.check_failed);
      }
    } else {
      setIsCheckingUpdate(false);
      setToastMessage(t.sidebar.pwa_not_supported);
    }
  };

  // Fetch raw data reactively
  const allLogs = useLiveQuery(() => db.logs.toArray());
  const allModels = useLiveQuery(() => db.models.toArray());
  const allComments = useLiveQuery(() => db.comments.toArray());

  const modelNameMap = React.useMemo(() => {
    const map = new Map<number, string>();
    allModels?.forEach(m => map.set(m.id!, m.name));
    return map;
  }, [allModels]);

  const items = React.useMemo(() => {
    if (!allLogs || !allModels) return [];

    let result = [...allLogs];

    // Filter
    if (searchQuery) {
      if (searchQuery.startsWith('tag:')) {
        const query = searchQuery.slice(4).trim().toLowerCase();
        if (query) {
          result = result.filter(log => {
            const hasTag = log.tags?.some(t => t.toLowerCase().includes(query));
            const modelName = allModels.find(m => m.id === log.modelId)?.name.toLowerCase() || '';
            const hasModel = modelName.includes(query);
            return hasTag || hasModel;
          });
        }
      } else {
        const lowerSearch = searchQuery.toLowerCase();
        result = result.filter(l =>
          l.title.toLowerCase().includes(lowerSearch) ||
          l.tags.some(t => t.toLowerCase().includes(lowerSearch))
        );
      }
    }

    // Sort
    const modelOrderMap = new Map<number, number>();
    allModels.forEach(m => {
      modelOrderMap.set(m.id!, m.order ?? 999);
    });

    const commentActivity = new Map<number, number>();
    if (sortBy === 'comment-desc' && allComments) {
      allComments.forEach(c => {
        const time = new Date(c.createdAt).getTime();
        const current = commentActivity.get(c.logId) || 0;
        if (time > current) commentActivity.set(c.logId, time);
      });
    }

    // Grouping
    const groups = new Map<string, typeof result>();
    const singles: typeof result = [];

    result.forEach(l => {
      if (l.threadId) {
        if (!groups.has(l.threadId)) groups.set(l.threadId, []);
        groups.get(l.threadId)!.push(l);
      } else {
        singles.push(l);
      }
    });

    // Sort logs within threads by threadOrder
    groups.forEach(groupLogs => {
      groupLogs.sort((a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0));
    });

    type SortableItem = {
      type: 'single', log: typeof result[0], representativeLog: typeof result[0]
    } | {
      type: 'group', logs: typeof result, representativeLog: typeof result[0], threadId: string
    };

    const sortableItems: SortableItem[] = [
      ...singles.map(l => ({ type: 'single' as const, log: l, representativeLog: l })),
      ...Array.from(groups.entries()).map(([tid, g]) => {
        const latest = g.reduce((prev, curr) => (new Date(prev.createdAt) > new Date(curr.createdAt) ? prev : curr), g[0]);
        return { type: 'group' as const, logs: g, representativeLog: latest, threadId: tid };
      })
    ];

    // Main Sort
    sortableItems.sort((itemA, itemB) => {
      const a = itemA.representativeLog;
      const b = itemB.representativeLog;

      if (sortBy === 'date-desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'date-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'model-desc' || sortBy === 'model-asc') {
        const orderA = a.modelId ? (modelOrderMap.get(a.modelId) ?? 999) : 1000;
        const orderB = b.modelId ? (modelOrderMap.get(b.modelId) ?? 999) : 1000;
        if (orderA !== orderB) {
          return sortBy === 'model-desc' ? orderA - orderB : orderB - orderA;
        }
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortBy === 'model-desc' ? timeB - timeA : timeA - timeB;
      } else if (sortBy === 'comment-desc') {
        const timeA = commentActivity.get(a.id!) || 0;
        const timeB = commentActivity.get(b.id!) || 0;
        if (timeA !== timeB) return timeB - timeA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return sortableItems;
  }, [allLogs, allModels, allComments, searchQuery, sortBy]);


  const onDragUpdate = (update: DragUpdate) => {
    if (update.combine) {
      setCombineTargetId(update.combine.draggableId);
    } else {
      setCombineTargetId(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    setCombineTargetId(null);
    const { source, destination, combine, draggableId } = result;

    const updateThreadOrder = async (threadId: string, logIds: number[]) => {
      await db.transaction('rw', db.logs, async () => {
        for (let i = 0; i < logIds.length; i++) {
          await db.logs.update(logIds[i], { threadId, threadOrder: i });
        }
      });
    };

    if (combine) {
      if (draggableId.startsWith('thread-group-')) return;

      const sourceId = Number(draggableId);
      const targetIdStr = combine.draggableId;

      if (targetIdStr.startsWith('thread-group-')) {
        const targetThreadId = targetIdStr.replace('thread-group-', '');
        const targetThreadLogs = await db.logs.where('threadId').equals(targetThreadId).sortBy('threadOrder');
        const newLogIds = [...targetThreadLogs.map(l => l.id!), sourceId];
        await updateThreadOrder(targetThreadId, newLogIds);
      } else {
        const targetId = Number(targetIdStr);
        if (sourceId === targetId) return;

        const newThreadId = crypto.randomUUID();
        await updateThreadOrder(newThreadId, [targetId, sourceId]);
      }
      return;
    }

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const isSourceRoot = source.droppableId === 'root';
    const isDestRoot = destination.droppableId === 'root';

    if (draggableId.startsWith('thread-group-')) {
      return;
    }

    const logId = Number(draggableId);

    if (!isSourceRoot && isDestRoot) {
      // Move from inside Thread to Root (Detach)
      await db.logs.update(logId, { threadId: undefined, threadOrder: undefined });
      return;
    }

    if (!isDestRoot) {
      // Move into a thread (from Root or another Thread)
      const targetThreadId = destination.droppableId.replace('thread-', '');

      const currentLogs = await db.logs.where('threadId').equals(targetThreadId).sortBy('threadOrder');
      const filteredLogs = currentLogs.filter(l => l.id !== logId);

      const newLogIds = filteredLogs.map(l => l.id!);
      newLogIds.splice(destination.index + 1, 0, logId);

      await updateThreadOrder(targetThreadId, newLogIds);
      return;
    }
  };


  const showUpdateIndicator = needRefresh && updateCheckedManually;

  return (
    <SidebarContainer>
      <Header>
        <TopActions>
          <Button onClick={() => {
            navigate('/new');
            onCloseMobile();
          }}>
            <FiPlus /> {t.sidebar.new}
          </Button>
          <div style={{ display: 'flex', gap: '0rem', alignItems: 'center' }}>
            <Tooltip content={t.sidebar.decrease_font}>
              <IconButton onClick={decreaseFontSize}>
                <FiMinus size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip content={t.sidebar.increase_font}>
              <IconButton onClick={increaseFontSize}>
                <FiPlus size={16} />
              </IconButton>
            </Tooltip>

            <Tooltip content={t.sidebar.sync_data}>
              <IconButton onClick={() => setIsSyncModalOpen(true)}>
                <FiRefreshCw size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip content={showUpdateIndicator ? t.sidebar.install_update : t.sidebar.check_updates}>
              <IconButton
                onClick={handleUpdateCheck}
                style={{ position: 'relative' }}
              >
                <FiArrowUpCircle size={18} className={isCheckingUpdate ? 'spin' : ''} />
                {showUpdateIndicator && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    border: '1px solid white'
                  }} />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip content={mode === 'light' ? t.sidebar.switch_dark : t.sidebar.switch_light}>
              <IconButton onClick={toggleTheme}>
                {mode === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
              </IconButton>
            </Tooltip>

            <Tooltip content={t.sidebar.settings}>
              <IconButton onClick={() => navigate('/settings')}>
                <FiSettings size={18} />
              </IconButton>
            </Tooltip>
          </div>
        </TopActions>

        <SearchInputWrapper>
          <SearchIcon size={16} />
          <SearchInput
            placeholder={t.sidebar.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <ClearButton onClick={() => setSearchQuery('')}>
              <FiX size={14} />
            </ClearButton>
          )}
        </SearchInputWrapper>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #e5e7eb', // theme.colors.border hardcoded for now or use styled comp
              background: mode === 'dark' ? '#1e293b' : '#fff',
              color: mode === 'dark' ? '#f8fafc' : '#111827'
            }}
          >
            <option value="date-desc">{t.sidebar.newest}</option>
            <option value="date-asc">{t.sidebar.oldest}</option>
            <option value="model-desc">{t.sidebar.model_newest}</option>
            <option value="model-asc">{t.sidebar.model_oldest}</option>
            <option value="comment-desc">{t.sidebar.last_commented}</option>
          </select>
        </div>
      </Header>

      <DragDropContext onDragEnd={onDragEnd} onDragUpdate={onDragUpdate}>
        <Droppable droppableId="root" isCombineEnabled type="LOG_LIST">
          {(provided) => (
            <LogList ref={provided.innerRef} {...provided.droppableProps}>
              {items.map((item, index) => {
                if (item.type === 'single') {
                  return (
                    <SidebarLogItem
                      key={item.log.id}
                      log={item.log}
                      index={index}
                      isActive={Number(id) === item.log.id}
                      onClick={onCloseMobile}
                      modelName={modelNameMap.get(item.log.modelId!)}
                      formatDate={(d: Date) => format(d, 'yy.MM.dd HH:mm')}
                      untitledText={t.sidebar.untitled}
                      isCombineTarget={combineTargetId === String(item.log.id)}
                    />
                  );
                } else {
                  return (
                    <SidebarThreadItem
                      key={item.threadId}
                      threadId={item.threadId}
                      logs={item.logs}
                      index={index}
                      collapsed={collapsedThreads.has(item.threadId)}
                      onToggle={toggleThread}
                      activeLogId={Number(id)}
                      modelMap={modelNameMap}
                      formatDate={(d: Date) => format(d, 'yy.MM.dd HH:mm')}
                      untitledText={t.sidebar.untitled}
                      onLogClick={onCloseMobile}
                      isCombineTarget={combineTargetId === `thread-group-${item.threadId}`}
                    />
                  );
                }
              })}
              {provided.placeholder}
            </LogList>
          )}
        </Droppable>
      </DragDropContext>

      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      {
        toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )
      }
    </SidebarContainer >
  );
};
