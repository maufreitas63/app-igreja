/**
 * Gera planilha Excel de validação prática por papel ACL + checklist pós-deploy.
 *
 * Uso: node scripts/build-validation-checklist-xlsx.mjs
 * Saída: pdfs/CHECKLIST_VALIDACAO_POR_PAPEL.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'pdfs', 'CHECKLIST_VALIDACAO_POR_PAPEL.xlsx');

const ROLES = [
  { code: 'visitantes', label: 'Visitantes' },
  { code: 'congregado', label: 'Congregado' },
  { code: 'member', label: 'Membro' },
  { code: 'lider', label: 'Líder' },
  { code: 'events_admin', label: 'Administrador de eventos' },
  { code: 'pastoral', label: 'Equipe Pastoral' },
  { code: 'super_admin', label: 'Super administrador' },
];

/** Seções do checklist → papéis que devem executar os testes (_geral = aba Geral). */
const SECTION_ROLES = {
  'Deploy e atualização': ['_geral'],
  'LGPD e cadastro': ['visitantes', 'congregado', 'member', 'pastoral'],
  'Dashboard principal': ['member', 'pastoral', 'lider', 'events_admin'],
  'Manutenção — eventos': ['events_admin', 'super_admin'],
  'Manutenção — controle de acesso': ['super_admin'],
  'Manutenção — escalas': ['lider', 'super_admin'],
  'Financeiro — relatórios (membros)': ['member', 'pastoral'],
  'Super admin — chave técnica ACL': ['super_admin'],
  'Financeiro — Relatório de Despesas (RD)': ['member', 'pastoral'],
  'Deploy — versão publicada': ['_geral'],
  'Recepção Familiar': ['super_admin'],
  'Mudança de Papéis': ['pastoral', 'super_admin'],
  'Manutenção — Informações Financeiras': ['super_admin'],
  'Controle de Acesso — aba Perfis': ['super_admin'],
  'Cadastro de Usuário — exclusão': ['super_admin'],
  'Perfil, selfie e família': ['member', 'pastoral'],
  'Mapa de geolocalização': ['member', 'pastoral'],
  'Coração Aberto': ['member', 'pastoral', 'congregado'],
  'Login e interface': ['visitantes', 'congregado', 'member'],
  'Navegação entre cards': ['member', 'pastoral'],
};

const SQL_ROWS = [
  ['scripts/financial-module-access.sql', 'ACL Card Financeiro e /financial'],
  ['scripts/access-control-pastoral-role-grants.sql', 'Pastoral com privilégios de membro'],
  ['scripts/access-control-map-pin-roles.sql', 'Coluna GPS na Lista de Membros'],
  ['scripts/pastoral-request-delete-rpc.sql', 'Excluir pedido em Meus pedidos'],
  ['scripts/expense-reports-schema.sql + expense-reports-rpc.sql', 'RD membro e manutenção'],
  ['scripts/recepcao-cadastro-familiar.sql', 'Recepção Familiar + formulário público'],
  ['scripts/access-control-pastoral-role-change.sql', 'Mudança de Papéis'],
  ['scripts/delete-profile-complete-rpc.sql', 'Excluir usuário no Cadastro de Usuário'],
];

