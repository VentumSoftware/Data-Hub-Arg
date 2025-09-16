const SESSION_EXPIRY_KEY = 'sessionExpiresAt';

/**
 * Set session expiration time in localStorage
 * @param expiresAt - ISO string or Date object of when session expires
 */
export const setSessionExpiration = (expiresAt: string | Date) => {
    const expiryString = typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString();
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryString);
};

/**
 * Get session expiration time from localStorage
 * @returns Date object or null if not found
 */
export const getSessionExpiration = (): Date | null => {
    const expiryString = localStorage.getItem(SESSION_EXPIRY_KEY);
    return expiryString ? new Date(expiryString) : null;
};

/**
 * Clear session expiration from localStorage
 */
export const clearSessionExpiration = () => {
    localStorage.removeItem(SESSION_EXPIRY_KEY);
};

/**
 * Calculate seconds remaining until session expires
 * @returns number of seconds remaining (0 if expired or not set)
 */
export const getSecondsUntilExpiration = (): number => {
    const expiry = getSessionExpiration();
    const isValidDate = expiry instanceof Date && !isNaN(expiry.getTime());
    
    if (!expiry || !isValidDate) {
        return 0;
    }
    
    const now = Date.now();
    const expiryTime = expiry.getTime();
    const seconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
    
    return seconds;
};