-- Schema for Provider-Independent Email Ingestion & Auditing
CREATE SCHEMA IF NOT EXISTS mail;
CREATE SCHEMA IF NOT EXISTS rag;

-- 1. Mailbox Sources Table
CREATE TABLE IF NOT EXISTS mail.mailbox_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- 'GMAIL', 'OUTLOOK'
  mailbox_address text,
  credential_reference text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert Initial Mailbox Sources
INSERT INTO mail.mailbox_source (provider, mailbox_address, credential_reference, is_active)
VALUES 
  ('GMAIL', 'eldornisoai@gmail.com', 'Gmail Eldor Niso AI', true),
  ('OUTLOOK', NULL, 'Outlook Company Bot', false)
ON CONFLICT DO NOTHING;

-- 2. Ingestion Event Audit Table
CREATE TABLE IF NOT EXISTS mail.ingestion_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- 'GMAIL', 'OUTLOOK'
  mailbox_address text,
  provider_message_id text NOT NULL,
  provider_thread_id text,
  internet_message_id text,
  from_address text,
  to_addresses jsonb DEFAULT '[]'::jsonb,
  cc_addresses jsonb DEFAULT '[]'::jsonb,
  subject text,
  received_at timestamptz,
  delivery_mode text, -- 'DIRECT_TO', 'CC', 'BCC_OR_UNDISCLOSED', 'FORWARDED', 'REPLY_THREAD', 'UNKNOWN_DELIVERY'
  labels_or_categories jsonb DEFAULT '[]'::jsonb,
  is_business_related boolean,
  classification text,
  classification_confidence numeric(4,3),
  decision text NOT NULL, -- 'ACCEPTED_BUSINESS', 'REJECTED_ADVERTISEMENT', 'REJECTED_NEWSLETTER', 'REJECTED_SOCIAL', 'REJECTED_PERSONAL', 'REJECTED_SPAM', 'REJECTED_OTHER', 'MANUAL_REVIEW', 'DUPLICATE', 'PROCESSING_ERROR'
  reason text,
  project_code text,
  content_hash text,
  suspected_prompt_injection boolean DEFAULT false,
  requires_manual_review boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz DEFAULT now(),
  CONSTRAINT uq_mail_ingestion_provider_msg UNIQUE (provider, mailbox_address, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_mail_ingestion_internet_msg_id ON mail.ingestion_event(internet_message_id);
CREATE INDEX IF NOT EXISTS idx_mail_ingestion_content_hash ON mail.ingestion_event(content_hash);
CREATE INDEX IF NOT EXISTS idx_mail_ingestion_decision ON mail.ingestion_event(decision);
CREATE INDEX IF NOT EXISTS idx_mail_ingestion_project_code ON mail.ingestion_event(project_code);
CREATE INDEX IF NOT EXISTS idx_mail_ingestion_processed_at ON mail.ingestion_event(processed_at);

-- 3. RAG Documents Table for Business Emails
CREATE TABLE IF NOT EXISTS rag.document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL, -- 'EMAIL', 'POLICY', 'MANUAL'
  source_provider text, -- 'GMAIL', 'OUTLOOK', 'HR_POLICY'
  external_id text, -- provider_message_id
  title text NOT NULL, -- subject
  project_code text,
  sender_address text,
  received_at timestamptz,
  content_hash text NOT NULL,
  sensitivity text DEFAULT 'INTERNAL',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_document_project_code ON rag.document(project_code);
CREATE INDEX IF NOT EXISTS idx_rag_document_source_type ON rag.document(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_document_content_hash ON rag.document(content_hash);

-- 4. RAG Document Chunks with PGVector (Standard rag.chunk Table)
CREATE TABLE IF NOT EXISTS rag.chunk (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES rag.document(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  embedding_model text NOT NULL DEFAULT 'qwen3-embedding:0.6b',
  embedding_dimension integer NOT NULL DEFAULT 1024,
  embedding vector(1024) NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunk_embedding_hnsw ON rag.chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_chunk_document_id ON rag.chunk(document_id);
