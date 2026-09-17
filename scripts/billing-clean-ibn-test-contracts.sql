-- Limpa contratação atual e contratos SaaS de teste da instância IBN.
-- Não altera papéis, grants, ACL, nem dados de outras igrejas.

do $$
declare
  v_tenant uuid;
begin
  select i.id
    into v_tenant
    from public.igrejas i
   where upper(btrim(i.code)) = 'IBN'
   limit 1;

  if v_tenant is null then
    raise exception 'Igreja IBN não encontrada.';
  end if;

  begin
    delete from public.referral_payouts
     where filha_tenant_id = v_tenant
        or stripe_invoice_id in (
          select stripe_invoice_id
            from public.billing_invoices
           where tenant_id = v_tenant
        );
  exception
    when undefined_table then
      null;
  end;

  begin
    delete from public.billing_invoices
     where tenant_id = v_tenant;
  exception
    when undefined_table then
      null;
  end;

  delete from public.billing_saas_contracts
   where tenant_id = v_tenant;

  delete from public.tenant_subscriptions
   where tenant_id = v_tenant;
end
$$;

select i.code,
       i.name,
       ts.id is not null as has_subscription,
       ts.status as subscription_status,
       (
         select count(*)::integer
           from public.billing_saas_contracts c
          where c.tenant_id = i.id
       ) as contract_count
  from public.igrejas i
  left join public.tenant_subscriptions ts on ts.tenant_id = i.id
 where upper(btrim(i.code)) = 'IBN';
