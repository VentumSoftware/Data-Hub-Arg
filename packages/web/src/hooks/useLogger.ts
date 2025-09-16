import { useCallback } from 'react';
import { frontendLogger, LogContext } from '../utils/logger';

interface UseLoggerReturn {
  logInfo: (message: string, context?: LogContext) => void;
  logWarn: (message: string, context?: LogContext) => void;
  logError: (message: string, error?: Error, context?: LogContext) => void;
  logDebug: (message: string, context?: LogContext) => void;
  logUserAction: (action: string, details?: any, context?: LogContext) => void;
  logPageView: (page: string, context?: LogContext) => void;
  logApiCall: (method: string, url: string, duration: number, status: number, context?: LogContext) => void;
  logPerformance: (metric: string, value: number, context?: LogContext) => void;
}

/**
 * Hook for logging in React components
 * Provides a convenient interface to the frontend logger
 */
export const useLogger = (defaultContext?: LogContext): UseLoggerReturn => {
  
  const logInfo = useCallback((message: string, context?: LogContext) => {
    frontendLogger.info(message, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logWarn = useCallback((message: string, context?: LogContext) => {
    frontendLogger.warn(message, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logError = useCallback((message: string, error?: Error, context?: LogContext) => {
    frontendLogger.error(message, error, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logDebug = useCallback((message: string, context?: LogContext) => {
    frontendLogger.debug(message, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logUserAction = useCallback((action: string, details?: any, context?: LogContext) => {
    frontendLogger.logUserAction(action, details, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logPageView = useCallback((page: string, context?: LogContext) => {
    frontendLogger.logPageView(page, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logApiCall = useCallback((method: string, url: string, duration: number, status: number, context?: LogContext) => {
    frontendLogger.logApiCall(method, url, duration, status, { ...defaultContext, ...context });
  }, [defaultContext]);

  const logPerformance = useCallback((metric: string, value: number, context?: LogContext) => {
    frontendLogger.logPerformance(metric, value, { ...defaultContext, ...context });
  }, [defaultContext]);

  return {
    logInfo,
    logWarn,
    logError,
    logDebug,
    logUserAction,
    logPageView,
    logApiCall,
    logPerformance,
  };
};