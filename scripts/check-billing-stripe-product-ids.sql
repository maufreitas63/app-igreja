select code, name, stripe_product_id, stripe_price_id
  from public.billing_plans
 where code in ('semente', 'crescimento', 'expansao', 'ministerio')
 order by sort_order;
