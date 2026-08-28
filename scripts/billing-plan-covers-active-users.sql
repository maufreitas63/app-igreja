-- Limite dos planos = usuários ativos (membros + congregados).
-- Pacote com teto menor que a quantidade atual não pode ser assinado.

update public.billing_plans
   set description = case code
         when 'semente' then 'Igrejas em formação — até 50 usuários ativos (membros + congregados)'
         when 'crescimento' then 'Comunidades em expansão — até 200 usuários ativos (membros + congregados)'
         when 'expansao' then 'Igrejas consolidadas — até 1.000 usuários ativos (membros + congregados)'
         when 'ministerio' then 'Operação completa — usuários ativos ilimitados (membros + congregados)'
         else description
       end,
       updated_at = now()
 where code in ('semente', 'crescimento', 'expansao', 'ministerio');

create or replace function public.assert_tenant_can_subscribe_plan(
  p_tenant_id uuid,
  p_plan_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan public.billing_plans%rowtype;
  v_users integer := 0;
begin
  if p_tenant_id is null or coalesce(trim(p_plan_code), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'tenant_id e plan_code são obrigatórios.');
  end if;

  select *
    into v_plan
    from public.billing_plans bp
   where lower(trim(bp.code)) = lower(trim(p_plan_code))
     and bp.is_active = true
   limit 1;

  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'message', 'Plano não encontrado.');
  end if;

  v_users := public.count_tenant_billable_members(p_tenant_id);

  if v_plan.max_members >= 0 and v_users > v_plan.max_members then
    return jsonb_build_object(
      'ok', false,
      'message', format(
        'Este plano comporta até %s usuários ativos. A igreja tem %s (membros + congregados). Escolha um plano maior.',
        v_plan.max_members,
        v_users
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'active_users', v_users, 'max_members', v_plan.max_members);
end;
$$;

comment on function public.assert_tenant_can_subscribe_plan(uuid, text) is
  'Recusa checkout se membros + congregados ativos excedem o teto do plano.';

grant execute on function public.assert_tenant_can_subscribe_plan(uuid, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
