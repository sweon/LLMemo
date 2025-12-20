import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    hoverDelay?: number; // Delay before showing on hover
    touchDelay?: number; // Delay for long press
}

const TooltipBox = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  top: ${props => props.$top}px;
  left: ${props => props.$left}px;
  transform: translateX(-50%);
  padding: 6px 10px;
  background-color: #333; // Dark background
  color: #fff;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  margin-top: -8px; // Offset slightly above
  opacity: 1;
  visibility: visible;
  
  // Triangle arrow
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -4px;
    border-width: 4px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
`;

export const Tooltip: React.FC<TooltipProps> = ({ content, children, hoverDelay = 200, touchDelay = 500 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const timerRef = useRef<number | null>(null);
    const childRef = useRef<HTMLDivElement>(null);

    const calculatePosition = () => {
        if (childRef.current) {
            const rect = childRef.current.getBoundingClientRect();
            // Position above the element
            setCoords({
                top: rect.top - 8, // 8px Gap
                left: rect.left + (rect.width / 2)
            });
        }
    };

    const handleMouseEnter = () => {
        timerRef.current = window.setTimeout(() => {
            calculatePosition();
            setIsVisible(true);
        }, hoverDelay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setIsVisible(false);
    };

    const handleTouchStart = () => {
        timerRef.current = window.setTimeout(() => {
            calculatePosition();
            setIsVisible(true);
        }, touchDelay);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setTimeout(() => setIsVisible(false), 1500); // Keep visible briefly on mobile
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <>
            <div
                ref={childRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{ display: 'inline-flex' }} // Maintain layout
                onContextMenu={(e) => {
                    if (isVisible) e.preventDefault();
                }}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <TooltipBox $top={coords.top} $left={coords.left}>
                    {content}
                </TooltipBox>,
                document.body
            )}
        </>
    );
};
