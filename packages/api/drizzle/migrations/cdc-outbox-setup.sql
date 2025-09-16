-- Migration: CDC-Outbox Setup
-- Adds message publishing capabilities to CDC audit tables

-- Create enums for message status and priority
DO $$ BEGIN
  CREATE TYPE message_status AS ENUM (
    'pending',
    'published', 
    'failed',
    'processing',
    'dead'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_priority AS ENUM (
    'low',
    'normal',
    'high', 
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cdc_operation AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Function to add outbox fields to CDC tables
CREATE OR REPLACE FUNCTION add_outbox_fields_to_cdc_table(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  full_table_name TEXT := '_cdc_' || table_name;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = full_table_name
  ) THEN
    RAISE NOTICE 'CDC table % does not exist, skipping...', full_table_name;
    RETURN;
  END IF;

  -- Add outbox-specific fields
  EXECUTE format('
    ALTER TABLE %I ADD COLUMN IF NOT EXISTS 
      -- Message identification
      message_id UUID DEFAULT gen_random_uuid(),
      
      -- Message routing  
      topic VARCHAR(255),
      routing_key VARCHAR(255),
      
      -- Message processing
      message_status message_status DEFAULT ''pending'',
      message_priority message_priority DEFAULT ''normal'',
      
      -- Retry logic
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      next_retry_at TIMESTAMP WITH TIME ZONE,
      
      -- Publishing timestamps
      message_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      published_at TIMESTAMP WITH TIME ZONE,
      failed_at TIMESTAMP WITH TIME ZONE,
      last_error TEXT,
      
      -- Tracing
      correlation_id VARCHAR(255),
      causation_id VARCHAR(255),
      
      -- Publisher metadata
      publisher_id VARCHAR(100),
      external_message_id VARCHAR(255)
  ', full_table_name);

  -- Create index for efficient message polling
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_message_status_priority 
    ON %I (message_status, message_priority, message_created_at)
    WHERE message_status IN (''pending'', ''failed'')
  ', full_table_name, full_table_name);

  -- Create index for correlation tracking
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_correlation_id 
    ON %I (correlation_id) 
    WHERE correlation_id IS NOT NULL
  ', full_table_name, full_table_name);

  RAISE NOTICE 'Added outbox fields to CDC table: %', full_table_name;
END;
$$ LANGUAGE plpgsql;

-- Add outbox fields to all existing CDC tables
DO $$
DECLARE
  cdc_table RECORD;
BEGIN
  -- Get all CDC tables (those starting with _cdc_)
  FOR cdc_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '\_cdc\_%'
  LOOP
    -- Extract the base table name (remove _cdc_ prefix)
    PERFORM add_outbox_fields_to_cdc_table(
      substring(cdc_table.table_name from 6)  -- Remove '_cdc_' prefix
    );
  END LOOP;
END $$;

-- Create configuration loading function
CREATE OR REPLACE FUNCTION load_cdc_outbox_config()
RETURNS TABLE(
  table_name TEXT,
  enabled BOOLEAN,
  topic VARCHAR(255),
  routing_pattern TEXT,
  priority message_priority,
  max_retries INTEGER,
  include_old_data BOOLEAN,
  include_new_data BOOLEAN,
  exclude_fields TEXT[]
) AS $$
BEGIN
  -- This would typically load from YAML config, but for now return defaults
  -- In practice, you'd parse the cdc-outbox.yml file or store config in a table
  
  RETURN QUERY
  WITH config AS (
    SELECT 
      'users'::TEXT as tbl, true as en, 'user.lifecycle'::VARCHAR(255) as tp, 
      '{operation}'::TEXT as rp, 'high'::message_priority as pr, 5 as mr,
      false as iod, true as ind, ARRAY['password', 'salt']::TEXT[] as ef
    UNION ALL
    SELECT 'roles', true, 'access.management', '{operation}', 'high'::message_priority, 5, true, true, ARRAY[]::TEXT[]
    UNION ALL  
    SELECT 'permissions', true, 'access.management', '{operation}', 'high'::message_priority, 5, true, true, ARRAY[]::TEXT[]
    UNION ALL
    SELECT 'permissionsUsersMap', true, 'access.control', '{operation}', 'critical'::message_priority, 10, true, true, ARRAY[]::TEXT[]
    UNION ALL
    SELECT 'usersRolesMap', true, 'access.control', '{operation}', 'critical'::message_priority, 10, true, true, ARRAY[]::TEXT[]
    UNION ALL
    SELECT 'permissionsRolesMap', true, 'access.control', '{operation}', 'critical'::message_priority, 10, true, true, ARRAY[]::TEXT[]
    -- Add more table configs as needed...
  )
  SELECT tbl, en, tp, rp, pr, mr, iod, ind, ef FROM config;
END;
$$ LANGUAGE plpgsql;

-- Create the main CDC-Outbox trigger function
CREATE OR REPLACE FUNCTION cdc_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
  config_row RECORD;
  message_topic VARCHAR(255);
  message_routing VARCHAR(255);
  message_priority message_priority := 'normal';
  message_max_retries INTEGER := 3;
  correlation_id_val VARCHAR(255);
  source_table TEXT;
  operation_type TEXT;
BEGIN
  -- Extract source table name from CDC table name (_cdc_tablename -> tablename)
  source_table := substring(TG_TABLE_NAME from 6);
  operation_type := TG_OP;
  
  -- Load configuration for this table
  SELECT * INTO config_row 
  FROM load_cdc_outbox_config() 
  WHERE table_name = source_table;
  
  -- Use config or defaults
  IF FOUND AND config_row.enabled THEN
    message_topic := config_row.topic;
    message_routing := replace(config_row.routing_pattern, '{operation}', operation_type);
    message_priority := config_row.priority;
    message_max_retries := config_row.max_retries;
  ELSE
    -- Default configuration for tables not in config
    message_topic := 'database.changes';
    message_routing := source_table || '.' || operation_type;
    message_priority := 'normal';
    message_max_retries := 3;
  END IF;
  
  -- Generate correlation ID
  correlation_id_val := gen_random_uuid()::TEXT;
  
  -- Set outbox fields
  NEW.topic := message_topic;
  NEW.routing_key := message_routing;
  NEW.message_priority := message_priority;
  NEW.max_retries := message_max_retries;
  NEW.correlation_id := correlation_id_val;
  NEW.message_created_at := NOW();
  NEW.message_status := 'pending';
  NEW.retry_count := 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to add trigger to CDC table
CREATE OR REPLACE FUNCTION add_cdc_outbox_trigger(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  full_table_name TEXT := '_cdc_' || table_name;
  trigger_name TEXT := 'cdc_outbox_trigger_' || table_name;
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = full_table_name
  ) THEN
    RAISE NOTICE 'CDC table % does not exist, skipping trigger...', full_table_name;
    RETURN;
  END IF;

  -- Drop trigger if exists
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, full_table_name);
  
  -- Create trigger
  EXECUTE format('
    CREATE TRIGGER %I
    BEFORE INSERT ON %I
    FOR EACH ROW
    EXECUTE FUNCTION cdc_outbox_trigger()
  ', trigger_name, full_table_name);
  
  RAISE NOTICE 'Added CDC-Outbox trigger to table: %', full_table_name;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all existing CDC tables
DO $$
DECLARE
  cdc_table RECORD;
BEGIN
  FOR cdc_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '\_cdc\_%'
  LOOP
    PERFORM add_cdc_outbox_trigger(
      substring(cdc_table.table_name from 6)
    );
  END LOOP;
END $$;

-- Create maintenance functions
CREATE OR REPLACE FUNCTION cleanup_published_cdc_messages(older_than_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  total_deleted INTEGER := 0;
  table_deleted INTEGER;
  cdc_table RECORD;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (older_than_days || ' days')::INTERVAL;
  
  FOR cdc_table IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '\_cdc\_%'
  LOOP
    EXECUTE format('
      DELETE FROM %I 
      WHERE message_status = ''published'' 
      AND published_at < $1
    ', cdc_table.table_name) 
    USING cutoff_date;
    
    GET DIAGNOSTICS table_deleted = ROW_COUNT;
    total_deleted := total_deleted + table_deleted;
    
    IF table_deleted > 0 THEN
      RAISE NOTICE 'Cleaned up % published messages from %', table_deleted, cdc_table.table_name;
    END IF;
  END LOOP;
  
  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Create message statistics function
CREATE OR REPLACE FUNCTION get_cdc_outbox_stats()
RETURNS TABLE(
  table_name TEXT,
  pending INTEGER,
  processing INTEGER,
  published INTEGER,
  failed INTEGER,
  dead INTEGER,
  total INTEGER
) AS $$
DECLARE
  cdc_table RECORD;
BEGIN
  FOR cdc_table IN 
    SELECT table_name as tname
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '\_cdc\_%'
  LOOP
    RETURN QUERY
    EXECUTE format('
      SELECT 
        ''%s''::TEXT as table_name,
        COUNT(*) FILTER (WHERE message_status = ''pending'')::INTEGER as pending,
        COUNT(*) FILTER (WHERE message_status = ''processing'')::INTEGER as processing,
        COUNT(*) FILTER (WHERE message_status = ''published'')::INTEGER as published,
        COUNT(*) FILTER (WHERE message_status = ''failed'')::INTEGER as failed,
        COUNT(*) FILTER (WHERE message_status = ''dead'')::INTEGER as dead,
        COUNT(*)::INTEGER as total
      FROM %I
      WHERE message_status IS NOT NULL
    ', cdc_table.tname, cdc_table.tname);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'CDC-Outbox setup completed successfully!' as status;