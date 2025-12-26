import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Link, useNavigate, useParams } from 'react-router-dom'; // Ensure react-router-dom is installed
import { FiPlus, FiMinus, FiSettings, FiSun, FiMoon, FiSearch, FiX, FiRefreshCw, FiArrowUpCircle } from 'react-icons/fi';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Tooltip } from '../UI/Tooltip';
import { SyncModal } from '../Sync/SyncModal';
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

const LogItem = styled(Link) <{ $isActive: boolean }>`
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.125rem;
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
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'model'>('date-desc');
  const { mode, toggleTheme, increaseFontSize, decreaseFontSize } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
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
    if (needRefresh) {
      setToastMessage(t.sidebar.install_update);
      // Ensure the UI has a moment to show the message before reload
      setTimeout(() => {
        updateServiceWorker(true);
        // Fallback reload if SW doesn't trigger it within 3s
        setTimeout(() => window.location.reload(), 3000);
      }, 500);
      return;
    }

    if (isCheckingUpdate) return;

    setIsCheckingUpdate(true);
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Check for updates on the server
        await registration.update();

        // Wait for the state to propagate
        setTimeout(() => {
          setIsCheckingUpdate(false);
          if (needRefreshRef.current) {
            setToastMessage(t.sidebar.update_found);
          } else {
            setToastMessage(t.sidebar.up_to_date);
          }
        }, 2000);
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

  const models = useLiveQuery(() => db.models.orderBy('order').toArray());

  const logs = useLiveQuery(async () => {
    let collection = db.logs.toArray();
    let result = await collection;

    // Filter
    if (searchQuery) {
      if (searchQuery.startsWith('tag:')) {
        const query = searchQuery.slice(4).trim().toLowerCase();
        if (query) {
          result = result.filter(log => {
            const hasTag = log.tags?.some(t => t.toLowerCase().includes(query));
            const modelName = models?.find(m => m.id === log.modelId)?.name.toLowerCase() || '';
            const hasModel = modelName.includes(query);
            return hasTag || hasModel;
          });
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

            <Tooltip content={needRefresh ? t.sidebar.install_update : t.sidebar.check_updates}>
              <IconButton
                onClick={handleUpdateCheck}
                style={{ position: 'relative' }}
              >
                <FiArrowUpCircle size={18} className={isCheckingUpdate ? 'spin' : ''} />
                {needRefresh && (
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
            <option value="model">{t.sidebar.model_name}</option>
          </select>
        </div>
      </Header>

      <LogList>
        {logs?.map((log) => (
          <LogItem
            key={log.id}
            to={`/log/${log.id}`}
            $isActive={Number(id) === log.id}
            onClick={onCloseMobile}
          >
            <LogTitle title={log.title || t.sidebar.untitled}>{log.title || t.sidebar.untitled}</LogTitle>
            <LogDate>
              {format(log.createdAt, 'MMM d, yyyy HH:mm')}
              {log.modelId && models && (
                <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                  • {models.find(m => m.id === log.modelId)?.name}
                </span>
              )}
            </LogDate>
          </LogItem>
        ))}
      </LogList>

      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </SidebarContainer>
  );
};
