-- RAG-laag bovenop markdown_snapshots:
--  - pgvector extension
--  - snapshot_chunks tabel met embedding-kolom + heading-pad voor metadata-filter
--  - HNSW-index voor snelle cosine-similarity search
--  - user_id gedenormaliseerd zodat we user-scoped queries direct kunnen doen
--  - match_snapshot_chunks RPC voor de query-pijp
-- (Migratie al toegepast in Supabase via MCP; deze file dient als
--  checkpoint in de repo.)

create extension if not exists vector;

create table public.snapshot_chunks (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.markdown_snapshots(id) on delete cascade,
  user_id uuid not null,
  chunk_index int not null,
  content text not null,
  source_kind public.markdown_snapshot_kind not null,
  source_url text not null,
  source_filename text,
  heading_path text[] not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index snapshot_chunks_user_idx on public.snapshot_chunks (user_id);
create index snapshot_chunks_snapshot_idx on public.snapshot_chunks (snapshot_id);
create index snapshot_chunks_embedding_hnsw
  on public.snapshot_chunks using hnsw (embedding vector_cosine_ops);

alter table public.snapshot_chunks enable row level security;
create policy "snapshot_chunks authenticated all" on public.snapshot_chunks
  for all to authenticated using (true) with check (true);

create or replace function public.match_snapshot_chunks(
  query_embedding vector(1536),
  match_count int,
  filter_user_id uuid
)
returns table (
  id uuid,
  snapshot_id uuid,
  chunk_index int,
  content text,
  source_kind public.markdown_snapshot_kind,
  source_url text,
  source_filename text,
  heading_path text[],
  similarity float
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.snapshot_id,
    c.chunk_index,
    c.content,
    c.source_kind,
    c.source_url,
    c.source_filename,
    c.heading_path,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.snapshot_chunks c
  where c.user_id = filter_user_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke execute on function public.match_snapshot_chunks(vector, int, uuid) from public, anon;
grant execute on function public.match_snapshot_chunks(vector, int, uuid) to authenticated, service_role;
