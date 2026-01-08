import React from 'react';
import type { Log } from '../../db';
import { LogItemLink, LogTitle, LogDate, ThreadToggleBtn } from './itemStyles';
import { FiCornerDownRight } from 'react-icons/fi';
import { TouchDelayDraggable } from './TouchDelayDraggable';
import type { TranslationKeys } from '../../translations';

interface Props {
    threadId: string;
    logs: Log[];
    index: number;
    collapsed: boolean;
    onToggle: (id: string) => void;
    activeLogId?: number;
    modelMap: Map<number, string>;
    formatDate: (d: Date) => string;
    untitledText: string;
    onLogClick?: () => void;
    isCombineTarget?: boolean;
    t: TranslationKeys;
}

export const SidebarThreadItem: React.FC<Props> = ({
    threadId, logs, index, collapsed, onToggle,
    activeLogId, modelMap, formatDate, untitledText, onLogClick,
    isCombineTarget, t
}) => {
    const headLog = logs[0];
    const bodyLogs = logs.slice(1);

    return (
        <TouchDelayDraggable draggableId={`thread-header-${headLog.id}`} index={index}>
            {(provided: any, snapshot: any) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{
                        ...provided.draggableProps.style,
                        marginBottom: '4px',
                        opacity: snapshot.isDragging ? 0.8 : 1,
                        transition: 'background-color 0.1s ease-out, border-color 0.1s ease-out',
                        borderRadius: '8px',
                        border: isCombineTarget ? `2px solid #3b82f6` : '2px solid transparent',
                        backgroundColor: isCombineTarget ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    }}
                >
                    {/* Head Log - Acts as drag handle for the group */}
                    <div {...provided.dragHandleProps} style={{ position: 'relative' }}>
                        <LogItemLink
                            to={`/log/${headLog.id}`}
                            replace={true}
                            $isActive={activeLogId === headLog.id}
                            $inThread={false}
                            onClick={onLogClick}
                        >
                            <LogTitle title={headLog.title || untitledText}>
                                {headLog.title || untitledText}
                            </LogTitle>
                            <LogDate>
                                {formatDate(headLog.createdAt)}
                                {headLog.modelId && (
                                    <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                        • {modelMap.get(headLog.modelId)}
                                    </span>
                                )}
                            </LogDate>
                        </LogItemLink>

                        {/* Integrated Toggle Button */}
                        {bodyLogs.length > 0 && (
                            <div style={{ paddingLeft: '0.5rem' }}>
                                <ThreadToggleBtn onClick={() => onToggle(threadId)}>
                                    <FiCornerDownRight />
                                    {collapsed ? t.sidebar.more_logs.replace('{count}', String(bodyLogs.length)) : t.sidebar.collapse}
                                </ThreadToggleBtn>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </TouchDelayDraggable>
    );
};
