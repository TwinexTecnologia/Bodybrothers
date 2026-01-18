
-- Tabela de Cache de Alimentos (FatSecret)
create table if not exists food_cache (
  food_id text primary key, -- ID do FatSecret
  name text not null,
  calories_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  source text default 'fatsecret',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS
alter table food_cache enable row level security;

-- Leitura pública (autenticados)
create policy "Authenticated users can read food cache"
  on food_cache for select
  to authenticated
  using (true);

-- Inserção pública (autenticados) - O backend function pode usar service role, mas frontend também pode salvar se quisermos cachear direto
create policy "Authenticated users can insert food cache"
  on food_cache for insert
  to authenticated
  with check (true);
