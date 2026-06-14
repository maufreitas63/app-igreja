import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'docs', 'manual-painel', 'screens');

async function clickByExactText(page, text) {
  await page.evaluate((needle) => {
    const nodes = [...document.querySelectorAll('*')];
    const hit = nodes.find((el) => el.textContent?.trim() === needle);
    if (hit instanceof HTMLElement) hit.click();
  }, text);
}

async function clickByTextContains(page, text) {
  await page.evaluate((needle) => {
    const nodes = [...document.querySelectorAll('*')];
    const hit = nodes.find((el) => el.textContent?.trim().includes(needle));
    if (hit instanceof HTMLElement) hit.click();
  }, text);
}

async function expandFinancialSection(page, label) {
  await clickByExactText(page, label);
  await new Promise((r) => setTimeout(r, 1800));
}

async function expandProfileSection(page, label) {
  await clickByTextContains(page, label);
  await new Promise((r) => setTimeout(r, 1200));
}

async function prepLoginStep2(page, baseUrl, phone) {
  await page.goto(`${baseUrl}/?signedOut=1`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[placeholder="(00) 00000-0000"]', { timeout: 20000 });
  const phoneInput = await page.$('input[placeholder="(00) 00000-0000"]');
  await phoneInput.click({ clickCount: 3 });
  await phoneInput.type(phone.replace(/\D/g, ''), { delay: 25 });
  await clickByExactText(page, 'Continuar');
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Código de acesso')
      || document.body.innerText.includes('Sua senha')
      || document.body.innerText.includes('Receber código no WhatsApp'),
    { timeout: 20000 }
  );
  await new Promise((r) => setTimeout(r, 1500));
}

async function ensureMemberLogin(ctx) {
  if (ctx.memberSessionReady) return;
  await ctx.loginMember(ctx.page, ctx.baseUrl, ctx.member);
  ctx.memberSessionReady = true;
}

