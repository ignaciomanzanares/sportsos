-- Elimina el club demo "Cerro Alto RC" y todos sus datos asociados.
-- Correr DESPUÉS de haber corrido schema.sql actualizado (necesita el fix
-- de profiles.club_id -> ON DELETE SET NULL para no fallar).
--
-- Cascada: players, matches, attendance, payments, posts, lineups,
-- join_requests, invitations del club se borran solos (ON DELETE CASCADE).
-- Los perfiles de usuarios de ese club quedan con club_id = null (no se
-- borran sus cuentas, solo pierden la asociación al club eliminado).

delete from clubs where id = '00000000-0000-4000-8000-000000000001';

-- Verificación: debe devolver 0 filas
select id, name from clubs where id = '00000000-0000-4000-8000-000000000001';
