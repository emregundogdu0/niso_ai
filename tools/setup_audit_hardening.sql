-- Extended Audit Schema for Security, Feedback and Analytics
CREATE SCHEMA IF NOT EXISTS audit;

-- 1. Extend audit.chat_request Table
ALTER TABLE audit.chat_request
  ADD COLUMN IF NOT EXISTS redacted_question text,
  ADD COLUMN IF NOT EXISTS question_hash text,
  ADD COLUMN IF NOT EXISTS intent_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS model_name text DEFAULT 'qwen3.5:9b',
  ADD COLUMN IF NOT EXISTS route_used text,
  ADD COLUMN IF NOT EXISTS provider_filter text DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS source_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_sql text,
  ADD COLUMN IF NOT EXISTS sql_fingerprint text,
  ADD COLUMN IF NOT EXISTS sql_row_count integer,
  ADD COLUMN IF NOT EXISTS input_token_estimate integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_token_estimate integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS security_flags jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_feedback text;

CREATE INDEX IF NOT EXISTS idx_audit_chat_question_hash ON audit.chat_request(question_hash);
CREATE INDEX IF NOT EXISTS idx_audit_chat_intent ON audit.chat_request(intent);
CREATE INDEX IF NOT EXISTS idx_audit_chat_status ON audit.chat_request(status);
CREATE INDEX IF NOT EXISTS idx_audit_chat_created_at ON audit.chat_request(created_at);

-- 2. Create audit.security_event Table
CREATE TABLE IF NOT EXISTS audit.security_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid,
  event_type text NOT NULL, -- 'PROMPT_INJECTION', 'SQL_VIOLATION', 'RATE_LIMIT_EXCEEDED', 'UNAUTHORIZED_ACCESS'
  severity text NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  route text,
  provider text,
  description text,
  action_taken text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_event_type ON audit.security_event(event_type);
CREATE INDEX IF NOT EXISTS idx_security_event_severity ON audit.security_event(severity);
CREATE INDEX IF NOT EXISTS idx_security_event_created_at ON audit.security_event(created_at);
