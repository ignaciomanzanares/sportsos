alter table matches add column if not exists hora       text;
alter table matches add column if not exists estado     text default 'programado';
alter table matches add column if not exists equipo     text default 'A';
alter table matches add column if not exists cat        text;
alter table matches add column if not exists destacados jsonb default '[]';
alter table matches add column if not exists autor      text;

select column_name from information_schema.columns
where table_name='matches' and column_name in ('hora','estado','equipo','cat','destacados','autor');
