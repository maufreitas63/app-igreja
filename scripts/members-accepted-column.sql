-- Coluna de reconhecimento familiar em members (Gerenciar Família).
-- accepted = true  -> membro reconhecido como pertencente à família
-- accepted = false -> membro marcado como não pertencente

alter table public.members
  add column if not exists accepted boolean;

comment on column public.members.accepted is
  'Reconhecimento familiar: true pertence, false não pertence, null ainda não avaliado. O app e as funções SQL listam/inscrevem apenas accepted = true (exceto Gerenciar Família). Quando false, o app emite novo codigo via reserve_next_family_id (lib/rejectedMemberFamilyCode.ts).';

-- Em seguida:
-- scripts/members-accepted-rls.sql
-- scripts/members-accepted-functions.sql (ou register-member-atomic.sql completo)
