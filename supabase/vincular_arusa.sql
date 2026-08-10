-- Vínculo entre el plantel del club y la ficha del jugador en ARUSA.
--
-- Se guarda en vez de calcularse en cada carga: adivinar el emparejamiento por
-- nombre en cada render sería lento y, peor, inestable — el mismo jugador
-- podría quedar apuntando a distinta persona según qué datos estuvieran
-- cargados ese día. Una vez confirmado por una persona, queda.
alter table players add column if not exists arusa_player_id text;

create index if not exists players_arusa_idx on players (arusa_player_id)
  where arusa_player_id is not null;
