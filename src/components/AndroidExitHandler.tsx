import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toast } from './UI/Toast';

export const AndroidExitHandler: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showToast, setShowToast] = useState(false);
    const lastPressTime = useRef<number>(0);
    const isAtRoot = location.pathname === '/' || location.pathname === '';

    useEffect(() => {
        // Push a dummy state to history so we can intercept the next back button
        window.history.pushState({ noExit: true }, '');

        const handlePopState = (_event: PopStateEvent) => {
            if (!isAtRoot) {
                // If not at root, go back to root with replace: true to flatten history
                navigate('/', { replace: true });
                // We need to re-push dummy state because navigate('/') might have consumed it
                // or changed the state. Actually navigate(..., {replace: true}) affects current entry.
                window.history.pushState({ noExit: true }, '');
                return;
            }

            // If at root, handle exit logic
            const now = Date.now();
            const timeDiff = now - lastPressTime.current;

            if (timeDiff < 2000) {
                // Secondary press: allow exit
                // By not pushing state again, the next popstate will exit the app
                window.history.back();
            } else {
                // First press: prevent exit and show warning
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
    }, [isAtRoot, navigate]);

    if (!showToast) return null;

    return (
        <Toast
            message="뒤로 가기 버튼을 한 번 더 누르면 종료됩니다."
            onClose={() => setShowToast(false)}
        />
    );
};

