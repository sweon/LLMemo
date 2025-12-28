import React, { useState, useEffect, useRef } from 'react';
import styled, { useTheme as useStyledTheme } from 'styled-components';
import { SyncService, cleanRoomId, type SyncStatus, type SyncInfo } from '../../services/SyncService';
import { FaTimes, FaSync, FaRegCopy, FaRedo, FaCamera, FaStop, FaCheck, FaLink, FaLock, FaShieldAlt, FaLayerGroup, FaFileAlt, FaDatabase } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useLanguage } from '../../contexts/LanguageContext';

const generateShortId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

interface SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
`;

const ModalContainer = styled.div`
    background-color: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 20px;
    width: 440px;
    max-width: 95%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: ${({ theme }) => theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

        h2 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
            color: ${({ theme }) => theme.colors.primary};
            
            svg:last-child {
                font-size: 0.9rem;
                opacity: 0.6;
            }
        }
`;

const TabContainer = styled.div`
    display: flex;
    background: ${({ theme }) => theme.colors.surface};
    margin: 16px 24px;
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
`;

const Tab = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 10px;
    background: ${props => props.$active ? props.theme.colors.background : 'transparent'};
    border: none;
    border-radius: 8px;
    color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.textSecondary};
    font-weight: ${props => props.$active ? '600' : '500'};
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.95rem;
    box-shadow: ${props => props.$active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};

    &:hover {
        color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.text};
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const Content = styled.div`
    padding: 8px 24px 24px;
    overflow-y: auto;
    flex: 1;

    @media (max-width: 480px) {
        padding: 8px 16px 20px;
    }
`;

const FormWrapper = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;

    @media (max-width: 600px) {
        max-width: 310px;
    }
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s;
    
    &:hover {
        background-color: ${({ theme }) => theme.colors.surface};
        color: ${({ theme }) => theme.colors.text};
    }
`;

const Label = styled.label`
    display: block;
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 0.85rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 100%;
`;

const InputGroup = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    width: 100%;
`;

const Input = styled.input`
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    border-radius: 10px;
    border: 2px solid ${({ theme }) => theme.colors.border};
    background-color: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: 1rem;
    font-family: inherit;
    transition: all 0.2s;

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.primary};
        background-color: ${({ theme }) => theme.colors.background};
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const IconButton = styled.button`
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 10px;
    border: 2px solid ${({ theme }) => theme.colors.border};
    background-color: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover:not(:disabled) {
        border-color: ${({ theme }) => theme.colors.textSecondary};
        color: ${({ theme }) => theme.colors.text};
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger'; $fullWidth?: boolean }>`
    padding: 14px 24px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: ${props => props.$fullWidth ? '100%' : 'auto'};
    
    background-color: ${props => {
        if (props.$variant === 'secondary') return props.theme.colors.surface;
        if (props.$variant === 'danger') return props.theme.colors.danger;
        return props.theme.colors.primary;
    }};
    
    color: ${props => (props.$variant === 'secondary' ? props.theme.colors.text : '#ffffff')};

    &:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    &:active:not(:disabled) {
        transform: translateY(0);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const InfoCard = styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.primary}40;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    animation: fadeIn 0.3s ease;

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .icon-box {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: ${({ theme }) => theme.colors.primary}15;
        color: ${({ theme }) => theme.colors.primary};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
    }
    
    .content {
        flex: 1;
        min-width: 0;
        
        h4 {
            margin: 0 0 4px 0;
            font-size: 0.9rem;
            color: ${({ theme }) => theme.colors.primary};
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        p {
            margin: 0;
            font-size: 0.95rem;
            color: ${({ theme }) => theme.colors.text};
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .sub {
            font-size: 0.8rem;
            color: ${({ theme }) => theme.colors.textSecondary};
            margin-top: 2px;
        }
    }
`;

const ProgressContainer = styled.div`
    width: 100%;
    margin-top: 20px;
`;

const ProgressBar = styled.div<{ $percent: number }>`
    height: 6px;
    background: ${({ theme }) => theme.colors.border};
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 12px;
    position: relative;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: ${props => props.$percent}%;
        background: ${({ theme }) => theme.colors.primary};
        transition: width 0.3s ease;
    }
`;

const StatusBox = styled.div<{ $status: SyncStatus }>`
    padding: 16px;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.colors.surface};
    text-align: center;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.95rem;
    width: 100%;
    word-break: break-word;
    
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};

    .icon-area {
        font-size: 1.5rem;
        margin-bottom: 4px;
        color: ${props => {
        if (props.$status === 'error') return props.theme.colors.danger;
        if (props.$status === 'completed') return props.theme.colors.success;
        if (props.$status === 'ready' || props.$status === 'connected') return props.theme.colors.primary;
        if (props.$status === 'connecting') return '#f59e0b';
        return props.theme.colors.textSecondary;
    }};
    }
