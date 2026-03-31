-- Kampaign.ai — AI-native campaign engine
-- Migration 001: add campaign_name, drop FK, create registry + action_log
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Add campaign_name to existing campaign_metrics table
ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);

-- 2. Drop the foreign key constraint on campaign_id
--    (find the exact name first if the line below fails)
ALTER TABLE campaign_metrics
  DROP CONSTRAINT IF EXISTS campaign_metrics_campaign_id_fkey;

-- If the above fails, find the real constraint name with:
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'campaign_metrics' AND constraint_type = 'FOREIGN KEY';
-- Then run: ALTER TABLE campaign_metrics DROP CONSTRAINT <name>;

-- 3. New tables are created automatically by SQLAlchemy create_all on startup.
--    Run these only if startup create_all is not working:

CREATE TABLE IF NOT EXISTS campaign_registry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name  VARCHAR(255) NOT NULL UNIQUE,
    fb_campaign_id VARCHAR(100),
    fb_adset_id    VARCHAR(100),
    fb_status      VARCHAR(50),
    synced_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type    VARCHAR(100) NOT NULL,
    campaign_name  VARCHAR(255) NOT NULL,
    fb_campaign_id VARCHAR(100),
    details        JSONB,
    success        BOOLEAN NOT NULL DEFAULT FALSE,
    result         JSONB,
    executed_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
