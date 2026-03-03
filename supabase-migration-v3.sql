-- CNTEMUP Migration v3: Container types, session validation, verification slips
-- Run this in Supabase SQL Editor

-- Container type for multi-rate states (CA, ME, VT)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS container_type text DEFAULT 'standard';

-- Session timing + validation
ALTER TABLE counting_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE counting_sessions ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE counting_sessions ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false;
ALTER TABLE counting_sessions ADD COLUMN IF NOT EXISTS flag_reason text;

-- Verification slips table
CREATE TABLE IF NOT EXISTS session_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES counting_sessions(id),
  user_id uuid REFERENCES auth.users(id),
  image_url text NOT NULL,
  status text DEFAULT 'pending', -- pending, verified, rejected
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by text
);

-- RLS for session_verifications
ALTER TABLE session_verifications ENABLE ROW LEVEL SECURITY;

-- Users can insert their own verifications
CREATE POLICY "Users can insert own verifications" ON session_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own verifications
CREATE POLICY "Users can view own verifications" ON session_verifications
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes for leaderboard weekly queries and flagged sessions
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON counting_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_flagged ON counting_sessions(is_flagged);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON session_verifications(status);
