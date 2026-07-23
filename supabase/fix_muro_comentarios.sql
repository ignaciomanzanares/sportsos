-- El Muro: comentarios reales (la tabla no existía, useComments.js siempre
-- fallaba en silencio contra un club real) + columna de tarjetas en matches
-- (se armaban al publicar resultado pero se descartaban silenciosamente).

create table if not exists post_comments (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid not null references posts(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  author_id   uuid references profiles(id),
  author_name text not null,
  text        text not null,
  created_at  timestamptz default now()
);

alter table post_comments enable row level security;

drop policy if exists "club post comments" on post_comments;
create policy "club post comments" on post_comments for all using (club_id = my_club_id());

alter table matches add column if not exists tarjetas jsonb default '[]';

-- Verificación
select table_name from information_schema.tables where table_name = 'post_comments';
select column_name from information_schema.columns where table_name='matches' and column_name='tarjetas';
