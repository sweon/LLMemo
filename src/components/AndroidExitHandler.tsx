import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from './UI/Toast';

/**
 * Handles Android back button logic:
 * 1. If not at root, go to root.
 * 2. If at root, double-tap to exit with a toast warning.
 */
export const AndroidExitHandler: React.FC = () => {
    const navigate = useNavigate();
    const [showToast, setShowToast] = useState(false);
    const lastPressTime = useRef<number>(0);

    useEffect(() => {
        // We always want to intercept popstate to implement our custom back behavior
        // First, push a dummy state to history so we have something to "pop"
        window.history.pushState({ noExit: true }, '');

        const handlePopState = (_event: PopStateEvent) => {
            const currentPath = window.location.hash.replace('#', '') || '/';
            // In HashRouter, we should check hash. In typical BrowserRouter, pathname.
            // This app uses HashRouter (based on previous logs/metadata).

            const isRoot = currentPath === '/' || currentPath === '';

            if (!isRoot) {
                // If not at root, navigate to root and prevent going further back
                navigate('/', { replace: true });
                // Re-push dummy state to keep intercepting
                window.history.pushState({ noExit: true }, '');
                return;
            }

            // If at root, handle exit logic
            const now = Date.now();
            const timeDiff = now - lastPressTime.current;

            if (timeDiff < 2000) {
                // Secondary press: actually exit (let the browser go back)
                // We don't push state here, so the next back button (or if history.back() is called)
                // will actually exit the app.
                window.history.back();
            } else {
                // First press: prevent exit, show warning, and stay on root
                lastPressTime.current = now;
                setShowToast(true);
                // Re-push the dummy state to keep the user on the current page
                window.history.pushState({ noExit: true }, '');
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [navigate]);

    if (!showToast) return null;

    return (
        <Toast
            message="한번 더 누르면 앱이 종료됩니다."
            onClose={() => setShowToast(false)}
        />
    );
};

