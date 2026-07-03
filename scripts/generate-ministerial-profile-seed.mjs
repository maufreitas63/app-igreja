/**
 * Gera scripts/ministerial-profile-questionnaire-seed.sql a partir do JSON.
 * Uso: node scripts/generate-ministerial-profile-seed.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const jsonPath = join(root, 'data', 'ministerial-profile-questionnaire.json');
const outPath = join(root, 'scripts', 'ministerial-profile-questionnaire-seed.sql');

const THEME_BLOCKS = [
  { from: 1, to: 5, theme: 'Doutrina e Escritura' },
  { from: 6, to: 10, theme: 'Identidade batista' },
  { from: 11, to: 15, theme: 'Pastorado e ordenanças' },
  { from: 16, to: 18, theme: 'Vida sacramental' },
  { from: 19, to: 24, theme: 'Missão e evangelismo' },
  { from: 25, to: 30, theme: 'Educação cristã' },
  { from: 31, to: 35, theme: 'Vida congregacional' },
  { from: 36, to: 40, theme: 'Liderança e adoração' },
  { from: 41, to: 45, theme: 'Cuidado pastoral' },
  { from: 46, to: 50, theme: 'Legado e testemunho' },
];

const resolveTheme = (questionNumber) => {
  const block = THEME_BLOCKS.find((entry) => questionNumber >= entry.from && questionNumber <= entry.to);
  return block?.theme ?? 'Geral';
};

const escapeSql = (value) => String(value).replace(/'/g, "''");

const payload = JSON.parse(readFileSync(jsonPath, 'utf8'));
const questions = payload.questionario ?? [];

const lines = [
  '-- Seed: Questionário de Perfil Ministerial (50 perguntas)',
  '-- Gerado por scripts/generate-ministerial-profile-seed.mjs — não edite manualmente.',
  '',
  'delete from public.ministerial_respostas;',
  'delete from public.ministerial_resultados;',
  'delete from public.ministerial_opcoes;',
  'delete from public.ministerial_perguntas;',
  '',
];

for (const [index, question] of questions.entries()) {
  const ordem = index + 1;
  const id = question.id;
  const texto = escapeSql(question.pergunta);
  const bloco = escapeSql(resolveTheme(ordem));

  lines.push(
    `insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)`,
    `values ('${id}', '${texto}', '${bloco}', ${ordem})`,
    `on conflict (id) do update set`,
    `  texto_pergunta = excluded.texto_pergunta,`,
    `  bloco_tema = excluded.bloco_tema,`,
    `  ordem = excluded.ordem;`,
    ''
  );

  question.opcoes.forEach((opcao, optionIndex) => {
    const opcaoId = `${id}_OPT${optionIndex + 1}`;
    const opcaoTexto = escapeSql(opcao.texto);
    const perfil = escapeSql(opcao.perfil);

    lines.push(
      `insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)`,
      `values ('${opcaoId}', '${id}', '${opcaoTexto}', '${perfil}', ${optionIndex + 1})`,
      `on conflict (id) do update set`,
      `  texto_opcao = excluded.texto_opcao,`,
      `  perfil_pontuado = excluded.perfil_pontuado,`,
      `  ordem = excluded.ordem;`,
      ''
    );
  });
}

writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Gerado: ${outPath} (${questions.length} perguntas)`);
