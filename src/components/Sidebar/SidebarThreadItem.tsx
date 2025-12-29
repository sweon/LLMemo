import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import type { Log } from '../../db';
import { SidebarLogItem } from './SidebarLogItem';
import { LogItemLink, LogTitle, LogDate, ThreadContainer, ThreadToggleBtn } from './itemStyles';
import { FiCornerDownRight } from 'react-icons/fi';

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
}

export const SidebarThreadItem: React.FC<Props> = ({
    threadId, logs, index, collapsed, onToggle,
    activeLogId, modelMap, formatDate, untitledText, onLogClick,
    isCombineTarget
}) => {
    const headLog = logs[0];
    const bodyLogs = logs.slice(1);

    return (
        <Draggable draggableId={`thread-group-${threadId}`} index={index}>
            {(provided, snapshot) => (
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
                    <div {...provided.dragHandleProps}>
                        <LogItemLink
                            to={`/log/${headLog.id}`}
                            $isActive={activeLogId === headLog.id}
                            $inThread={false} // Shown as normal log
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
                    </div>

                    {/* Toggle Button */}
                    {bodyLogs.length > 0 && (
                        <ThreadToggleBtn onClick={() => onToggle(threadId)}>
                            <FiCornerDownRight />
                            {collapsed ? `${bodyLogs.length} more` : 'Collapse'}
                        </ThreadToggleBtn>
                    )}

                    {/* Body Logs (Collapsible) */}
                    {!collapsed && bodyLogs.length > 0 && (
                        <ThreadContainer>
                            <Droppable droppableId={`thread-${threadId}`} type="LOG_LIST">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        style={{
                                            minHeight: '5px',
                                            background: snapshot.isDraggingOver ? 'rgba(0,0,0,0.02)' : 'transparent',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        {bodyLogs.map((log, i) => (
                                            <SidebarLogItem
                                                key={log.id}
                                                log={log}
                                                index={i} // Note: index starts from 0 relative to Droppable
                                                isActive={activeLogId === log.id}
                                                onClick={onLogClick}
                                                modelName={log.modelId ? modelMap.get(log.modelId) : undefined}
                                                formatDate={formatDate}
                                                inThread={true}
                                                untitledText={untitledText}
                                            />
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </ThreadContainer>
                    )}
                </div>
            )}
        </Draggable>
    );
};
