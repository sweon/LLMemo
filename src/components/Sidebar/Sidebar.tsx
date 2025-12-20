import React, { useState } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Link, useNavigate, useParams } from 'react-router-dom'; // Ensure react-router-dom is installed
import { FiPlus, FiSettings, FiSun, FiMoon, FiSearch, FiX, FiRefreshCw, FiArrowUpCircle } from 'react-icons/fi';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Tooltip } from '../UI/Tooltip';
import { SyncModal } from '../Sync/SyncModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useSearch } from '../../contexts/SearchContext';
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
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const SearchInputWrapper = styled.div`
  position: relative;
  margin-bottom: 1rem;
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

const ActionRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  font-weight: 500;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const LogList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const LogItem = styled(Link) <{ $isActive: boolean }>`
  display: block;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  text-decoration: none;
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.border : 'transparent')};
  color: ${({ theme }) => theme.colors.text}; // Ensure text color is set explicitly

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
  margin-top: 0.25rem;
`;

const Footer = styled.div`
  padding: 1rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
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
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'model'>('date-desc');
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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

  const handleUpdateCheck = async () => {
    if (needRefresh) {
      updateServiceWorker(true);
      return;
    }

    setIsCheckingUpdate(true);
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        // Give it a moment to detect changes
        setTimeout(() => setIsCheckingUpdate(false), 1000);
      } catch (error) {
        console.error('Error checking for updates:', error);
        setIsCheckingUpdate(false);
      }
    } else {
      setIsCheckingUpdate(false);
    }
  };

  const models = useLiveQuery(() => db.models.orderBy('id').reverse().toArray());

  const logs = useLiveQuery(async () => {
    let collection = db.logs.toArray();
    let result = await collection;

    // Filter
    if (searchQuery) {
      if (searchQuery.startsWith('tag:')) {
        const tag = searchQuery.slice(4).trim();
        // For tag search, we might want to use the index, but mixing with sort can be tricky in Dexie raw.
        // Simpler to filter in memory for this scale if we want flexible sorting on top.
        // Or use index then sort in memory.
        if (tag) {
          const tagged = await db.logs.where('tags').equals(tag).toArray();
          result = tagged;
        }
      } else {
        const lowerSearch = searchQuery.toLowerCase();
        result = result.filter(l => l.title.toLowerCase().includes(lowerSearch) || l.tags.some(t => t.toLowerCase().includes(lowerSearch)));
      }
    }

    // Sort
    // We need models for model sorting
    const modelMap = new Map<number, string>();
    if (models) {
      models.forEach(m => modelMap.set(m.id!, m.name));
    }

    return result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else if (sortBy === 'date-asc') {
        return a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortBy === 'model') {
        const nameA = (a.modelId && modelMap.get(a.modelId)) || 'zzzz'; // Unknown/No model at end
        const nameB = (b.modelId && modelMap.get(b.modelId)) || 'zzzz';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

  }, [searchQuery, sortBy, models]);

  return (
    <SidebarContainer>
      <Header>
        <SearchInputWrapper>
          <SearchIcon size={16} />
          <SearchInput
            placeholder="Search... (tag:name for tags)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <ClearButton onClick={() => setSearchQuery('')}>
              <FiX size={14} />
            </ClearButton>
          )}
        </SearchInputWrapper>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
            <option value="date-desc">Date (Newest)</option>
            <option value="date-asc">Date (Oldest)</option>
            <option value="model">Model Name</option>
          </select>
        </div>
        <ActionRow>
          <Button onClick={() => {
            navigate('/new');
            onCloseMobile();
          }}>
            <FiPlus /> New Log
          </Button>
        </ActionRow>
      </Header>

      <LogList>
        {logs?.map((log) => (
          <LogItem
            key={log.id}
            to={`/log/${log.id}`}
            $isActive={Number(id) === log.id}
            onClick={onCloseMobile}
          >
            <LogTitle title={log.title || 'Untitled Log'}>{log.title || 'Untitled Log'}</LogTitle>
            <LogDate>
              {format(log.createdAt, 'MMM d, yyyy HH:mm')}
              {sortBy === 'model' && log.modelId && models && (
                <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                  • {models.find(m => m.id === log.modelId)?.name}
                </span>
              )}
            </LogDate>
          </LogItem>
        ))}
      </LogList>

      <Footer>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Tooltip content="Settings">
            <IconButton onClick={() => navigate('/settings')}>
              <FiSettings size={20} />
            </IconButton>
          </Tooltip>

          <Tooltip content="Sync Data">
            <IconButton onClick={() => setIsSyncModalOpen(true)}>
              <FiRefreshCw size={20} />
            </IconButton>
          </Tooltip>

          <Tooltip content={needRefresh ? "Install Update" : "Check for Updates"}>
            <IconButton
              onClick={handleUpdateCheck}
              style={{ position: 'relative' }}
            >
              <FiArrowUpCircle size={20} className={isCheckingUpdate ? 'spin' : ''} />
              {needRefresh && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444', // Red for notification
                  border: '1px solid white'
                }} />
              )}
            </IconButton>
          </Tooltip>
        </div>

        <Tooltip content={mode === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}>
          <IconButton onClick={toggleTheme}>
            {mode === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
          </IconButton>
        </Tooltip>
      </Footer>
      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
    </SidebarContainer>
  );
};
