-- Arregla "relation profiles does not exist" en signup: las funciones
-- SECURITY DEFINER necesitan search_path explícito porque el servicio de
-- Auth las dispara en un contexto sin "public" en el search_path por
-- defecto. Correr esto soluciona el signup roto.

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, rol, club_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'jugador'),
    (new.raw_user_meta_data->>'club_id')::uuid
  );
  return new;
end;
$$;

create or replace function my_club_id()
returns uuid language sql stable
set search_path = public as $$
  select club_id from public.profiles where id = auth.uid()
$$;

create or replace function is_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'superadmin')
$$;

create or replace function current_profile_snapshot()
returns table(rol text, club_id uuid, plan text)
language sql stable security definer
set search_path = public as $$
  select rol, club_id, plan from public.profiles where id = auth.uid()
$$;

create or replace function lookup_club_by_code(p_code text)
returns table(id uuid, name text, sport text)
language sql security definer stable
set search_path = public as $$
  select id, name, sport from public.clubs where join_code = upper(p_code);
$$;

create or replace function accept_invitation(p_token text)
returns table(rol text, club_id uuid, club_name text, sport text, cats text, player_id uuid)
language plpgsql security definer
set search_path = public as $$
declare
  inv record;
begin
  select * into inv from public.invitations where token = p_token;

  if inv.id is null then
    raise exception 'invitacion_no_encontrada';
  end if;
  if inv.used_at is not null then
    raise exception 'invitacion_ya_usada';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitacion_expirada';
  end if;

  update public.profiles
    set rol = inv.rol, club_id = inv.club_id, invited_by = inv.created_by
    where id = auth.uid();

  if inv.player_id is not null then
    update public.players set profile_id = auth.uid() where id = inv.player_id;
  end if;

  update public.invitations set used_at = now() where id = inv.id;

  return query
    select inv.rol, inv.club_id, c.name, c.sport, inv.cats, inv.player_id
    from public.clubs c where c.id = inv.club_id;
end;
$$;

create or replace function claim_new_club_admin(p_club_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if exists (select 1 from public.profiles where club_id = p_club_id and rol = 'admin') then
    raise exception 'club_ya_tiene_admin';
  end if;
  update public.profiles set rol = 'admin', club_id = p_club_id where id = auth.uid();
end;
$$;
