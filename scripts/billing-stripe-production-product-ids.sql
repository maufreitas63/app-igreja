-- =============================================================================
-- Catálogo Stripe de produção — product IDs nos planos SaaS
-- =============================================================================
-- Checkout em live resolve o Price trimestral a partir de stripe_product_id.
-- stripe_price_id de teste permanece como fallback para sk_test_.
-- Aplica: npx supabase db query --linked -f scripts/billing-stripe-production-product-ids.sql
-- =============================================================================

alter table public.billing_plans
  add column if not exists stripe_product_id text;

comment on column public.billing_plans.stripe_product_id is
  'Product ID do Stripe (prod_…) no catálogo de produção.';

update public.billing_plans
   set stripe_product_id = case code
         when 'semente' then 'prod_VHJyIji7BiDXMN'
         when 'crescimento' then 'prod_VHK0NV797cK5v2'
         when 'expansao' then 'prod_VHK1R5xL6SKUm5'
         when 'ministerio' then 'prod_VHK29Q00ifpUrw'
         else stripe_product_id
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
  stripe_product_id text,
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
    bp.stripe_product_id,
    bp.quarterly_amount_cents
  from public.billing_plans bp
  where bp.is_active = true
  order by bp.sort_order asc, bp.name asc;
$$;

grant execute on function public.list_billing_plans() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
