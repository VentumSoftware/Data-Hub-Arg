import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseSeeder } from './seeders/database-seeder';
import * as schema from './schema';

// Load environment variables
config();

/**
 * Standalone Database Seeding Script
 * Seeds permissions, roles, and initial data based on YAML configurations
 */
export async function seed() {
  console.log('🌱 Starting database seeding...');
  
  // Database connection configuration
  // Use DATABASE_URL if available, otherwise build from individual components
  let dbConfig;
  
  if (process.env.DATABASE_URL) {
    dbConfig = { connectionString: process.env.DATABASE_URL };
  } else {
    const useSSL = (process.env.POSTGRES_SSL || process.env.DDBB_CONNECTION_SSL) === 'true';
    
    dbConfig = {
      host: process.env.POSTGRES_HOST || process.env.DDBB_CONNECTION_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || process.env.DDBB_CONNECTION_PORT || '5432'),
      database: process.env.POSTGRES_DB || process.env.DDBB_CONNECTION_DATABASE || 'app_local',
      user: process.env.POSTGRES_USER || process.env.DDBB_CONNECTION_USER || 'app_user',
      password: process.env.POSTGRES_PASSWORD || process.env.DDBB_CONNECTION_PASSWORD || 'app_password',
      ssl: useSSL ? { rejectUnauthorized: false } : false
    };
  }
  
  const pool = new Pool(dbConfig);
  
  const db = drizzle(pool, { schema });
  const seeder = new DatabaseSeeder(db);

  try {
    // Validate configurations first
    const validation = seeder.validateConfigurations();
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid seed configurations');
    }

    // Run the seeding process
    await seeder.seedAll();
    console.log('✅ Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seed().catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
}