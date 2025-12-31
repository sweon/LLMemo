import React, { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { DraggableProps } from '@hello-pangea/dnd';

interface TouchDelayDraggableProps extends DraggableProps {
    children: (provided: any, snapshot: any) => ReactNode;
    touchDelay?: number; // milliseconds to wait before allowing drag
}

/**
 * A wrapper around Draggable that requires a longer press on touch devices
 * before drag starts. This prevents accidental drags when scrolling.
 */
export const TouchDelayDraggable: React.FC<TouchDelayDraggableProps> = ({
    children,
    touchDelay = 300,
    ...draggableProps
}) => {
    const touchTimerRef = useRef<number | null>(null);
    const [isDragDisabled, setIsDragDisabled] = useState(false);
    const touchStartTimeRef = useRef<number>(0);

    const handleTouchStart = () => {
        touchStartTimeRef.current = Date.now();
        setIsDragDisabled(true);

        // Clear any existing timer
        if (touchTimerRef.current) {
            window.clearTimeout(touchTimerRef.current);
        }

        // Enable drag after delay
        touchTimerRef.current = window.setTimeout(() => {
            setIsDragDisabled(false);
        }, touchDelay);
    };

    const handleTouchEnd = () => {
        // Clear the timer if touch ends before delay
        if (touchTimerRef.current) {
            window.clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }

        // Re-enable drag for next touch
        setTimeout(() => {
            setIsDragDisabled(false);
        }, 50);
    };

    const handleTouchMove = () => {
        const touchDuration = Date.now() - touchStartTimeRef.current;

        // If user starts moving before delay, cancel drag and allow scroll
        if (touchDuration < touchDelay) {
            if (touchTimerRef.current) {
                window.clearTimeout(touchTimerRef.current);
                touchTimerRef.current = null;
            }
            setIsDragDisabled(true);
        }
    };

    return (
        <Draggable {...draggableProps} isDragDisabled={isDragDisabled}>
            {(provided, snapshot) => (
                <div
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    style={{ touchAction: 'pan-y' }}
                >
                    {children(provided, snapshot)}
                </div>
            )}
        </Draggable>
    );
};
