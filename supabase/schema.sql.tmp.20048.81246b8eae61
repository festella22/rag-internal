-- Enable pgvector extension
create extension if not exists vector;

-- Collections (Knowledge Base)
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete cascade,
  is_private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Documents uploaded to collections
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  name text not null,
  file_type text,
  file_size bigint,
  storage_path text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

-- Document chunks with embeddings (OpenAI text-embedding-3-small = 1536 dims)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  chunk_index integer,
  created_at timestamptz default now()
);

-- IVFFlat index for fast approximate nearest-neighbor search
create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  collection_id uuid references collections(id) on delete set null,
  title text default 'New Conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb default '[]',
  created_at timestamptz default now()
);

-- RLS
alter table collections enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Collections policies
create policy "Authenticated users can view collections" on collections
  for select using (auth.uid() is not null);
create policy "Users can create collections" on collections
  for insert with check (auth.uid() = created_by);
create policy "Owners can update collections" on collections
  for update using (auth.uid() = created_by);
create policy "Owners can delete collections" on collections
  for delete using (auth.uid() = created_by);

-- Documents policies
create policy "Authenticated users can view documents" on documents
  for select using (auth.uid() is not null);
create policy "Users can create documents" on documents
  for insert with check (auth.uid() = created_by);
create policy "Owners can delete documents" on documents
  for delete using (auth.uid() = created_by);

-- Chunks policies (service role inserts, users read)
create policy "Authenticated users can read chunks" on document_chunks
  for select using (auth.uid() is not null);
create policy "Service role can insert chunks" on document_chunks
  for insert with check (true);

-- Conversations policies
create policy "Users can view own conversations" on conversations
  for select using (auth.uid() = user_id);
create policy "Users can create conversations" on conversations
  for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on conversations
  for update using (auth.uid() = user_id);
create policy "Users can delete own conversations" on conversations
  for delete using (auth.uid() = user_id);

-- Messages policies
create policy "Users can read messages in own conversations" on messages
  for select using (
    exists (select 1 from conversations where id = conversation_id and user_id = auth.uid())
  );
create policy "Users can insert messages in own conversations" on messages
  for insert with check (
    exists (select 1 from conversations where id = conversation_id and user_id = auth.uid())
  );

-- Vector similarity search function
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  filter_collection_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  collection_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.collection_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where
    case
      when filter_collection_id is not null then dc.collection_id = filter_collection_id
      else true
    end
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
