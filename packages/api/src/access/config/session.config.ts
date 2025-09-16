// Session configuration helper
export const SessionConfig = {
  /**
   * Get session expiration time in minutes
   */
  getExpirationMinutes(): number {
    return parseInt(process.env.SESSION_EXPIRATION_MINUTES || '2'); // Changed to 2 minutes for testing
  },

  /**
   * Get session expiration time in milliseconds
   */
  getExpirationMs(): number {
    return this.getExpirationMinutes() * 60 * 1000;
  },

  /**
   * Get session update interval in minutes (combined activity update and refresh check)
   */
  getUpdateIntervalMinutes(): number {
    return parseInt(process.env.SESSION_UPDATE_INTERVAL_MINUTES || '1');
  },

  /**
   * Get session update interval in milliseconds
   */
  getUpdateIntervalMs(): number {
    return this.getUpdateIntervalMinutes() * 60 * 1000;
  },

  /**
   * Get refresh threshold as half of session expiration time (in milliseconds)
   * Sessions will auto-refresh when less than this time remains
   */
  getRefreshThresholdMs(): number {
    return this.getExpirationMs() / 2;
  },

  /**
   * Get all session configuration as an object
   */
  getConfig() {
    return {
      expirationMinutes: this.getExpirationMinutes(),
      expirationMs: this.getExpirationMs(),
      updateIntervalMinutes: this.getUpdateIntervalMinutes(),
      updateIntervalMs: this.getUpdateIntervalMs(),
      refreshThresholdMs: this.getRefreshThresholdMs(),
    };
  }
};