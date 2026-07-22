-- Borra las tablas huérfanas de un prototipo viejo de Woof Palace que
-- quedaron en el proyecto de Supabase de SportOS por error. Verificado:
-- todas las relaciones (FK) están encerradas dentro de este mismo grupo,
-- ninguna toca tablas de SportOS. Todas las tablas de negocio estaban
-- vacías (0 clientes, 0 perros, 0 reservas, 0 contratos) — solo había
-- datos de referencia (14 razas, 25 jaulas) y 1 usuario de prueba.

drop table if exists reports cascade;
drop table if exists contracts cascade;
drop table if exists reservations cascade;
drop table if exists kennel_notes cascade;
drop table if exists todos cascade;
drop table if exists kennels cascade;
drop table if exists dogs cascade;
drop table if exists caregivers cascade;
drop table if exists clients cascade;
drop table if exists breeds cascade;
drop table if exists users cascade;

-- Verificación: no debe devolver ninguna fila
select table_name from information_schema.tables
where table_name in ('breeds','caregivers','clients','contracts','dogs','kennel_notes','kennels','reports','reservations','todos','users');
