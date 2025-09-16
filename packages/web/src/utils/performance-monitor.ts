import { frontendLogger } from './logger';

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration?: number;
  context?: Record<string, any>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private activeTimers: Map<string, PerformanceEntry> = new Map();
  private isSupported: boolean;

  private constructor() {
    this.isSupported = typeof performance !== 'undefined' && 'mark' in performance;
    this.setupWebVitalsMonitoring();
    this.setupNavigationTiming();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing a performance metric
   */
  public startTimer(name: string, context?: Record<string, any>): void {
    if (!this.isSupported) return;

    const entry: PerformanceEntry = {
      name,
      startTime: performance.now(),
      context,
    };

    this.activeTimers.set(name, entry);
    performance.mark(`${name}-start`);

    frontendLogger.debug(`Performance timer started: ${name}`, {
      component: 'performance_monitor',
      operation: 'timer_start',
      metric: name,
      ...context,
    });
  }

  /**
   * End timing and log the performance metric
   */
  public endTimer(name: string, additionalContext?: Record<string, any>): number | null {
    if (!this.isSupported) return null;

    const entry = this.activeTimers.get(name);
    if (!entry) {
      frontendLogger.warn(`Performance timer not found: ${name}`, {
        component: 'performance_monitor',
        operation: 'timer_end_error',
      });
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const context = {
      ...entry.context,
      ...additionalContext,
      component: 'performance_monitor',
      operation: 'timer_end',
    };

    frontendLogger.logPerformance(name, Math.round(duration), context);
    this.activeTimers.delete(name);

    return duration;
  }

  /**
   * Log a single performance measurement
   */
  public logMetric(name: string, value: number, context?: Record<string, any>): void {
    frontendLogger.logPerformance(name, value, {
      component: 'performance_monitor',
      ...context,
    });
  }

  /**
   * Set up Web Vitals monitoring (Core Web Vitals)
   */
  private setupWebVitalsMonitoring(): void {
    if (!this.isSupported) return;

    // Monitor navigation timing after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        if ('getEntriesByType' in performance) {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          if (navigation) {
            this.logMetric('page_load_time', Math.round(navigation.loadEventEnd - navigation.navigationStart), {
              metric_type: 'navigation',
              description: 'Total page load time',
            });
          }
        }
      }, 1000);
    });
  }

  /**
   * Set up navigation timing monitoring
   */
  private setupNavigationTiming(): void {
    if (!this.isSupported || !('getEntriesByType' in performance)) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          // Time to First Byte
          this.logMetric('navigation_ttfb', Math.round(navigation.responseStart - navigation.requestStart), {
            metric_type: 'navigation',
            description: 'Time to First Byte',
          });

          // DOM Content Loaded
          this.logMetric('navigation_dom_content_loaded', Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart), {
            metric_type: 'navigation',
            description: 'DOM Content Loaded Time',
          });
        }
      }, 1000);
    });
  }

  /**
   * Get current performance statistics
   */
  public getStats(): Record<string, any> {
    const stats = {
      activeTimers: this.activeTimers.size,
      isSupported: this.isSupported,
      memory: null as any,
    };

    // Add memory info if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      stats.memory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    return stats;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Convenience functions
export const startTimer = (name: string, context?: Record<string, any>) => 
  performanceMonitor.startTimer(name, context);

export const endTimer = (name: string, additionalContext?: Record<string, any>) => 
  performanceMonitor.endTimer(name, additionalContext);