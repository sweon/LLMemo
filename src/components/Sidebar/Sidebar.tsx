import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Log } from '../../db';
import { useNavigate, useParams, useLocation } from 'react-router-dom'; // Ensure react-router-dom is installed
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
  padding: 0.5rem 1rem 0.75rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const AppBanner = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  opacity: 0.9;
`;

const AppTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const AppVersionText = styled.div`
  font-size: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: ${({ theme }) => theme.colors.textSecondary};
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
  scrollbar-width: thin;

  /* Improve drag behavior on touch devices */
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 10px;
  }

  /* Standard DND area */
  min-height: 200px;
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

  // Expansion state (now collapsed by default)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [combineTargetId, setCombineTargetId] = useState<string | null>(null);

  const toggleThread = (threadId: string) => {
    const newSet = new Set(expandedThreads);
    if (newSet.has(threadId)) newSet.delete(threadId);
    else newSet.add(threadId);
    setExpandedThreads(newSet);
  };
  const { theme, mode, toggleTheme, increaseFontSize, decreaseFontSize } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Decide whether to replace history or push.
  // We only replace if we are already in a sub-page (log detail or settings).
  // If we are at root (/), we MUST push so that back button can return to root.
  const isAtSubPage = !!id || location.pathname.includes('/settings');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckedManually, setUpdateCheckedManually] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const needRefreshRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Do NOT check for updates automatically on load or periodically
    // Updates will ONLY be checked when user manually clicks the update button
    immediate: false,
    onRegistered(r) {
      console.log('SW Registered: ' + r)
      // No automatic update checks here
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

  type FlatItem =
    | { type: 'single', log: Log }
    | { type: 'thread-header', log: Log, threadId: string, threadLogs: Log[] }
    | { type: 'thread-child', log: Log, threadId: string };

  const flatItems: FlatItem[] = React.useMemo(() => {
    if (!allLogs || !allModels) return [];

    let filtered = [...allLogs];

    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();

      // Check if searching for a tag or model
      if (q.startsWith('tag:')) {
        const tagQuery = q.substring(4).trim();
        filtered = filtered.filter(l =>
          l.tags.some(t => t.toLowerCase().includes(tagQuery)) ||
          (l.modelId && allModels.find(m => m.id === l.modelId)?.name.toLowerCase().includes(tagQuery))
        );
      } else {
        // Regular search in title and tags
        filtered = filtered.filter(l =>
          l.title.toLowerCase().includes(q) ||
          l.tags.some(t => t.toLowerCase().includes(q))
        );
      }
    }

    // Sort models
    const modelOrderMap = new Map<number, number>();
    allModels.forEach(m => modelOrderMap.set(m.id!, m.order ?? 999));

    // Grouping
    const groups = new Map<string, Log[]>();
    const singles: Log[] = [];

    filtered.forEach(l => {
      if (l.threadId) {
        if (!groups.has(l.threadId)) groups.set(l.threadId, []);
        groups.get(l.threadId)!.push(l);
      } else {
        singles.push(l);
      }
    });

    groups.forEach(g => g.sort((a, b) => (a.threadOrder ?? 0) - (b.threadOrder ?? 0)));

    type SortableGroup = {
      type: 'single', log: Log, lastDate: Date
    } | {
      type: 'thread', logs: Log[], threadId: string, lastDate: Date
    };

    const sortableGroups: SortableGroup[] = [
      ...singles.map(l => ({ type: 'single' as const, log: l, lastDate: l.createdAt })),
      ...Array.from(groups.entries()).map(([tid, g]) => {
        const latest = g.reduce((p, c) => (new Date(p.createdAt) > new Date(c.createdAt) ? p : c), g[0]);
        return { type: 'thread' as const, logs: g, threadId: tid, lastDate: latest.createdAt };
      })
    ];

    sortableGroups.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
      if (sortBy === 'date-asc') return new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime();

      if (sortBy === 'model-desc' || sortBy === 'model-asc') {
        const aLog = a.type === 'single' ? a.log : a.logs[0];
        const bLog = b.type === 'single' ? b.log : b.logs[0];
        const aModelOrder = aLog.modelId ? (modelOrderMap.get(aLog.modelId) ?? 999) : 999;
        const bModelOrder = bLog.modelId ? (modelOrderMap.get(bLog.modelId) ?? 999) : 999;

        if (sortBy === 'model-desc') {
          // Lower order number = higher priority = show first
          if (aModelOrder !== bModelOrder) return aModelOrder - bModelOrder;
          // Same model order: sort by date (newest first)
          return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
        } else {
          // model-asc: Higher order = show first
          if (aModelOrder !== bModelOrder) return bModelOrder - aModelOrder;
          // Same model order: sort by date (newest first)
          return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
        }
      }

      return 0;
    });

    const flat: FlatItem[] = [];
    sortableGroups.forEach(g => {
      if (g.type === 'single') {
        flat.push({ type: 'single', log: g.log });
      } else {
        const header = g.logs[0];
        flat.push({ type: 'thread-header', log: header, threadId: g.threadId, threadLogs: g.logs });
        if (expandedThreads.has(g.threadId)) {
          g.logs.slice(1).forEach(child => {
            flat.push({ type: 'thread-child', log: child, threadId: g.threadId });
          });
        }
      }
    });

    return flat;
  }, [allLogs, allModels, allComments, searchQuery, sortBy, expandedThreads]);

  const onDragUpdate = (update: DragUpdate) => {
    if (update.combine) {
      setCombineTargetId(update.combine.draggableId);
    } else {
      setCombineTargetId(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    // Always cleanup drag state, even if drag was cancelled
    setCombineTargetId(null);

    const { source, destination, combine, draggableId } = result;

    const parseLogId = (dId: string) => {
      if (dId.startsWith('thread-header-')) return Number(dId.replace('thread-header-', ''));
      if (dId.startsWith('thread-child-')) return Number(dId.replace('thread-child-', ''));
      return Number(dId);
    };

    const updateThreadOrder = async (threadId: string, logIds: number[]) => {
      await db.transaction('rw', db.logs, async () => {
        for (let i = 0; i < logIds.length; i++) {
          await db.logs.update(logIds[i], { threadId, threadOrder: i });
        }
      });
    };

    if (combine) {
      const sourceId = parseLogId(draggableId);
      const targetId = parseLogId(combine.draggableId);
      if (sourceId === targetId) {
        return;
      }

      const [sourceLog, targetLog] = await Promise.all([
        db.logs.get(sourceId),
        db.logs.get(targetId)
      ]);

      if (!sourceLog || !targetLog) {
        return;
      }

      // If dropped on its own thread member (header or child), treat as extraction
      if (sourceLog.threadId && sourceLog.threadId === targetLog.threadId) {
        await db.logs.update(sourceId, { threadId: undefined, threadOrder: undefined });
        return;
      }

      if (targetLog.threadId) {
        const tid = targetLog.threadId;
        const members = await db.logs.where('threadId').equals(tid).sortBy('threadOrder');
        const newIds = members.filter(m => m.id !== sourceId).map(m => m.id!);
        newIds.push(sourceId);
        await updateThreadOrder(tid, newIds);
      } else {
        const newThreadId = crypto.randomUUID();
        await updateThreadOrder(newThreadId, [targetId, sourceId]);
      }
      return;
    }

    if (!destination) {
      return;
    }
    if (source.index === destination.index) {
      return;
    }

    const movedFlatItem = flatItems[source.index];
    if (!movedFlatItem) {
      return;
    }

    const logId = movedFlatItem.log.id!;
    const nextList = [...flatItems];
    const [removed] = nextList.splice(source.index, 1);
    nextList.splice(destination.index, 0, removed);

    const prevItem = nextList[destination.index - 1];

    // Determine if the dropped position should join a thread
    let targetThreadId: string | undefined = undefined;

    // SMART JOIN LOGIC:
    // 1. If dropped after a thread header: 
    //    - If we are a single log or a child from another thread, join this thread.
    //    - If we are already a header, we stay standalone (don't merge via reorder).
    // 2. If dropped after a thread child: 
    //    - Only join if we were ALREADY in that thread (reordering within thread).
    //    - If we move a child to another thread's children, it extracts.
    // This makes extraction much easier: just drag a child log away from its thread items.
    if (prevItem && (prevItem.type === 'thread-header' || prevItem.type === 'thread-child')) {
      const isSameThread = movedFlatItem.log.threadId === prevItem.threadId;

      if (isSameThread) {
        targetThreadId = prevItem.threadId;
      }
    }
    // Otherwise: targetThreadId remains undefined → extract from thread (or stay standalone)

    if (targetThreadId) {
      // Update the log to join the thread
      await db.logs.update(logId, { threadId: targetThreadId });

      // Get all thread members from the simulated nextList in their new order
      // Filter by log ID instead of type/threadId to catch the dragged item
      const threadLogIds = new Set<number>();

      // First, get all existing thread members
      const existingMembers = await db.logs.where('threadId').equals(targetThreadId).toArray();
      existingMembers.forEach(log => threadLogIds.add(log.id!));

      // Add the dragged item
      threadLogIds.add(logId);

      // Now extract IDs in the order they appear in nextList
      const ids: number[] = [];
      nextList.forEach(item => {
        if (item.type !== 'single' && item.type !== 'thread-header' && item.type !== 'thread-child') return;
        const itemLogId = item.log.id!;
        if (threadLogIds.has(itemLogId) && !ids.includes(itemLogId)) {
          ids.push(itemLogId);
        }
      });

      // Update all thread members with their new order
      await updateThreadOrder(targetThreadId, ids);
    } else {
      await db.logs.update(logId, { threadId: undefined, threadOrder: undefined });
    }
  };

  const showUpdateIndicator = needRefresh && updateCheckedManually;

  return (
    <SidebarContainer>
      <Header>
        <AppBanner>
          <AppTitle>LLMemo</AppTitle>
          <AppVersionText>v1.5.1</AppVersionText>
        </AppBanner>
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
              <IconButton onClick={() => {
                navigate('/settings', { replace: isAtSubPage });
                onCloseMobile();
              }}>
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
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surface,
              color: theme.colors.text
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

      <DragDropContext
        onDragEnd={onDragEnd}
        onDragUpdate={onDragUpdate}
      >
        <Droppable droppableId="root" isCombineEnabled type="LOG_LIST">
          {(provided) => (
            <LogList ref={provided.innerRef} {...provided.droppableProps}>
              {flatItems.map((item, index) => {
                if (item.type === 'single') {
                  const logId = item.log.id!;
                  return (
                    <SidebarLogItem
                      key={logId}
                      log={item.log}
                      index={index}
                      isActive={Number(id) === logId}
                      onClick={onCloseMobile}
                      modelName={modelNameMap.get(item.log.modelId!)}
                      formatDate={(d: Date) => format(d, 'yy.MM.dd HH:mm')}
                      untitledText={t.sidebar.untitled}
                      isCombineTarget={combineTargetId === String(logId)}
                      replace={isAtSubPage}
                    />
                  );
                } else if (item.type === 'thread-header') {
                  const logId = item.log.id!;
                  return (
                    <SidebarThreadItem
                      key={`header-${item.threadId}`}
                      threadId={item.threadId}
                      logs={item.threadLogs}
                      index={index}
                      collapsed={!expandedThreads.has(item.threadId)}
                      onToggle={toggleThread}
                      activeLogId={Number(id)}
                      modelMap={modelNameMap}
                      formatDate={(d: Date) => format(d, 'yy.MM.dd HH:mm')}
                      untitledText={t.sidebar.untitled}
                      onLogClick={onCloseMobile}
                      isCombineTarget={combineTargetId === `thread-header-${logId}`}
                      t={t}
                      replace={isAtSubPage}
                    />
                  );
                } else if (item.type === 'thread-child') {
                  const logId = item.log.id!;
                  return (
                    <SidebarLogItem
                      key={logId}
                      log={item.log}
                      index={index}
                      isActive={Number(id) === logId}
                      onClick={onCloseMobile}
                      modelName={modelNameMap.get(item.log.modelId!)}
                      formatDate={(d: Date) => format(d, 'yy.MM.dd HH:mm')}
                      untitledText={t.sidebar.untitled}
                      inThread={true}
                      isCombineTarget={combineTargetId === `thread-child-${logId}`}
                      replace={isAtSubPage}
                    />
                  );
                }
                return null;
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
