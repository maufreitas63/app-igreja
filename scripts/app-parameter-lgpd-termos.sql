-- Parâmetro por instância: texto completo do consentimento LGPD.
-- Lido por lib/lgpdTerms.ts (LGPD_Termos) via get_app_parameter_value.
-- Editável no Controle de Acesso (manutenção), mesmo fluxo de app_parameters.
--
-- Seed: monta o texto atual de buildLgpdTermsText (Nome_Entidade / nome da igreja + sufixo).

insert into public.app_parameters (tenant_id, parameter, value)
select
  i.id,
  'LGPD_Termos',
  'A '
    || coalesce(
      nullif(trim(ne.value), ''),
      nullif(trim(i.name), ''),
      'igreja'
    )
    || ' respeita a privacidade de seus membros e visitantes, comprometendo-se a coletar e tratar os dados estritamente necessários para gestão administrativa, controle de segurança, atividades eclesiásticas e para a divulgação de eventos e ações da igreja em mídias sociais e outros veículos oficiais de comunicação, sempre em estrita observância à Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).'
from public.igrejas i
left join lateral (
  select ap.value
    from public.app_parameters ap
   where ap.tenant_id = i.id
     and lower(trim(ap.parameter)) = 'nome_entidade'
   order by case when ap.parameter = 'Nome_Entidade' then 0 else 1 end
   limit 1
) ne on true
where not exists (
  select 1
    from public.app_parameters ap
   where ap.tenant_id = i.id
     and lower(trim(ap.parameter)) = 'lgpd_termos'
);

notify pgrst, 'reload schema';
