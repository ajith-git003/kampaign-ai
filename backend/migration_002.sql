-- Kampaign.ai — AI-native campaign engine
-- Migration 002: add actions_json to insights table
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS actions_json JSONB;
