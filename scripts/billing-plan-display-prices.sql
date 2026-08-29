-- Preços de vitrine (centavos BRL) cobrados no Stripe a cada trimestre.

alter table public.billing_plans
  add column if not exists quarterly_amount_cents integer;

update public.billing_plans
   set quarterly_amount_cents = case code
     when 'semente' then 8970
     when 'crescimento' then 23970
     when 'expansao' then 44970
     when 'ministerio' then 89970
     else quarterly_amount_cents
   end,
       updated_at = now()
 where code in ('semente', 'crescimento', 'expansao', 'ministerio');

drop function if exists public.list_billing_plans();

create or replace function public.list_billing_plans()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  max_members integer,
  sort_order integer,
  stripe_price_id text,
  quarterly_amount_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id,
    bp.code,
    bp.name,
    bp.description,
    bp.max_members,
    bp.sort_order,
    bp.stripe_price_id,
    bp.quarterly_amount_cents
  from public.billing_plans bp
  where bp.is_active = true
  order by bp.sort_order asc, bp.name asc;
$$;

grant execute on function public.list_billing_plans() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
