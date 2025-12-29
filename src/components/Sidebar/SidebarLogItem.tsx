import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Log } from '../../db';
import { LogItemLink, LogTitle, LogDate } from './itemStyles';

interface Props {
    log: Log;
    index: number;
    isActive: boolean;
    onClick?: () => void;
    modelName?: string;
    formatDate: (date: Date) => string;
    inThread?: boolean;
    untitledText: string;
    isCombineTarget?: boolean;
}

export const SidebarLogItem: React.FC<Props> = ({
    log,
    index,
    isActive,
    onClick,
    modelName,
    formatDate,
    inThread,
    untitledText,
    isCombineTarget
}) => {
    return (
        <Draggable draggableId={String(log.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                        ...provided.draggableProps.style,
                        marginBottom: '2px',
                        opacity: snapshot.isDragging ? 0.8 : 1,
                        transition: 'background-color 0.1s ease-out, border-color 0.1s ease-out',
                        borderRadius: '6px',
                        border: isCombineTarget ? `2px solid #3b82f6` : '2px solid transparent',
                        backgroundColor: isCombineTarget ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    }}
                >
                    <LogItemLink
                        to={`/log/${log.id}`}
                        $isActive={isActive}
                        $inThread={inThread}
                        onClick={onClick}
                    >
                        <LogTitle title={log.title || untitledText}>
                            {log.title || untitledText}
                        </LogTitle>
                        <LogDate>
                            {formatDate(log.createdAt)}
                            {modelName && (
                                <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                                    • {modelName}
                                </span>
                            )}
                        </LogDate>
                    </LogItemLink>
                </div>
            )}
        </Draggable>
    );
};