function parseChecklist(md) {
  const items = [];
  let section = '';
  let pedido = '';
  let id = 0;

  for (const line of md.split(/\r?\n/)) {
    const sectionMatch = line.match(/^## (.+)/);

    if (sectionMatch && !sectionMatch[1].startsWith('Registro') && !sectionMatch[1].startsWith('SQLs')) {
      section = sectionMatch[1].trim();
      pedido = '';
      continue;
    }

    if (line.startsWith('**Pedido:**')) {
      pedido = line.replace('**Pedido:**', '').trim();
      continue;
    }

    const itemMatch = line.match(/^- \[ \] (.+)/);

    if (itemMatch && section) {
      id += 1;
      items.push({
        id,
        section,
        pedido,
        text: itemMatch[1].trim(),
        aclHint: guessAclHint(itemMatch[1]),
      });
    }
  }

  return items;
}

function guessAclHint(text) {
  const lower = text.toLowerCase();

  if (lower.includes('financeiro') && lower.includes('rd')) return '/expense-report';
  if (lower.includes('relatório de despesas') || lower.includes('relatorio de despesas')) {
    return '/expense-report';
  }
  if (lower.includes('/financial') || lower.includes('saldo bancário')) return '/financial';
  if (lower.includes('card financeiro')) return 'dashboard.card.financial';
  if (lower.includes('controle de acesso')) return '/maintenance-dashboard';
  if (lower.includes('cuidado pastoral') || lower.includes('coração aberto')) return '/pastoral';
  if (lower.includes('gerenciar família') || lower.includes('gerenciar familia')) {
    return '/manage-members';
  }
  if (lower.includes('lista de membros')) return 'dashboard.card.members_list';
  if (lower.includes('mapa')) return '/mapa-geolocalizacao';
  if (lower.includes('manutenção') || lower.includes('manutencao')) return '/maintenance-dashboard';
  if (lower.includes('lgpd')) return '/lgpd';
  if (lower.includes('super admin')) return 'super_admin';
  if (lower.includes('recepção') || lower.includes('recepcao')) return 'maintenance.card.profile_cadastro';
  if (lower.includes('mudança de papéis') || lower.includes('mudanca de papeis')) {
    return 'maintenance.card.mudanca_papeis';
  }

  return '';
}

function parsePapeisAcl(md) {
  const roles = {};
  let current = null;
  let currentType = null;

  for (const line of md.split(/\r?\n/)) {
    const roleMatch = line.match(/^## (.+)/);

    if (roleMatch && !line.includes('Mapa visual')) {
      const title = roleMatch[1].trim();
      const meta = ROLES.find((r) => r.label === title);

      if (meta) {
        current = meta.code;
        roles[current] = { label: title, resources: [] };
      } else {
        current = null;
      }

      continue;
    }

    if (line.startsWith('### ')) {
      const type = line.replace('### ', '').trim();

      if (type === 'Telas') currentType = 'screen';
      else if (type === 'Tabelas') currentType = 'table';
      else if (type === 'Colunas') currentType = 'column';
      else currentType = null;

      continue;
    }

    if (!current || !currentType || !line.startsWith('|')) {
      continue;
    }

    if (line.includes('Chave técnica') || line.includes('---')) {
      continue;
    }

    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length < 4) {
      continue;
    }

    const [name, key, viewRaw, editRaw] = cells;
    const canView = viewRaw.includes('Sim');
    const canEdit = editRaw.includes('Sim');

    roles[current].resources.push({
      type: currentType,
      key,
      name,
      canView,
      canEdit,
    });
  }

  return roles;
}

function sheetFromRows(rows) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function autoWidth(ws, rows) {
  const colWidths = rows[0].map((_, colIndex) => {
    const maxLen = rows.reduce((max, row) => {
      const cell = row[colIndex];

      if (cell === undefined || cell === null) {
        return max;
      }

      return Math.max(max, String(cell).length);
    }, 10);

    return { wch: Math.min(maxLen + 2, 80) };
  });

  ws['!cols'] = colWidths;
}

function buildInstructionsSheet() {
  return [
    ['Checklist de validação por papel — App IBN'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    [''],
    ['Como usar'],
    ['1. Aba Geral: deploy, build-info.json e SQLs — testar uma vez antes dos papéis.'],
    ['2. Matriz_ACL: referência do que cada papel pode Ver/Editar (fonte: PAPEIS_CONTROLE_ACESSO.md).'],
    ['3. Checklist_Matriz: todos os itens × colunas "Testar?" por papel.'],
    ['4. Abas por papel: login com usuário de teste → marque Resultado (OK / Falha / N.A.) e Observações.'],
    ['5. Após mudar papéis no Supabase, o usuário deve Sair e entrar de novo no app.'],
    [''],
    ['Resultado sugerido', 'OK = passou | Falha = bug | N.A. = não se aplica a este papel'],
    [''],
    ['Usuário de teste por papel (preencher)'],
    ['Papel', 'Telefone teste', 'Nome', 'Validador', 'Data'],
    ...ROLES.map((r) => [r.label, '', '', '', '']),
    ['Geral (deploy)', '', '', '', ''],
  ];
}

function buildGeralSheet(items) {
  const geralItems = items.filter((item) => (SECTION_ROLES[item.section] ?? []).includes('_geral'));
  const header = ['ID', 'Seção', 'Pedido', 'Item de validação', 'Resultado', 'Observações', 'Data'];

  return [
    header,
    ...geralItems.map((item) => [item.id, item.section, item.pedido, item.text, '', '', '']),
    [''],
    ['SQLs em produção (conferir antes de validar)'],
    ['Script', 'Necessário para', 'Executado? (S/N)', 'Data'],
    ...SQL_ROWS.map((row) => [...row, '', '']),
  ];
}

function buildAclMatrixSheet(aclByRole) {
  const header = ['Papel', 'Código', 'Tipo', 'Chave técnica', 'Nome', 'Ver', 'Editar'];

  const rows = [header];

  for (const role of ROLES) {
    const data = aclByRole[role.code];

    if (!data) {
      continue;
    }

    for (const res of data.resources) {
      rows.push([
        data.label,
        role.code,
        res.type,
        res.key,
        res.name,
        res.canView ? 'Sim' : 'Não',
        res.canEdit ? 'Sim' : 'Não',
      ]);
    }
  }

  return rows;
}

function buildChecklistMatrixSheet(items) {
  const header = [
    'ID',
    'Seção',
    'Pedido',
    'Item',
    'Recurso ACL (hint)',
    ...ROLES.map((r) => `Testar ${r.label}?`),
    'Resultado global',
    'Observações',
  ];

  const rows = [header];

  for (const item of items) {
    const roleSet = new Set(SECTION_ROLES[item.section] ?? []);

    rows.push([
      item.id,
      item.section,
      item.pedido,
      item.text,
      item.aclHint,
      ...ROLES.map((r) => (roleSet.has(r.code) ? 'SIM' : '')),
      '',
      '',
    ]);
  }

  return rows;
}

function buildRoleSheet(roleCode, roleLabel, aclByRole, items) {
  const acl = aclByRole[roleCode];
  const rows = [
    [`Validação — ${roleLabel} (${roleCode})`],
    ['Telefone de teste', '', 'Validador', '', 'Data', ''],
    [''],
    ['A. Recursos ACL — conferir acesso no app'],
    ['#', 'Tipo', 'Chave', 'Nome', 'Ver esperado', 'Editar esperado', 'Acessível? (OK/Falha)', 'Observações'],
  ];

  if (acl?.resources.length) {
    acl.resources.forEach((res, index) => {
      rows.push([
        index + 1,
        res.type,
        res.key,
        res.name,
        res.canView ? 'Sim' : 'Não',
        res.canEdit ? 'Sim' : 'Não',
        '',
        '',
      ]);
    });
  } else {
    rows.push(['—', '—', '—', 'Sem recursos no mapa ACL', '—', '—', '', '']);
  }

  rows.push(['']);
  rows.push(['B. Checklist pós-deploy aplicável a este papel']);
  rows.push(['ID', 'Seção', 'Pedido', 'Item de validação', 'Recurso ACL', 'Resultado', 'Observações']);

  const roleItems = items.filter((item) => (SECTION_ROLES[item.section] ?? []).includes(roleCode));

  for (const item of roleItems) {
    rows.push([item.id, item.section, item.pedido, item.text, item.aclHint, '', '']);
  }

  if (!roleItems.length) {
    rows.push(['—', '—', '—', 'Nenhum item do checklist pós-deploy para este papel', '—', '', '']);
  }

  rows.push(['']);
  rows.push(['C. Bloqueios esperados (opcional)']);
  rows.push([
    'Teste',
    'Ex.: perfil visitante NÃO deve ver Card Financeiro nem abrir /financial',
    'Resultado',
    'Observações',
  ]);
  rows.push(['', '', '', '']);

  return rows;
}

function main() {
  const checklistMd = fs.readFileSync(path.join(root, 'CHECKLIST_VALIDACAO_POS_DEPLOY.md'), 'utf8');
  const papeisMd = fs.readFileSync(path.join(root, 'PAPEIS_CONTROLE_ACESSO.md'), 'utf8');

  const items = parseChecklist(checklistMd);
  const aclByRole = parsePapeisAcl(papeisMd);

  const wb = XLSX.utils.book_new();

  const sheets = [
    { name: 'Instruções', rows: buildInstructionsSheet() },
    { name: 'Geral', rows: buildGeralSheet(items) },
    { name: 'Matriz_ACL', rows: buildAclMatrixSheet(aclByRole) },
    { name: 'Checklist_Matriz', rows: buildChecklistMatrixSheet(items) },
    ...ROLES.map((role) => ({
      name: role.code.slice(0, 31),
      rows: buildRoleSheet(role.code, role.label, aclByRole, items),
    })),
  ];

  for (const { name, rows } of sheets) {
    const ws = sheetFromRows(rows);
    autoWidth(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(wb, outPath);

  console.log(`Planilha gerada: ${outPath}`);
  console.log(`Itens checklist: ${items.length} | Papéis: ${ROLES.length}`);
}

main();
