import { config } from 'dotenv';
import { CDCOutboxPublisher } from './publisher';
import { createLogger } from './utils/logger';
import { gracefulShutdown } from './utils/shutdown';

// Load environment variables
config();

const logger = createLogger('Main');

async function main() {
  logger.info('🚀 Starting CDC-Outbox Message Publisher Service');
  
  // Create and start publisher
  const publisher = new CDCOutboxPublisher();
  
  try {
    // Initialize connections and start processing
    await publisher.start();
    
    logger.info('✅ Message Publisher Service started successfully');
    
    // Setup graceful shutdown
    gracefulShutdown(async () => {
      logger.info('🛑 Shutting down Message Publisher Service...');
      await publisher.stop();
      logger.info('👋 Message Publisher Service stopped');
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start Message Publisher Service');
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  logger.error({ error }, 'Unhandled error in main');
  process.exit(1);
});