import React, { useState, useEffect, useRef } from 'react';
import styled, { useTheme as useStyledTheme } from 'styled-components';
import { SyncService, cleanRoomId, type SyncStatus } from '../../services/SyncService';
import { FaTimes, FaSync, FaRegCopy, FaRedo, FaLock, FaShareAlt } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../contexts/LanguageContext';

const generateShortId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    logId: number;
    logTitle: string;
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

const Content = styled.div`
    padding: 24px;
    overflow-y: auto;
    flex: 1;
`;

const FormWrapper = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
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


const StatusBox = styled.div<{ $status: SyncStatus }>`
    padding: 16px;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.colors.surface};
    margin-top: 24px;
    text-align: center;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 0.9rem;
    width: 100%;
    word-break: break-word;
    
    color: ${props => {
        if (props.$status === 'error') return props.theme.colors.danger;
        if (props.$status === 'completed') return props.theme.colors.success;
        if (props.$status === 'ready' || props.$status === 'connected') return props.theme.colors.primary;
        if (props.$status === 'connecting') return '#f59e0b';
        return props.theme.colors.textSecondary;
    }};
    
    border: 1px solid ${props => {
        if (props.$status === 'error') return props.theme.colors.danger + '40';
        if (props.$status === 'completed') return props.theme.colors.success + '40';
        if (props.$status === 'ready' || props.$status === 'connected') return props.theme.colors.primary + '40';
        if (props.$status === 'connecting') return '#f59e0b40';
        return props.theme.colors.border;
    }};
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

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, logId, logTitle }) => {
    const [roomId, setRoomId] = useState('');
    const [status, setStatus] = useState<SyncStatus>('disconnected');
    const [statusMessage, setStatusMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const syncService = useRef<SyncService | null>(null);
    const theme = useStyledTheme();
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen) {
            if (!roomId) {
                setRoomId(generateShortId());
            }
        }
    }, [isOpen]);

    const handleClose = () => {
        if (syncService.current) {
            syncService.current.destroy();
            syncService.current = null;
        }
        setStatus('disconnected');
        setStatusMessage('');
        onClose();
    };

    const handleStatusChange = (newStatus: SyncStatus, msg?: string) => {
        setStatus(newStatus);
        if (msg) setStatusMessage(msg);
    };

    const getService = () => {
        if (!syncService.current) {
            syncService.current = new SyncService({
                onStatusChange: handleStatusChange,
                onDataReceived: () => {
                    // This is usually for receiver, but sender might get "completed" too
                    console.log("Data transfer completed");
                },
                initialDataLogId: logId
            });
        }
        return syncService.current;
    };

    const startHosting = async () => {
        if (!roomId.trim()) return;
        try {
            const svc = getService();
            await svc.initialize(roomId);
        } catch (e) {
            console.error(e);
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
        startHosting();
    };

    // Auto-start hosting when modal opens or Room ID generated
    useEffect(() => {
        if (isOpen && roomId && status === 'disconnected') {
            startHosting();
        }
    }, [isOpen, roomId]);


    if (!isOpen) return null;

    return (
        <Overlay onClick={handleClose}>
            <ModalContainer onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Header>
                    <h2><FaShareAlt /> {t.log_detail.share_log} <FaLock style={{ fontSize: '0.9rem', opacity: 0.6 }} title="End-to-End Encrypted" /></h2>
                    <CloseButton onClick={handleClose}><FaTimes /></CloseButton>
                </Header>

                <Content>
                    <FormWrapper>
                        <p style={{ fontSize: '0.9rem', color: theme.colors.textSecondary, marginBottom: '20px' }}>
                            Sharing: <strong>{logTitle}</strong>
                        </p>

                        <Label>{t.sync.your_room_id}</Label>
                        <InputGroup>
                            <Input
                                value={roomId}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value)}
                                disabled={status === 'connected' || status === 'connecting' || status === 'syncing'}
                                placeholder={t.sync.enter_custom_id}
                            />
                            <IconButton onClick={copyToClipboard} title={copied ? t.sync.copied : t.sync.copy_id}>
                                {copied ? <FaShareAlt style={{ color: theme.colors.success }} /> : <FaRegCopy />}
                            </IconButton>
                            <IconButton onClick={regenerateId} disabled={status === 'syncing' || status === 'connected'} title={t.sync.regenerate_id}>
                                <FaRedo />
                            </IconButton>
                        </InputGroup>

                        <div style={{ textAlign: 'center' }}>
                            <QRWrapper>
                                <QRCodeSVG value={cleanRoomId(roomId)} size={180} level="H" />
                            </QRWrapper>
                            <p style={{ fontSize: '0.85rem', color: theme.colors.textSecondary, marginTop: -8 }}>
                                {status === 'connected' || status === 'syncing'
                                    ? t.sync.connected_to_peer
                                    : t.sync.scan_hint}
                            </p>
                        </div>

                        {(statusMessage || status !== 'disconnected') && (
                            <StatusBox $status={status}>
                                {status === 'connecting' && <FaSync className="fa-spin" />}
                                {statusMessage || (status === 'ready' ? t.sync.ready_to_share : status === 'connected' ? t.sync.connected : '')}
                            </StatusBox>
                        )}
                    </FormWrapper>
                </Content>
            </ModalContainer>
        </Overlay>
    );
};
