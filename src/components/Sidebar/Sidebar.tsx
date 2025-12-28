import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Link, useNavigate, useParams } from 'react-router-dom'; // Ensure react-router-dom is installed
import { FiPlus, FiMinus, FiSettings, FiSun, FiMoon, FiSearch, FiX, FiRefreshCw, FiArrowUpCircle } from 'react-icons/fi';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Tooltip } from '../UI/Tooltip';
import { SyncModal } from '../Sync/SyncModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Toast } from '../UI/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { format } from 'date-fns';

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

const LogItem = styled(Link) <{ $isActive: boolean; $inThread?: boolean; $isThreadStart?: boolean; $isThreadEnd?: boolean }>`
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: ${({ $inThread, $isThreadEnd }) => ($inThread && !$isThreadEnd ? '0' : '0.125rem')}; // Remove margin between thread items
  text-decoration: none;
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.border : 'transparent')};
  color: ${({ theme }) => theme.colors.text};
  
  margin-left: ${({ $inThread }) => ($inThread ? '1.5rem' : '0')};
  position: relative;
  
  ${({ $inThread, theme, $isThreadStart, $isThreadEnd }) => $inThread && `
    &::before {
      content: '';
      position: absolute;
      left: -0.75rem;
      top: ${$isThreadStart ? '50%' : '0'};
      bottom: ${$isThreadEnd ? '50%' : '0'};
      width: 2px;
      background-color: ${theme.colors.border};
    }
    &::after {
      content: '';
      position: absolute;
      left: -0.75rem;
      top: 50%;
      width: 0.5rem;
      height: 2px;
      background-color: ${theme.colors.border};
    }
  `}

  &:hover {
    background: ${({ theme, $isActive }) => ($isActive ? theme.colors.border : theme.colors.surface)};
    text-decoration: none;
  }
`;

const LogTitle = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LogDate = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 0.1rem;
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

  // Filter and sort synchronously for instant UI updates
  const logs = React.useMemo(() => {
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

    // Grouping and Sorting
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
      type: 'single' | 'group',
      log?: typeof result[0],
      logs?: typeof result,
      representativeLog: typeof result[0]
    };

    const items: SortableItem[] = [
      ...singles.map(l => ({ type: 'single' as const, log: l, representativeLog: l })),
      ...Array.from(groups.values()).map(g => {
        const latest = g.reduce((prev, curr) => (new Date(prev.createdAt) > new Date(curr.createdAt) ? prev : curr), g[0]);
        return { type: 'group' as const, logs: g, representativeLog: latest };
      })
    ];

    // Main Sort
    items.sort((itemA, itemB) => {
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

    // Flatten with metadata
    const flatLogs: Array<typeof result[0] & { inThread?: boolean, isThreadStart?: boolean, isThreadEnd?: boolean }> = [];

    items.forEach(item => {
      if (item.type === 'single' && item.log) {
        flatLogs.push(item.log);
      } else if (item.type === 'group' && item.logs) {
        item.logs.forEach((l, index) => {
          flatLogs.push({
            ...l,
            inThread: true,
            isThreadStart: index === 0,
            isThreadEnd: index === item.logs!.length - 1
          });
        });
      }
    });

    return flatLogs;
  }, [allLogs, allModels, allComments, searchQuery, sortBy]);


  const onDragEnd = async (result: DropResult) => {
    const { source, destination, combine } = result;

    if (combine) {
      const sourceLog = logs[source.index];
      const targetLogId = Number(combine.draggableId);
      const targetLog = allLogs?.find(l => l.id === targetLogId);

      if (!sourceLog || !targetLog || sourceLog.id === targetLog.id) return;

      let threadId = targetLog.threadId;

      // Create new thread if target doesn't have one
      if (!threadId) {
        threadId = crypto.randomUUID();
        await db.logs.update(targetLog.id!, { threadId, threadOrder: 0 });
      }

      // Add source to thread
      const threadLogs = await db.logs.where('threadId').equals(threadId).toArray();
      const maxOrder = Math.max(...threadLogs.map(l => l.threadOrder || 0));

      await db.logs.update(sourceLog.id!, {
        threadId,
        threadOrder: maxOrder + 1
      });
      return;
    }

    if (!destination || source.index === destination.index) return;

    const sourceLog = logs[source.index];
    const destLog = logs[destination.index];

    // Reorder only within the same thread
    if (sourceLog.threadId && destLog.threadId && sourceLog.threadId === destLog.threadId) {
      // Get all logs in this thread from the view (they are sorted by order)
      const threadLogs = logs.filter(l => l.threadId === sourceLog.threadId);

      // Find local indices within the thread group
      const sourceLocalIndex = threadLogs.findIndex(l => l.id === sourceLog.id);
      const destLocalIndex = threadLogs.findIndex(l => l.id === destLog.id);

      if (sourceLocalIndex === -1 || destLocalIndex === -1) return;

      // Reorder array locally
      const newOrder = Array.from(threadLogs);
      const [removed] = newOrder.splice(sourceLocalIndex, 1);
      newOrder.splice(destLocalIndex, 0, removed);

      // Update DB
      await db.transaction('rw', db.logs, async () => {
        for (let i = 0; i < newOrder.length; i++) {
          await db.logs.update(newOrder[i].id!, { threadOrder: i });
        }
      });
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

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="logs" isCombineEnabled>
          {(provided) => (
            <LogList ref={provided.innerRef} {...provided.droppableProps}>
              {logs?.map((log, index) => (
                <Draggable key={log.id} draggableId={String(log.id)} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{ ...provided.draggableProps.style, marginBottom: '0.125rem' }}
                    >
                      <LogItem
                        to={`/log/${log.id}`}
                        $isActive={Number(id) === log.id}
                        $inThread={(log as any).inThread}
                        $isThreadStart={(log as any).isThreadStart}
                        $isThreadEnd={(log as any).isThreadEnd}
                        onClick={onCloseMobile}
                      >
                        <LogTitle title={log.title || t.sidebar.untitled}>{log.title || t.sidebar.untitled}</LogTitle>
                        <LogDate>
                          {format(log.createdAt, 'yy.MM.dd HH:mm')}
                          {log.modelId && allModels && (
                            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                              • {allModels.find(m => m.id === log.modelId)?.name}
                            </span>
                          )}
                        </LogDate>
                      </LogItem>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </LogList>
          )}
        </Droppable>
      </DragDropContext>

      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </SidebarContainer>
  );
};
