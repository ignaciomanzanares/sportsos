-- Badge de "Clubes" en el sidebar del superadmin

alter table club_requests add column if not exists visto boolean not null default false;

drop policy if exists "superadmin marks club requests seen" on club_requests;
create policy "superadmin marks club requests seen" on club_requests for update using (is_superadmin());

-- Verificación
select column_name from information_schema.columns
where table_name = 'club_requests' and column_name = 'visto';
