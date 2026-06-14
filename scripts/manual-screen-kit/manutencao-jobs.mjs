import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'docs', 'manual-manutencao', 'screens');

async function clickByText(page, text) {
  await page.evaluate((needle) => {
    const nodes = [...document.querySelectorAll('*')];
    const hit = nodes.find((el) => el.textContent?.trim().includes(needle));
    if (hit instanceof HTMLElement) hit.click();
  }, text);
}

async function clickGear(page) {
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Configurações"]');
    if (el instanceof HTMLElement) {
      el.click();
      return true;
    }
    return false;
  });
  if (!clicked) {
    await clickByText(page, 'Configurações');
  }
}

async function ensureMaintLogin(ctx) {
  if (ctx.maintSessionReady) return;
  await ctx.loginMember(ctx.page, ctx.baseUrl, ctx.maint);
  ctx.maintSessionReady = true;
}

async function openMaintenance(ctx) {
  const { page, baseUrl, maint } = ctx;
  await ensureMaintLogin(ctx);
  await page.goto(`${baseUrl}/(tabs)`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  await clickGear(page);
  await page.waitForFunction(
    () => document.body.innerText.includes('Manutenção') || document.body.innerText.includes('Módulos'),
    { timeout: 20000 }
  );
  await new Promise((r) => setTimeout(r, 2000));
}

async function openMaintenanceModule(page, label) {
  await clickByText(page, label);
  await new Promise((r) => setTimeout(r, 2200));
}

/** @type {{ file: string, run: (ctx: any) => Promise<void> }[]} */
export const manutencaoJobs = [
  {
    file: 'm00-acesso-engrenagem.png',
    async run(ctx) {
      const { page, baseUrl, maint, saveScreenshot, resolveCallouts } = ctx;
      await ensureMaintLogin(ctx);
      await page.goto(`${baseUrl}/(tabs)`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2000));
      const callouts = await resolveCallouts(page, [
        { n: 1, selector: '[aria-label="Configurações"]', lx: 330, ly: 760 },
        { n: 2, text: 'Encerrar sessão', lx: 55, ly: 760 },
      ]);
      await saveScreenshot(page, path.join(outDir, 'm00-acesso-engrenagem.png'), callouts);
    },
  },
  {
    file: 'm01-menu-modulos.png',
    async run(ctx) {
      const { page, saveScreenshot, resolveCallouts } = ctx;
      await openMaintenance(ctx);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Módulos de manutenção', lx: 55, ly: 265 },
        { n: 2, text: 'Menu', lx: 330, ly: 745 },
        { n: 3, text: '1 /', lx: 330, ly: 730 },
      ]);
      await saveScreenshot(page, path.join(outDir, 'm01-menu-modulos.png'), callouts);
    },
  },
  ...[
    ['m02-programacao-eventos.png', 'Programação de Eventos', [
      { n: 1, text: 'Novo evento', lx: 330, ly: 188 },
      { n: 2, text: 'Eventos cadastrados', lx: 55, ly: 272 },
      { n: 3, text: 'Publicado', lx: 330, ly: 288 },
    ]],
    ['m03-editor-evento.png', 'Programação de Eventos', [
      { n: 1, text: 'Nome do evento', lx: 55, ly: 182 },
      { n: 2, text: 'Capacidade', lx: 330, ly: 272 },
      { n: 3, text: 'Kids', lx: 55, ly: 318 },
      { n: 4, text: 'Salvar', lx: 330, ly: 388 },
    ], true],
    ['m04-cronograma.png', 'Cronograma de Eventos', [
      { n: 1, text: 'Cronograma', lx: 330, ly: 205 },
      { n: 2, text: 'TstMax', lx: 55, ly: 268 },
    ]],
    ['m05-sala-checkin.png', 'Sala(s) - Check In', [
      { n: 1, text: 'KIDS', lx: 55, ly: 182 },
      { n: 2, text: 'Confirmar', lx: 330, ly: 248 },
    ]],
    ['m06-tipos-escala.png', 'Tipos de Escala', [
      { n: 1, text: 'Cadastrar', lx: 330, ly: 218 },
      { n: 2, text: 'cadastrados', lx: 55, ly: 308 },
    ]],
    ['m07-servos-disponibilidade.png', 'Servos em Disponibilidade', [
      { n: 1, text: 'Tipo de escala', lx: 330, ly: 182 },
      { n: 2, text: 'Disponível', lx: 55, ly: 268 },
    ]],
    ['m08-programacao-escalas.png', 'Programação de Escalas', [
      { n: 1, text: 'Escala', lx: 55, ly: 182 },
      { n: 2, text: 'Salvar', lx: 330, ly: 288 },
    ]],
    ['m09-cuidado-pastoral.png', 'Cuidado Pastoral', [
      { n: 1, text: 'Solicitante', lx: 330, ly: 182 },
      { n: 2, text: 'Pedido', lx: 55, ly: 288 },
      { n: 3, text: 'Estágio', lx: 330, ly: 348 },
    ]],
    ['m10-financeiro-manut.png', 'Informações Financeiras', [
      { n: 1, text: 'Período', lx: 55, ly: 198 },
      { n: 2, text: 'CSV', lx: 330, ly: 278 },
      { n: 3, text: 'RD', lx: 55, ly: 358 },
    ]],
    ['m11-lista-presenca.png', 'Lista de Presença', [
      { n: 1, text: 'quórum', lx: 330, ly: 182 },
      { n: 2, text: 'Gerar lista', lx: 55, ly: 235 },
      { n: 3, text: 'Confirmado', lx: 330, ly: 308 },
    ]],
    ['m12-cadastro-usuario.png', 'Cadastro de Usuário', [
      { n: 1, text: 'Buscar', lx: 55, ly: 218 },
      { n: 2, text: 'CEP', lx: 330, ly: 298 },
    ]],
    ['m13-recepcao-familiar.png', 'Recepção Familiar', [
      { n: 1, text: 'Recepção', lx: 330, ly: 238 },
      { n: 2, text: 'Aguardando', lx: 55, ly: 298 },
    ]],
    ['m14-controle-acesso.png', 'Controle de Acesso', [
      { n: 1, text: 'Papel', lx: 330, ly: 182 },
      { n: 2, text: 'dashboard', lx: 55, ly: 278 },
      { n: 3, text: 'Salvar', lx: 330, ly: 368 },
    ]],
    ['m15-mudanca-papeis.png', 'Mudança de Papéis', [
      { n: 1, text: 'Membro', lx: 55, ly: 182 },
      { n: 2, text: 'Congregado', lx: 330, ly: 268 },
      { n: 3, text: 'Aplicar', lx: 55, ly: 328 },
    ]],
    ['m16-acessos-usuarios.png', 'Acessos de Usuários', [
      { n: 1, text: 'Buscar', lx: 330, ly: 198 },
      { n: 2, text: 'Acessos', lx: 330, ly: 258 },
      { n: 3, text: 'sessão', lx: 55, ly: 348 },
    ]],
  ].map(([file, moduleLabel, calloutDefs, openEditor]) => ({
    file,
    async run(ctx) {
      const { page, saveScreenshot, resolveCallouts } = ctx;
      await openMaintenance(ctx);
      await openMaintenanceModule(page, moduleLabel);
      if (openEditor) {
        await clickByText(page, 'Novo evento');
        await new Promise((r) => setTimeout(r, 2000));
      }
      const callouts = await resolveCallouts(page, calloutDefs);
      await saveScreenshot(page, path.join(outDir, file), callouts);
    },
  })),
];
