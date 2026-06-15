-- Parâmetro global: prefixo da entidade (códigos familiares, salas Kids/Teens, textos do app).
-- Valor canônico do parâmetro: Parm_entidade (case-insensitive na leitura via RPC).

insert into public.app_parameters (parameter, value)
select 'Parm_entidade', 'IBN'
where not exists (
  select 1
  from public.app_parameters
  where lower(trim(parameter)) = 'parm_entidade'
);

-- Consolida legado `parm_entidade` (minúsculo) no canônico, se houver duplicata.
update public.app_parameters canonical
set value = coalesce(
  nullif(trim(canonical.value), ''),
  nullif(trim(legacy.value), ''),
  'IBN'
)
from public.app_parameters legacy
where lower(trim(canonical.parameter)) = 'parm_entidade'
  and canonical.parameter = 'Parm_entidade'
  and lower(trim(legacy.parameter)) = 'parm_entidade'
  and legacy.parameter <> canonical.parameter;

delete from public.app_parameters legacy
where lower(trim(legacy.parameter)) = 'parm_entidade'
  and legacy.parameter <> 'Parm_entidade'
  and exists (
    select 1
    from public.app_parameters canonical
    where canonical.parameter = 'Parm_entidade'
  );
