create extension if not exists vector;

create table if not exists project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  document_type text null check (
    document_type in (
      'title_commitment',
      'deed',
      'easement',
      'plat',
      'survey',
      'legal_description',
      'attorney_letter',
      'utility_letter',
      'planning_comment',
      'drainage_report',
      'unknown'
    )
  ),
  title text null,
  source text null,
  recording_date date null,
  reception_number text null,
  book_page text null,
  parsed_status text not null default 'pending',
  extraction_status text not null default 'pending',
  indexed_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references project_documents(id) on delete cascade,
  page_number integer not null,
  text_content text null,
  ocr_confidence numeric null,
  parse_method text not null,
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references project_documents(id) on delete cascade,
  page_start integer null,
  page_end integer null,
  chunk_index integer not null,
  chunk_text text not null,
  token_count integer null,
  heading text null,
  section_label text null,
  created_at timestamptz not null default now()
);

create table if not exists document_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references document_chunks(id) on delete cascade,
  embedding_model text not null,
  embedding vector(768) null,
  created_at timestamptz not null default now()
);

create table if not exists document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references project_documents(id) on delete cascade,
  extraction_type text not null,
  model_name text not null,
  schema_version text not null,
  extracted_json jsonb not null,
  confidence numeric null,
  warnings jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists document_ai_findings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_id uuid null references project_documents(id) on delete set null,
  finding_type text not null,
  severity text not null,
  title text not null,
  explanation text not null,
  supporting_chunk_ids uuid[] null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists document_qa_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  question text not null,
  answer text not null,
  cited_chunk_ids uuid[] not null default '{}',
  model_name text not null,
  retrieval_k integer not null,
  prompt_tokens integer null,
  completion_tokens integer null,
  latency_ms integer null,
  created_at timestamptz not null default now()
);

create table if not exists document_eval_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  question text not null,
  expected_answer text null,
  expected_citation_hint text null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists document_eval_runs (
  id uuid primary key default gen_random_uuid(),
  eval_case_id uuid not null references document_eval_cases(id) on delete cascade,
  model_name text not null,
  answer text not null,
  cited_chunk_ids uuid[] not null default '{}',
  score numeric null,
  pass boolean null,
  notes text null,
  latency_ms integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_documents_project_id on project_documents(project_id);
create index if not exists idx_document_pages_document_id_page_number on document_pages(document_id, page_number);
create index if not exists idx_document_chunks_document_id_chunk_index on document_chunks(document_id, chunk_index);
create index if not exists idx_document_extractions_document_id_type on document_extractions(document_id, extraction_type);
create index if not exists idx_document_ai_findings_project_severity_status on document_ai_findings(project_id, severity, status);
create index if not exists idx_document_qa_runs_project_created_at on document_qa_runs(project_id, created_at desc);
