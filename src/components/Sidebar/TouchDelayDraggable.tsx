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
    touchDelay = 800,
    ...draggableProps
}) => {
    const touchTimerRef = useRef<number | null>(null);
    const [isDragDisabled, setIsDragDisabled] = useState(false);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const hasMovedRef = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        hasMovedRef.current = false;

        // Immediately disable drag on touch start
        setIsDragDisabled(true);

        // Clear any existing timer
        if (touchTimerRef.current) {
            window.clearTimeout(touchTimerRef.current);
        }

        // Enable drag after delay only if we haven't moved
        touchTimerRef.current = window.setTimeout(() => {
            if (!hasMovedRef.current) {
                setIsDragDisabled(false);
            }
        }, touchDelay);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current || hasMovedRef.current) return;

        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const moveY = Math.abs(touch.clientY - touchStartPosRef.current.y);

        // If moved more than 10px, it's a scroll/move, not a hold
        if (moveX > 10 || moveY > 10) {
            hasMovedRef.current = true;
            if (touchTimerRef.current) {
                window.clearTimeout(touchTimerRef.current);
                touchTimerRef.current = null;
            }
            setIsDragDisabled(true);
        }
    };

    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            window.clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }

        // Use a short timeout to re-enable for next interaction 
        // to avoid staying disabled if the state update is slow
        setTimeout(() => {
            setIsDragDisabled(false);
            touchStartPosRef.current = null;
            hasMovedRef.current = false;
        }, 100);
    };

    return (
        <Draggable {...draggableProps} isDragDisabled={isDragDisabled}>
            {(provided, snapshot) => (
                <div
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ touchAction: 'pan-y' }}
                >
                    {children(provided, snapshot)}
                </div>
            )}
        </Draggable>
    );
};
