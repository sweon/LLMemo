import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Log } from '../../db';
import { SidebarLogItem } from './SidebarLogItem';
import { ThreadContainer, ThreadHeader } from './itemStyles';
import { FiChevronRight, FiChevronDown, FiLayers } from 'react-icons/fi';

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
}

export const SidebarThreadItem: React.FC<Props> = ({
    threadId, logs, index, collapsed, onToggle,
    activeLogId, modelMap, formatDate, untitledText, onLogClick
}) => {
    return (
        <Draggable draggableId={`thread-group-${threadId}`} index={index}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{ ...provided.draggableProps.style, marginBottom: '4px' }}
                >
                    <ThreadHeader
                        onClick={() => onToggle(threadId)}
                        {...provided.dragHandleProps}
                    >
                        {collapsed ? <FiChevronRight /> : <FiChevronDown />}
                        <FiLayers style={{ fontSize: '0.8rem', opacity: 0.7 }} />
                        <span>{logs.length} logs</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: 'auto' }}>
                            {formatDate(logs[0].updatedAt)}
                        </span>
                    </ThreadHeader>

                    {!collapsed && (
                        <ThreadContainer>
                            <Droppable droppableId={`thread-${threadId}`} type="LOG_LIST">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        style={{
                                            minHeight: '20px', // Ensure droppable area is accessible
                                            background: snapshot.isDraggingOver ? 'rgba(0,0,0,0.02)' : 'transparent',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        {logs.map((log, i) => (
                                            <SidebarLogItem
                                                key={log.id}
                                                log={log}
                                                index={i}
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
                    {/* Allow dropping into collapsed thread? - Requires Combine or expanded droppable logic. 
                        For now, only drop when expanded. */}
                </div>
            )}
        </Draggable>
    );
};
