import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toast } from './UI/Toast';

/**
 * Handles Android back button logic:
 * 1. Ensures we are always 'trapped' at the root with a dummy state.
 * 2. If back is pressed at root, show toast and require second press within 2s to exit.
 */
export const AndroidExitHandler: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showToast, setShowToast] = useState(false);
    const lastPressTime = useRef<number>(0);

    // Helper to check if we are at the app root
    const isRootPath = () => {
        const currentPath = window.location.hash.replace('#', '') || '/';
        return currentPath === '/' || currentPath === '';
    };

    useEffect(() => {
        // Ensure that whenever we land on root OR start the app, 
        // there is a dummy entry ABOVE us in history to catch the 'back' action.
        if (isRootPath()) {
            if (!window.history.state || !window.history.state.noExit) {
                window.history.pushState({ noExit: true }, '');
            }
        }

        const handlePopState = (e: PopStateEvent) => {
            const isRoot = isRootPath();

            // If we just popped a state and landed somewhere without our blocker flag
            if (!e.state || !e.state.noExit) {
                if (isRoot) {
                    const now = Date.now();
                    const timeDiff = now - lastPressTime.current;

                    if (timeDiff < 2000) {
                        // Second press: Exit the app for real (pop whatever is below root)
                        window.history.back();
                    } else {
                        // First press at root: Stay here, show warning, re-push blocker
                        lastPressTime.current = now;
                        setShowToast(true);
                        window.history.pushState({ noExit: true }, '');
                    }
                } else {
                    // Popped from a sub-page? 
                    // Go to root with NO warning (user just wanted to navigate back to list)
                    navigate('/', { replace: true });
                    // Immediately re-push dummy to protect root
                    window.history.pushState({ noExit: true }, '');
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [navigate, location.pathname]);

    if (!showToast) return null;

    return (
        <Toast
            message="한번 더 누르면 앱이 종료됩니다."
            onClose={() => setShowToast(false)}
        />
    );
};