/** @type {{ file: string, run: (ctx: any) => Promise<void> }[]} */
export const painelJobs = [
  {
    file: '00-login.png',
    async run({ page, baseUrl, saveScreenshot, resolveCallouts }) {
      // Telefone fictício (não cadastrado) para exibir fluxo real de primeiro acesso.
      await prepLoginStep2(page, baseUrl, '(12) 99999-9999');
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Celular confirmado', lx: 55, ly: 235 },
        { n: 2, text: 'Continuar', lx: 55, ly: 160 },
        { n: 3, text: 'Código de acesso', lx: 330, ly: 420 },
        { n: 4, text: 'Receber código no WhatsApp', lx: 55, ly: 310 },
      ]);
      await saveScreenshot(page, path.join(outDir, '00-login.png'), callouts);
    },
  },
  {
    file: '01-cadastro.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts, member } = ctx;
      const phoneParam = encodeURIComponent(member.phone);
      await gotoAndSettle(page, `${baseUrl}/register?phone=${phoneParam}`);
      const onRegister = await page.evaluate(() => document.body.innerText.includes('Cadastro'));
      if (!onRegister) {
        await gotoAndSettle(page, `${baseUrl}/manage-profile`);
      }
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Nome completo', lx: 330, ly: 105 },
        { n: 2, text: 'Data Nascimento', lx: 55, ly: 158 },
        { n: 3, text: 'Termos de Uso e Privacidade', lx: 330, ly: 285 },
        { n: 4, text: 'Li e aceito', lx: 55, ly: 368 },
        { n: 5, text: 'Tirar Selfie Biométrica', lx: 330, ly: 410 },
      ]);
      await saveScreenshot(page, path.join(outDir, '01-cadastro.png'), callouts);
    },
  },
  {
    file: '01b-lgpd.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts, member } = ctx;
      await gotoAndSettle(page, `${baseUrl}/lgpd`);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Termos de Uso e Privacidade (LGPD)', lx: 330, ly: 200 },
        { n: 2, text: 'Li e aceito', lx: 55, ly: 350 },
        { n: 3, text: 'Confirmar', lx: 330, ly: 400 },
      ]);
      await saveScreenshot(page, path.join(outDir, '01b-lgpd.png'), callouts);
    },
  },
  {
    file: '02-indice-painel.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts, member } = ctx;
      await gotoAndSettle(page, `${baseUrl}/(tabs)`);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Painel de Eventos', lx: 55, ly: 285 },
        { n: 2, text: 'Índice do Aplicativo', lx: 330, ly: 365 },
        { n: 3, text: '1 /', lx: 330, ly: 535 },
        { n: 4, text: 'Encerrar sessão', lx: 55, ly: 775 },
      ]);
      await saveScreenshot(page, path.join(outDir, '02-indice-painel.png'), callouts);
    },
  },
  ...[
    ['03-agenda-familia.png', '1', 'Agenda da Família', [
      { n: 1, text: 'Evento', lx: 330, ly: 185 },
      { n: 2, text: 'Vagas', lx: 55, ly: 270 },
      { n: 3, text: 'Trocar', lx: 330, ly: 270 },
      { n: 4, text: 'Audiência', lx: 55, ly: 378 },
    ]],
    ['04-qr-checkin.png', 'qr', 'QR', [
      { n: 1, text: 'Evento', lx: 330, ly: 160 },
      { n: 2, text: 'Etiqueta', lx: 55, ly: 225 },
      { n: 3, text: 'QR', lx: 330, ly: 325 },
    ]],
    ['05-salas-kids-teens.png', '4', 'SALA', [
      { n: 1, text: 'KIDS', lx: 55, ly: 165 },
      { n: 2, text: 'TEENS', lx: 330, ly: 165 },
      { n: 3, text: 'IBN', lx: 55, ly: 250 },
    ]],
    ['06-dizimos-ofertas.png', '3', 'Dízimos', [
      { n: 1, text: 'Para', lx: 330, ly: 170 },
      { n: 2, text: 'PIX', lx: 55, ly: 278 },
      { n: 3, text: 'Copiar', lx: 330, ly: 348 },
    ]],
    ['07-coracao-aberto.png', '5', 'Coração', [
      { n: 1, text: 'Motivo', lx: 330, ly: 180 },
      { n: 2, text: 'Para mim', lx: 55, ly: 255 },
      { n: 3, text: 'pedido', lx: 330, ly: 338 },
      { n: 4, text: 'Meus pedidos', lx: 55, ly: 410 },
    ]],
    ['08-lista-membros.png', '10', 'Membros', [
      { n: 1, text: 'Procurar', lx: 330, ly: 238 },
      { n: 2, text: 'Mapa Geral', lx: 55, ly: 285 },
      { n: 3, text: 'Família', lx: 330, ly: 348 },
    ]],
    ['09-aniversariantes.png', '7', 'Aniversariantes', [
      { n: 1, text: 'Mês', lx: 330, ly: 172 },
      { n: 2, text: 'Aniversariantes', lx: 55, ly: 268 },
      { n: 3, text: 'WhatsApp', lx: 330, ly: 238 },
    ]],
    ['10-financeiro.png', '11', 'Financeiro', [
      { n: 1, text: 'mês', lx: 55, ly: 172 },
      { n: 2, text: 'Relatório de Despesas', lx: 330, ly: 222 },
      { n: 3, text: 'Saldo', lx: 55, ly: 328 },
    ]],
    ['12-escalas.png', '8', 'Escalas', [
      { n: 1, text: 'Selecionar Escala', lx: 330, ly: 172 },
      { n: 2, text: 'Nome', lx: 55, ly: 268 },
      { n: 3, text: 'Identificar veículo', lx: 330, ly: 338 },
    ]],
    ['14-gestao-cadastros.png', '6', 'Gestão', [
      { n: 1, text: 'Dados Cadastrais', lx: 55, ly: 182 },
      { n: 2, text: 'Gerenciar Família', lx: 330, ly: 182 },
      { n: 3, text: 'Representante', lx: 55, ly: 298 },
      { n: 4, text: 'Adicionar', lx: 330, ly: 388 },
    ]],
  ].map(([file, card, _label, calloutDefs]) => ({
    file,
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts, member } = ctx;
      await gotoAndSettle(page, `${baseUrl}/dashboard?dashboardCard=${card}`);
      const callouts = await resolveCallouts(page, calloutDefs);
      await saveScreenshot(page, path.join(outDir, file), callouts);
    },
  })),
  {
    file: '11-relatorio-despesas.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/expense-report?returnDashboardCard=11`);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'PIX', lx: 330, ly: 242 },
        { n: 2, text: 'Novo RD', lx: 55, ly: 290 },
        { n: 3, text: 'Meus relatórios', lx: 330, ly: 342 },
        { n: 4, text: 'Pendente', lx: 55, ly: 400 },
      ]);
      await saveScreenshot(page, path.join(outDir, '11-relatorio-despesas.png'), callouts);
    },
  },
  {
    file: '11b-rd-formulario.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/expense-report?returnDashboardCard=11`);
      await clickByExactText(page, 'Novo RD');
      await page.waitForFunction(
        () => document.body.innerText.includes('Submeter') || document.body.innerText.includes('Finalizar'),
        { timeout: 20000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Chave PIX', lx: 330, ly: 200 },
        { n: 2, text: 'Descrição', lx: 55, ly: 300 },
        { n: 3, text: 'comprovante', lx: 330, ly: 360 },
        { n: 4, text: 'Submeter', lx: 55, ly: 430 },
      ]);
      await saveScreenshot(page, path.join(outDir, '11b-rd-formulario.png'), callouts);
    },
  },
  {
    file: '13-estacionamento.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/dashboard?dashboardCard=9`);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'placa', lx: 330, ly: 238 },
        { n: 2, text: 'Buscar', lx: 55, ly: 300 },
        { n: 3, text: 'Proprietário', lx: 330, ly: 378 },
      ]);
      await saveScreenshot(page, path.join(outDir, '13-estacionamento.png'), callouts);
    },
  },
  {
    file: '15-dados-cadastrais.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/manage-profile`);
      await expandProfileSection(page, 'Dados Pessoais');
      await expandProfileSection(page, 'Contato');
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Dados Pessoais', lx: 330, ly: 360 },
        { n: 2, text: 'Nome', lx: 55, ly: 420 },
        { n: 3, text: 'Contato', lx: 330, ly: 500 },
        { n: 4, text: 'Endereço', lx: 55, ly: 580 },
      ]);
      await saveScreenshot(page, path.join(outDir, '15-dados-cadastrais.png'), callouts);
    },
  },
  {
    file: '16-gerenciar-familia.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/manage-members`);
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Família', lx: 330, ly: 120 },
        { n: 2, text: 'Adicionar', lx: 55, ly: 200 },
        { n: 3, text: 'Integrantes', lx: 330, ly: 280 },
        { n: 4, text: 'parentesco', lx: 55, ly: 380 },
      ]);
      await saveScreenshot(page, path.join(outDir, '16-gerenciar-familia.png'), callouts);
    },
  },
  {
    file: '17-selfie-biometrica.png',
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/manage-profile`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise((r) => setTimeout(r, 800));
      const callouts = await resolveCallouts(page, [
        { n: 1, text: 'Tirar Selfie', lx: 330, ly: 250 },
        { n: 2, text: 'Atualizar Selfie', lx: 330, ly: 250 },
        { n: 3, text: 'LGPD', lx: 55, ly: 200 },
        { n: 4, text: 'Representante', lx: 55, ly: 150 },
      ]);
      await saveScreenshot(page, path.join(outDir, '17-selfie-biometrica.png'), callouts);
    },
  },
  ...[
    ['10a-fin-resultado.png', 'Resultado do mês', [
      { n: 1, text: 'Resultado do mês', lx: 330, ly: 280 },
      { n: 2, text: 'Receitas', lx: 55, ly: 360 },
      { n: 3, text: 'Despesas', lx: 330, ly: 420 },
    ]],
    ['10b-fin-comparativo.png', 'Comparativo mensal', [
      { n: 1, text: 'Comparativo mensal', lx: 330, ly: 280 },
      { n: 2, text: 'mês', lx: 55, ly: 360 },
    ]],
    ['10c-fin-12meses.png', 'Últimos 12 meses', [
      { n: 1, text: 'Últimos 12 meses', lx: 330, ly: 280 },
      { n: 2, text: 'Realizado', lx: 55, ly: 360 },
    ]],
    ['10d-fin-orcamento.png', 'Planejado × Realizado', [
      { n: 1, text: 'Planejado', lx: 330, ly: 280 },
      { n: 2, text: 'Realizado', lx: 55, ly: 360 },
    ]],
    ['10e-fin-saldo.png', 'Saldo bancário', [
      { n: 1, text: 'Saldo bancário', lx: 330, ly: 280 },
      { n: 2, text: 'Saldo total', lx: 55, ly: 400 },
      { n: 3, text: 'conta', lx: 330, ly: 460 },
    ]],
  ].map(([file, sectionLabel, calloutDefs]) => ({
    file,
    async run(ctx) {
      await ensureMemberLogin(ctx);
      const { page, baseUrl, gotoAndSettle, saveScreenshot, resolveCallouts } = ctx;
      await gotoAndSettle(page, `${baseUrl}/financial?returnDashboardCard=11`);
      await expandFinancialSection(page, sectionLabel);
      const callouts = await resolveCallouts(page, calloutDefs);
      await saveScreenshot(page, path.join(outDir, file), callouts);
    },
  })),
];