`;

const QRWrapper = styled.div`
    background: white;
    padding: 24px;
    border-radius: 16px;
    margin: 20px auto;
    width: fit-content;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
`;

const ScannerContainer = styled.div`
    width: 100%;
    aspect-ratio: 1;
    max-width: 320px;
    margin: 0 auto 24px;
    overflow: hidden;
    border-radius: 16px;
    border: 2px solid ${({ theme }) => theme.colors.border};
    background: #000;
    position: relative;

    #reader {
        width: 100% !important;
        border: none !important;
    }

    #reader__scan_region {
        background: #000 !important;
    }

    #reader__dashboard_section_csr button {
        background-color: ${({ theme }) => theme.colors.primary} !important;
        color: white !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        margin: 10px !important;
        font-weight: 600 !important;
    }
`;

const Divider = styled.div`
    display: flex;
    align-items: center;
    text-align: center;
    margin: 24px 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    width: 100%;

    &::before, &::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    }

    &::before {
        margin-right: 16px;
    }

    &::after {
        margin-left: 16px;
    }
`;

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
    const [roomId, setRoomId] = useState('');
    const [targetRoomId, setTargetRoomId] = useState('');
    const [status, setStatus] = useState<SyncStatus>('disconnected');
    const [statusMessage, setStatusMessage] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
    const [progress, setProgress] = useState(0);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const syncService = useRef<SyncService | null>(null);
    const theme = useStyledTheme();
    const { t, language } = useLanguage();

    useEffect(() => {
        if (isOpen) {
            if (!roomId) {
                setRoomId(generateShortId());
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isScanning && !scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );

            scanner.render((decodedText) => {
                setTargetRoomId(decodedText);
                connectToPeer(decodedText);
            }, () => { });

            scannerRef.current = scanner;
        }

        return () => {
            if (!isScanning && scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Scanner clear error", err));
                scannerRef.current = null;
            }
        };
    }, [isScanning]);

    const handleClose = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        }
        if (syncService.current) {
            syncService.current.destroy();
            syncService.current = null;
        }
        setStatus('disconnected');
        setStatusMessage('');
        setSyncInfo(null);
        setProgress(0);
        setIsScanning(false);
        onClose();
    };

    const handleStatusChange = (newStatus: SyncStatus, msg?: string) => {
        setStatus(newStatus);
        if (msg) setStatusMessage(msg);

        // Estimate progress based on status and message
        if (newStatus === 'connecting') setProgress(15);
        else if (newStatus === 'connected') setProgress(30);
        else if (newStatus === 'syncing') {
            if (msg?.toLowerCase().includes('preparing')) setProgress(10);
            else if (msg?.toLowerCase().includes('encrypting')) setProgress(25);
            else if (msg?.toLowerCase().includes('sending') || msg?.toLowerCase().includes('uploading')) setProgress(45);
            else if (msg?.toLowerCase().includes('downloading')) setProgress(60);
            else if (msg?.toLowerCase().includes('decrypting')) setProgress(75);
            else if (msg?.toLowerCase().includes('merging')) setProgress(90);
            else if (msg?.toLowerCase().includes('back')) setProgress(95);
            else setProgress(50);
        }
        else if (newStatus === 'completed') setProgress(100);
        else if (newStatus === 'error' || newStatus === 'disconnected' || newStatus === 'ready') setProgress(0);
    };

    const getService = () => {
        if (!syncService.current) {
            syncService.current = new SyncService({
                onStatusChange: handleStatusChange,
                onDataReceived: () => {
                    setStatus('completed');
                    setStatusMessage(t.sync.data_synced_reload);
                    setProgress(100);
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                },
                onSyncInfo: (info) => setSyncInfo(info)
            });
        }
        return syncService.current;
    };

    const startHosting = async (id?: string) => {
        const hostId = id || roomId;
        if (!hostId.trim()) return;
        try {
            const svc = getService();
            await svc.initialize(hostId);
        } catch (e) {
            console.error(e);
        }
    };

    const connectToPeer = async (id?: string) => {
        const targetId = id || targetRoomId;
        if (!targetId.trim() || status === 'connecting' || status === 'connected' || status === 'syncing') return;

        if (isScanning) {
            setIsScanning(false);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        }

        try {
            const svc = getService();
            await svc.connect(targetId);
        } catch (e: any) {
            console.error('Connect error:', e);
            setStatus('error');
            setStatusMessage(`Connection failed: ${e.message || 'Unknown error'} `);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const regenerateId = () => {
        if (status === 'syncing' || status === 'connected') return;

        if (syncService.current) {
            syncService.current.destroy();
            syncService.current = null;
        }

        const newId = generateShortId();
        setRoomId(newId);
        setStatus('disconnected');
        setStatusMessage('');
        setSyncInfo(null);
        setProgress(0);

        if (activeTab === 'host') {
            startHosting(newId);
        }
    };

    if (!isOpen) return null;

    return (
        <Overlay onClick={handleClose}>
            <ModalContainer onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Header>
                    <h2><FaSync /> {t.sync.title} <FaLock style={{ fontSize: '0.9rem', opacity: 0.6 }} title="End-to-End Encrypted" /></h2>
                    <CloseButton onClick={handleClose}><FaTimes /></CloseButton>
                </Header>

                <TabContainer>
                    <Tab
                        $active={activeTab === 'host'}
                        onClick={() => setActiveTab('host')}
                        disabled={status === 'syncing' || (status === 'connected' && activeTab === 'join')}
                    >
                        {t.sync.host_session}
                    </Tab>
                    <Tab
                        $active={activeTab === 'join'}
                        onClick={() => setActiveTab('join')}
                        disabled={status === 'syncing' || (status === 'connected' && activeTab === 'host')}
                    >
                        {t.sync.join_session}
                    </Tab>
                </TabContainer>

                <Content>
                    <FormWrapper>
                        {activeTab === 'host' ? (
                            <>
                                {syncInfo && (
                                    <InfoCard>
                                        <div className="icon-box">
                                            {syncInfo.type === 'thread' ? <FaLayerGroup /> :
                                                syncInfo.type === 'full' ? <FaDatabase /> : <FaFileAlt />}
                                        </div>
                                        <div className="content">
                                            <h4>{syncInfo.type === 'thread' ? 'Sharing Thread' :
                                                syncInfo.type === 'full' ? 'Full Backup' : 'Sharing Log'}</h4>
                                            <p>{syncInfo.label}</p>
                                            <div className="sub">{syncInfo.count} items</div>
                                        </div>
                                    </InfoCard>
                                )}
                                <Label>{t.sync.your_room_id}</Label>
                                <InputGroup>
                                    <Input
                                        value={roomId}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value)}
                                        disabled={status === 'connected' || status === 'connecting' || status === 'syncing'}
                                        placeholder={t.sync.enter_custom_id}
                                    />
                                    <IconButton onClick={copyToClipboard} title={copied ? t.sync.copied : t.sync.copy_id}>
                                        {copied ? <FaCheck style={{ color: theme.colors.success }} /> : <FaRegCopy />}
                                    </IconButton>
                                    <IconButton onClick={regenerateId} disabled={status === 'syncing' || status === 'connected'} title={t.sync.regenerate_id}>
                                        <FaRedo />
                                    </IconButton>
                                </InputGroup>

                                <ActionButton
                                    $fullWidth
                                    onClick={() => startHosting()}
                                    disabled={status === 'syncing' || status === 'connected' || status === 'connecting'}
                                >
                                    {status === 'connecting' ? t.sync.connecting : (status === 'ready' ? t.sync.restart_hosting : t.sync.start_host)}
                                </ActionButton>

                                <QRWrapper>
                                    <QRCodeSVG value={cleanRoomId(roomId)} size={180} level="H" />
                                </QRWrapper>
                                <p style={{ fontSize: '0.85rem', color: theme.colors.textSecondary, textAlign: 'center', marginTop: -8 }}>
                                    {status === 'connected' || status === 'syncing'
                                        ? t.sync.connected_to_peer
                                        : t.sync.scan_hint}
                                </p>
                            </>
                        ) : (
                            <>
                                {isScanning ? (
                                    <>
                                        <ScannerContainer>
                                            <div id="reader"></div>
                                        </ScannerContainer>

                                        {syncInfo && (
                                            <InfoCard>
                                                <div className="icon-box">
                                                    {syncInfo.type === 'thread' ? <FaLayerGroup /> :
                                                        syncInfo.type === 'full' ? <FaDatabase /> : <FaFileAlt />}
                                                </div>
                                                <div className="content">
                                                    <h4>{syncInfo.type === 'thread' ? 'Received Thread' :
                                                        syncInfo.type === 'full' ? 'Receiving Backup' : 'Received Log'}</h4>
                                                    <p>{syncInfo.label}</p>
                                                    <div className="sub">{syncInfo.count} items</div>
                                                </div>
                                            </InfoCard>
                                        )}

                                        <ActionButton
                                            $fullWidth
                                            $variant="secondary"
                                            onClick={() => setIsScanning(false)}
                                        >
                                            <FaStop /> {t.sync.stop_scanning}
                                        </ActionButton>
                                    </>
                                ) : (
                                    <>
                                        <ActionButton
                                            $fullWidth
                                            onClick={() => setIsScanning(true)}
                                            disabled={status === 'connected'}
                                            style={{ marginBottom: 12, marginTop: 8 }}
                                        >
                                            <FaCamera /> {t.sync.scan_qr}
                                        </ActionButton>

                                        <Divider>{t.sync.or}</Divider>

                                        {syncInfo && (
                                            <InfoCard>
                                                <div className="icon-box">
                                                    {syncInfo.type === 'thread' ? <FaLayerGroup /> :
                                                        syncInfo.type === 'full' ? <FaDatabase /> : <FaFileAlt />}
                                                </div>
                                                <div className="content">
                                                    <h4>{syncInfo.type === 'thread' ? 'Received Thread' :
                                                        syncInfo.type === 'full' ? 'Receiving Backup' : 'Received Log'}</h4>
                                                    <p>{syncInfo.label}</p>
                                                    <div className="sub">{syncInfo.count} items</div>
                                                </div>
                                            </InfoCard>
                                        )}

                                        <Label>{t.sync.manual_entry}</Label>
                                        <InputGroup>
                                            <Input
                                                placeholder={t.sync.enter_room_id}
                                                value={targetRoomId}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetRoomId(e.target.value)}
                                                disabled={status === 'connected'}
                                            />
                                            <IconButton
                                                onClick={() => connectToPeer()}
                                                disabled={!targetRoomId || status === 'connected' || status === 'syncing'}
                                                title={t.sync.connect}
                                            >
                                                {status === 'connected' ? <FaCheck style={{ color: theme.colors.success }} /> : <FaLink />}
                                            </IconButton>
                                        </InputGroup>
                                    </>
                                )}
                            </>
                        )}

                        {(statusMessage || status !== 'disconnected') && (
                            <ProgressContainer>
                                {(progress > 0) && <ProgressBar $percent={progress} />}
                                <StatusBox $status={status}>
                                    <div className="icon-area">
                                        {status === 'connecting' || status === 'syncing' ? <FaSync className="fa-spin" /> :
                                            status === 'completed' ? <FaCheck /> :
                                                status === 'error' ? <FaTimes /> :
                                                    status === 'connected' ? <FaLink /> : null}
                                    </div>
                                    <div>
                                        {statusMessage || (status === 'ready' ? t.sync.ready_to_share : status === 'connected' ? t.sync.connected : '')}
                                    </div>
                                </StatusBox>
                            </ProgressContainer>
                        )}

                        <div style={{
                            marginTop: '24px',
                            padding: '14px',
                            borderRadius: '12px',
                            background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${theme.colors.border} `,
                            fontSize: '0.8rem',
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            lineHeight: '1.5'
                        }}>
                            <FaShieldAlt style={{ fontSize: '1.2rem', color: theme.colors.primary, marginTop: '2px', flexShrink: 0 }} />
                            <span>
                                {language === 'ko'
                                    ? "모든 데이터는 기기 내에서 로컬 암호화(AES-256)를 거쳐 안전하게 전송됩니다. 릴레이 서버는 어떠한 데이터도 읽을 수 없습니다."
                                    : "Data is end-to-end encrypted locally (AES-256) before sync. The relay server cannot access your content."}
                            </span>
                        </div>
                    </FormWrapper>
                </Content>
            </ModalContainer>
        </Overlay>
    );
};
