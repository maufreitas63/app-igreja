-- Paleta "Basico": fundo branco, texto preto, bordas azuis.
-- Execute no SQL Editor do Supabase (após paletas-table.sql).
-- Depois: Settings → API → Reload schema.

insert into public.paletas (nome, primary_color, secondary_color, bg_color, accent_color, is_active)
values (
  'Basico',
  '#2563EB',
  '#FFFFFF',
  '#FFFFFF',
  '#2563EB',
  false
)
on conflict (nome) do update
  set primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      bg_color = excluded.bg_color,
      accent_color = excluded.accent_color;

notify pgrst, 'reload schema';
