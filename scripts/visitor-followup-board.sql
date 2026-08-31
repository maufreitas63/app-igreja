-- Painel da Régua de Acolhimento: jornadas ativas com os 3 passos (D+1, D+4, D+8).

create or replace function public.list_visitor_followup_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_today date := public.visitor_followup_today();
begin
  if not public.session_can_manage_visitor_followup_welcome() then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para a régua de acolhimento.');
  end if;

  return jsonb_build_object(
    'success', true,
    'today', v_today,
    'journeys',
    coalesce(
      (
        select jsonb_agg(j.item order by j.data_aprovacao desc, j.visitor_name)
        from (
          select
            jsonb_build_object(
              'followup_id', f.id,
              'visitor_id', f.visitor_id,
              'visitor_name', coalesce(nullif(trim(p.full_name), ''), 'Visitante'),
              'phone', p.phone,
              'status', f.status,
              'data_aprovacao', f.data_aprovacao,
              'resultado', f.resultado,
              'tasks', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', t.id,
                      'tipo_tarefa', t.tipo_tarefa,
                      'data_programada', t.data_programada,
                      'status', t.status,
                      'descricao', t.descricao,
                      'responsavel_cargo', t.responsavel_cargo,
                      'due', (
                        t.status = 'Pendente'
                        and t.responsavel_cargo = 'welcome_team'
                        and t.data_programada <= v_today
                      )
                    )
                    order by t.data_programada, t.tipo_tarefa
                  )
                  from public.task_alerts t
                  where t.followup_id = f.id
                    and t.tenant_id = f.tenant_id
                ),
                '[]'::jsonb
              )
            ) as item,
            f.data_aprovacao,
            coalesce(p.full_name, '') as visitor_name
          from public.visitor_followup f
          join public.profiles p
            on p.id = f.visitor_id
           and p.tenant_id = f.tenant_id
         where f.tenant_id = v_tenant
           and f.status = 'Ativo'
        ) j
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_visitor_followup_board() to anon, authenticated;

notify pgrst, 'reload schema';
