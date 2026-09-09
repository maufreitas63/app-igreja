-- =============================================================================
-- Sincroniza vitrine e Price IDs com o catálogo Stripe Test (set/2026)
-- =============================================================================
-- Valores lidos dos Prices trimestrais ativos:
--   Semente     price_1UDseeRexYTA7BZiEJhl4ikh  R$ 104,99
--   Crescimento price_1UDsfkRexYTA7BZiYgfpNg55  R$ 252,99
--   Expansão    price_1UDsiHRexYTA7BZipBCdbRCb  R$ 815,99
--   Ministério  price_1UDskyRexYTA7BZispxHQKyV  R$ 1.419,99
-- Aplica: npx supabase db query --linked -f scripts/billing-sync-stripe-prices.sql
-- =============================================================================

update public.billing_plans
   set stripe_price_id = case code
         when 'semente' then 'price_1UDseeRexYTA7BZiEJhl4ikh'
         when 'crescimento' then 'price_1UDsfkRexYTA7BZiYgfpNg55'
         when 'expansao' then 'price_1UDsiHRexYTA7BZipBCdbRCb'
         when 'ministerio' then 'price_1UDskyRexYTA7BZispxHQKyV'
         else stripe_price_id
       end,
       quarterly_amount_cents = case code
         when 'semente' then 10499
         when 'crescimento' then 25299
         when 'expansao' then 81599
         when 'ministerio' then 141999
         else quarterly_amount_cents
       end,
       updated_at = now()
 where code in ('semente', 'crescimento', 'expansao', 'ministerio');

notify pgrst, 'reload schema';
