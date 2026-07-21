-- Arregla el guardado de "Mi Perfil" (PerfilView.jsx), que fallaba en
-- silencio porque estas columnas no existían en profiles.

alter table profiles add column if not exists telefono                   text;
alter table profiles add column if not exists direccion                  text;
alter table profiles add column if not exists fecha_nacimiento           date;
alter table profiles add column if not exists altura_cm                  numeric(5,2);
alter table profiles add column if not exists peso_kg                    numeric(5,2);
alter table profiles add column if not exists posicion_1                 text;
alter table profiles add column if not exists posicion_2                 text;
alter table profiles add column if not exists seguro_salud               text;
alter table profiles add column if not exists grupo_sanguineo            text;
alter table profiles add column if not exists contacto_emergencia_nombre text;
alter table profiles add column if not exists contacto_emergencia_tel    text;
alter table profiles add column if not exists pie_hab                    text;
alter table profiles add column if not exists numero_camiseta            int;

-- Verificación
select column_name from information_schema.columns
where table_name = 'profiles' and column_name in
  ('telefono','direccion','fecha_nacimiento','altura_cm','peso_kg',
   'posicion_1','posicion_2','seguro_salud','grupo_sanguineo',
   'contacto_emergencia_nombre','contacto_emergencia_tel','pie_hab','numero_camiseta');
