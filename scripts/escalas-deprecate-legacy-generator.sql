-- C2: desativa geradores legados de escala (rotação por última data + N vagas/data).
-- Fonte única de geração em lote: app Manutenção → Escalas → "Gerar ciclo em bloco"
-- (lib/maintenanceScaleCycle.ts → gerarCicloCompleto → aplicar_ciclo_escala).
--
-- Execute no SQL Editor do Supabase.

drop function if exists public.gerar_escala_por_codigo(text, date, integer);

create or replace function public.gerar_escala_por_codigo(
  p_tipo_escala_codigo text,
  p_data_servico date,
  p_num_vagas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'success', false,
    'deprecated', true,
    'code', 'LEGACY_GENERATOR_DISABLED',
    'message',
      'Gerador SQL legado desativado. Use Manutenção → Escalas → Gerar ciclo em bloco '
      || '(ordem_sequencial crescente, um servo por domingo livre após a maior data_servico).',
    'replacement', 'app:lib/maintenanceScaleCycle.ts → aplicar_ciclo_escala'
  );
end;
$$;

drop function if exists public.gerar_escala_vigilancia(date, integer);

create or replace function public.gerar_escala_vigilancia(
  p_data_domingo date,
  p_num_vagas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.gerar_escala_por_codigo('vigilancia_estacionamento', p_data_domingo, p_num_vagas);
end;
$$;

grant execute on function public.gerar_escala_por_codigo(text, date, integer) to anon, authenticated;
grant execute on function public.gerar_escala_vigilancia(date, integer) to anon, authenticated;

notify pgrst, 'reload schema';
