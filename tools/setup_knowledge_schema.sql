-- Schema and Table for NISO & Eldor Company Knowledge Base
CREATE SCHEMA IF NOT EXISTS knowledge;

CREATE TABLE IF NOT EXISTS knowledge.company_doc_chunk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc text NOT NULL,
  section text NOT NULL, -- 'NISO' or 'ELDOR'
  page_number integer,
  page_title text NOT NULL,
  url text,
  chunk_index integer NOT NULL,
  chunk_content text NOT NULL,
  token_estimate integer NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_doc_chunk_embedding ON knowledge.company_doc_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_company_doc_chunk_section ON knowledge.company_doc_chunk(section);
CREATE INDEX IF NOT EXISTS idx_company_doc_chunk_page_title ON knowledge.company_doc_chunk(page_title);
