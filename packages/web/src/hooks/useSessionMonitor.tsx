import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSecondsUntilExpiration, setSessionExpiration, clearSessionExpiration } from '../utils/sessionStorage';

const { VITE_API_URL } = import.meta.env;

interface SessionMonitorOptions {
    warningThreshold?: number; // Seconds before expiration to show warning (default: 60)
    checkInterval?: number; // How often to check session status in seconds (default: 1)
}

export const useSessionMonitor = (options: SessionMonitorOptions = {}) => {
    const {
        warningThreshold = 60, // Show warning when 60 seconds remaining
        checkInterval = 1, // Check every second locally
    } = options;

    const [showWarning, setShowWarning] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [isExtending, setIsExtending] = useState(false);
    const navigate = useNavigate();
    const intervalRef = useRef<NodeJS.Timer | null>(null);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            // Clear interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            // Clear stored session expiration
            clearSessionExpiration();

            // Call logout endpoint
            await fetch(`${VITE_API_URL}/api/access/logout`, {
                method: 'GET',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always redirect to sign-in
            navigate('/sign-in');
        }
    }, [navigate]);

    // Check session status locally
    const checkSessionStatus = useCallback(() => {
        const seconds = getSecondsUntilExpiration();
        
        // Only logout if we have a valid session that has actually expired
        // Don't logout immediately if seconds is 0 on first load (might be no session stored yet)
        if (seconds === 0 && timeRemaining !== null) {
            handleLogout();
            return;
        }

        // If no valid session found on initial load, don't trigger logout
        if (seconds === 0 && timeRemaining === null) {
            return;
        }

        setTimeRemaining(seconds);

        // Show warning if less than threshold
        if (seconds <= warningThreshold && seconds > 0) {
            setShowWarning(true);
        } else {
            setShowWarning(false);
        }
    }, [warningThreshold, handleLogout, timeRemaining]);

    // Extend session
    const extendSession = useCallback(async () => {
        setIsExtending(true);
        try {
            console.log('🔄 Attempting to extend session...');
            const response = await fetch(`${VITE_API_URL}/api/access/session/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log('📡 Session refresh response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Session refresh failed:', response.status, errorText);
                throw new Error(`Failed to refresh session: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Session refresh result:', result);
            
            const { expiresAt } = result.data;
            
            if (!expiresAt) {
                throw new Error('No expiration time returned from server');
            }
            
            // Store new expiration time in localStorage
            setSessionExpiration(expiresAt);
            console.log('📅 New session expiration stored:', new Date(expiresAt).toLocaleString());
            
            // Reset warning state
            setShowWarning(false);
            
            // Update time remaining immediately with the new expiration
            const newSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
            setTimeRemaining(newSeconds);
            
            console.log('⏰ New time remaining after refresh:', newSeconds, 'seconds');
            
            return result.data;
        } catch (error) {
            console.error('❌ Failed to extend session:', error);
            // Don't reset the warning on error - let it stay visible
            throw error;
        } finally {
            setIsExtending(false);
        }
    }, []);

    // Set up periodic checking
    useEffect(() => {
        // Initial check
        checkSessionStatus();

        // Set up interval for local checks (every second)
        intervalRef.current = setInterval(() => {
            checkSessionStatus();
        }, checkInterval * 1000);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkSessionStatus, checkInterval]);

    // Update time remaining every second when warning is shown
    useEffect(() => {
        if (!showWarning || timeRemaining === null) return;

        const countdown = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev === null || prev <= 0) {
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdown);
    }, [showWarning, timeRemaining]);

    return {
        showWarning,
        timeRemaining: timeRemaining || 0,
        isExtending,
        extendSession,
        handleLogout,
    };
};