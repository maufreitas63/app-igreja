/**
 * Gera docs/matriz-acessos-usuarios.md, .pdf e .xlsx
 * a partir de scripts/access-matrix-raw.json (export do Supabase).
 *
 * Uso:
 *   node scripts/generate-access-matrix-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const rawPath = path.join(root, 'scripts', 'access-matrix-raw.json');
const outMd = path.join(root, 'docs', 'matriz-acessos-usuarios.md');
const outPdf = path.join(root, 'docs', 'matriz-acessos-usuarios.pdf');

const MEMBER_MENU = [
  { key: 'events_panel', label: 'Menu — Início', always: true },
  {
    key: 'menu_perfil',
    label: 'Menu — Perfil',
    resources: ['dashboard.card.grouped_manage'],
  },
  {
    key: 'gestao_financeira',
    label: 'Menu — Financeiro',
    resources: ['dashboard.card.financial', '/financial'],
  },
  {
    key: 'menu_escalas',
    label: 'Menu — Escalas',
    resources: ['dashboard.card.vigilance_scales'],
    requireActiveMembership: true,
  },
  {
    key: 'menu_aniversariantes',
    label: 'Menu — Aniversariantes',
    resources: ['dashboard.card.birthdays'],
    requireActiveMembership: true,
  },
  {
    key: 'menu_membros',
    label: 'Menu — Lista de Membros',
    resources: ['dashboard.card.members_list'],
    requireActiveMembership: true,
  },
  {
    key: 'menu_administrativo',
    label: 'Menu — Administrativo',
    resources: ['dashboard.card.administrativo'],
    requireActiveMembership: true,
  },
  {
    key: 'Events',
    label: 'Menu — Programação de Eventos',
    resources: ['maintenance.card.events'],
    requireMaintenance: true,
  },
  {
    key: 'Event_gantt',
    label: 'Menu — Cronograma de Eventos',
    resources: ['maintenance.card.events_gantt'],
    requireMaintenance: true,
  },
  {
    key: 'sala_servidor',
    label: 'Menu — Sala(s) - Check In',
    resources: ['maintenance.card.sala_servidor'],
    requireMaintenance: true,
  },
  {
    key: 'scales_type',
    label: 'Menu — Tipos de Escala',
    resources: ['maintenance.card.scale_types'],
    requireMaintenance: true,
  },
  {
    key: 'scales_volunteers',
    label: 'Menu — Servos em Disponibilidade',
    resources: ['maintenance.card.scale_volunteers'],
    requireMaintenance: true,
  },
  {
    key: 'scales',
    label: 'Menu — Programação de Escalas',
    resources: ['maintenance.card.scales'],
    requireMaintenance: true,
  },
  {
    key: 'pastoral_care',
    label: 'Menu — Cuidados Pastorais',
    resources: ['maintenance.card.pastoral_care'],
    requireMaintenance: true,
  },
  {
    key: 'financials',
    label: 'Menu — Informações Financeiras',
    resources: ['maintenance.card.financials'],
    requireMaintenance: true,
  },
  {
    key: 'predictive_insights',
    label: 'Menu — Modelo Preditivo',
    resources: ['maintenance.card.predictive_insights'],
    requireMaintenance: true,
  },
  {
    key: 'relatorios',
    label: 'Menu — Relatórios',
    resources: ['maintenance.card.relatorios'],
    requireMaintenance: true,
  },
  {
    key: 'suggestions_improvements',
    label: 'Menu — Sugestões',
    resources: ['maintenance.card.suggestions_improvements', 'dashboard.card.administrativo'],
    suggestionsSpecial: true,
  },
  {
    key: 'quorum_presence',
    label: 'Menu — Presença',
    resources: ['maintenance.card.quorum_presence'],
    requireMaintenance: true,
  },
  {
    key: 'profile_cadastro',
    label: 'Menu — Cadastro de Usuário',
    resources: ['maintenance.card.profile_cadastro'],
    requireMaintenance: true,
  },
  {
    key: 'family_reception',
    label: 'Menu — Recepção Familiar',
    resources: ['maintenance.card.profile_cadastro'],
    requireMaintenance: true,
  },
  {
    key: 'access_control',
    label: 'Menu — Controle de Acesso',
    resources: ['maintenance.card.access_control'],
    requireMaintenance: true,
  },
  {
    key: 'mudanca_papeis',
    label: 'Menu — Mudança Papéis',
    resources: ['maintenance.card.mudanca_papeis'],
    requireMaintenance: true,
  },
  {
    key: 'profile_access_insights',
    label: 'Menu — Acesso Usuários',
    resources: ['maintenance.card.profile_access_insights'],
    requireMaintenance: true,
  },
  {
    key: 'auditor',
    label: 'Menu — Modo Ghost',
    resources: ['maintenance.card.auditor'],
    ghostSpecial: true,
  },
  { key: 'menu_redes_sociais', label: 'Menu — Redes Sociais', always: true },
];

const GEAR_ITEMS = [
  { key: 'gear_billing', label: 'Engrenagem — Assinaturas', always: true },
  { key: 'gear_media', label: 'Engrenagem — Autorização de imagem e voz', always: true },
  {
    key: 'gear_rooms',
    label: 'Engrenagem — Configuração de salas',
    resources: ['/configuracao-salas'],
    orSuperAdmin: true,
  },
  {
    key: 'gear_avisos',
    label: 'Engrenagem — Manutenção de Avisos',
    resources: ['maintenance.card.event_orchestration'],
    requireMaintenance: true,
  },
  {
    key: 'gear_discipleship_themes',
    label: 'Engrenagem — Temas da Trilha',
    resources: ['maintenance.card.discipleship_themes', 'maintenance.card.pastoral_care'],
    requireMaintenance: true,
  },
  {
    key: 'gear_discipleship_alerts',
    label: 'Engrenagem — Trilha — Reconhecimentos',
    resources: ['maintenance.card.discipleship_alerts', 'maintenance.card.pastoral_care'],
    requireMaintenance: true,
  },
  {
    key: 'gear_discipleship_reset',
    label: 'Engrenagem — Resetar Trilha',
    superAdminOnly: true,
  },
  {
    key: 'gear_igrejas',
    label: 'Engrenagem — Instâncias (Igrejas)',
    superAdminOnly: true,
  },
];

function loadReport() {
  const raw = fs.readFileSync(rawPath, 'utf8');
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) {
    throw new Error('JSON inválido em access-matrix-raw.json');
  }
  const parsed = JSON.parse(raw.slice(jsonStart));
  const report = parsed.rows?.[0]?.report;
  if (!report) {
    throw new Error('Campo report não encontrado no export.');
  }
  return report;
}

function shortName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(' ') || '—';
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function buildUserResourceSet(user, roleGrants) {
  const set = new Set();
  const roleCodes = new Set((user.role_codes || []).map((c) => String(c).toLowerCase()));

  for (const grant of roleGrants) {
    if (!roleCodes.has(String(grant.role_code).toLowerCase())) continue;
    if (grant.can_view) {
      set.add(`${grant.resource_type}:${grant.resource_key}`);
      set.add(grant.resource_key);
    }
  }

  return set;
}

function hasMaintenanceHub(user, resources) {
  if (user.is_super_admin) return true;
  if (resources.has('/maintenance-dashboard') || resources.has('screen:/maintenance-dashboard')) {
    return true;
  }
  for (const key of resources) {
    if (String(key).includes('maintenance.card.')) return true;
  }
  return false;
}

function canSeeItem(user, item, resources) {
  if (item.always) return true;
  if (item.superAdminOnly) return Boolean(user.is_super_admin);
  if (user.is_super_admin) return true;

  if (item.requireActiveMembership && !user.has_active_membership) {
    return false;
  }

  if (item.ghostSpecial) {
    return resources.has('maintenance.card.auditor') || resources.has('screen:maintenance.card.auditor');
  }

  if (item.suggestionsSpecial) {
    const hasMaint =
      resources.has('maintenance.card.suggestions_improvements')
      || resources.has('screen:maintenance.card.suggestions_improvements');
    const hasAdmin =
      (resources.has('dashboard.card.administrativo')
        || resources.has('screen:dashboard.card.administrativo'))
      && user.has_active_membership;
    return hasMaint || hasAdmin;
  }

  if (item.requireMaintenance && !hasMaintenanceHub(user, resources)) {
    // Ainda pode ter o card específico sem o hub em alguns papéis — checa recursos.
  }

  if (item.orSuperAdmin && user.is_super_admin) return true;

  const keys = item.resources || [];
  return keys.some(
    (key) => resources.has(key) || resources.has(`screen:${key}`) || resources.has(`table:${key}`)
  );
}

function cell(yes) {
  return yes ? 'Sim' : 'Não';
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildMarkdown(report, users, roleRows, scaleRows, menuRows, gearRows) {
  const generated = new Date(report.generated_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  const headers = ['Item / Recurso', ...users.map((u) => shortName(u.full_name))];

  const lines = [];
  lines.push('# Matriz de Visibilidade e Acessos por Usuário');
  lines.push('');
  lines.push(`Gerado em: **${generated}**`);
  lines.push('');
  lines.push(
    'Colunas = usuários com papel ACL. Células = **Sim** (visualiza/possui) ou **Não**. A aproximação de menu/engrenagem usa os grants efetivos dos papéis do perfil (super_admin = acesso total).'
  );
  lines.push('');
  lines.push(`Total de usuários: **${users.length}** · Papéis cadastrados: **${report.roles.length}**`);
  lines.push('');

  const renderTable = (title, rows) => {
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(`| ${headers.map(escapeMd).join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${row.map(escapeMd).join(' | ')} |`);
    }
    lines.push('');
  };

  renderTable('1. Papéis do perfil', roleRows);
  renderTable('2. Liderança por escala', scaleRows);
  renderTable('3. Menu principal (drawer)', menuRows);
  renderTable('4. Engrenagem (configurações)', gearRows);

  lines.push('## 5. Catálogo — Papéis e recursos (ACL)');
  lines.push('');
  lines.push('| Papel | Código | Recurso | Tipo | View | Update |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const g of report.role_grants || []) {
    lines.push(
      `| ${escapeMd(g.role_name)} | ${escapeMd(g.role_code)} | ${escapeMd(g.resource_label)} (\`${escapeMd(g.resource_key)}\`) | ${escapeMd(g.resource_type)} | ${cell(g.can_view)} | ${cell(g.can_update)} |`
    );
  }
  lines.push('');
  lines.push('## Legenda');
  lines.push('');
  lines.push('- **Papéis do perfil**: papéis atribuídos em `profile_access_roles`.');
  lines.push('- **Liderança por escala**: vínculos em `profile_scale_leadership`.');
  lines.push(
    '- **Menu / Engrenagem**: visibilidade estimada com base nos `access_grants` dos papéis + regras do app (membership ativa, hub de manutenção, super_admin).'
  );
  lines.push('- Itens sempre visíveis a todos: Início, Redes Sociais, Assinaturas, Autorização de imagem e voz.');
  lines.push('');

  return lines.join('\n');
}

function buildPdf(report, users, roleRows, scaleRows, menuRows, gearRows) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const generated = new Date(report.generated_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  const headers = ['Item / Recurso', ...users.map((u) => shortName(u.full_name))];
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 28;

  const chunkSize = 6;
  const userChunks = [];
  for (let i = 0; i < users.length; i += chunkSize) {
    userChunks.push({
      users: users.slice(i, i + chunkSize),
      start: i,
    });
  }

  const writeSection = (title, allRows) => {
    for (const chunk of userChunks) {
      doc.addPage();
      const chunkHeaders = [
        'Item / Recurso',
        ...chunk.users.map((u) => shortName(u.full_name)),
      ];
      const chunkRows = allRows.map((row) => [
        row[0],
        ...row.slice(chunk.start + 1, chunk.start + 1 + chunk.users.length),
      ]);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, 36);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Usuários ${chunk.start + 1}–${chunk.start + chunk.users.length} de ${users.length} · ${generated}`,
        margin,
        52
      );

      autoTable(doc, {
        startY: 62,
        head: [chunkHeaders],
        body: chunkRows,
        styles: {
          fontSize: 7,
          cellPadding: 2.5,
          overflow: 'linebreak',
          valign: 'middle',
          halign: 'center',
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontSize: 7,
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 170, fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index === 0) return;
          const v = String(data.cell.raw ?? '');
          if (v === 'Sim') {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fontStyle = 'bold';
          } else if (v === 'Não') {
            data.cell.styles.textColor = [185, 28, 28];
          }
        },
        margin: { left: margin, right: margin },
        tableWidth: pageWidth - margin * 2,
      });
    }
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Matriz de Visibilidade e Acessos por Usuário', margin, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${generated}`, margin, 58);
  doc.text(
    `Usuários com papéis ACL: ${users.length} · Papéis: ${report.roles.length} · Grants: ${(report.role_grants || []).length}`,
    margin,
    74
  );
  doc.text(
    'Sim = visualiza/possui · Não = sem acesso. Menu/engrenagem estimados pelos grants dos papéis (super_admin = total).',
    margin,
    90
  );

  writeSection('1. Papéis do perfil', roleRows);
  writeSection('2. Liderança por escala', scaleRows);
  writeSection('3. Menu principal (drawer)', menuRows);
  writeSection('4. Engrenagem (configurações)', gearRows);

  // Catálogo de recursos
  doc.addPage();
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Catálogo — Papéis e recursos (ACL)', margin, 36);
  autoTable(doc, {
    startY: 48,
    head: [['Papel', 'Código', 'Recurso', 'Tipo', 'View', 'Update']],
    body: (report.role_grants || []).map((g) => [
      g.role_name,
      g.role_code,
      `${g.resource_label} (${g.resource_key})`,
      g.resource_type,
      cell(g.can_view),
      cell(g.can_update),
    ]),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 90 },
      2: { cellWidth: 320 },
      3: { cellWidth: 50 },
      4: { cellWidth: 40, halign: 'center' },
      5: { cellWidth: 45,halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  doc.save(outPdf);
}

function main() {
  const report = loadReport();
  const users = (report.users || []).filter((u) => u.full_name?.trim());
  const roles = report.roles || [];
  const scaleTypes = report.scale_types || [];
  const roleGrants = report.role_grants || [];

  const userResources = users.map((u) => buildUserResourceSet(u, roleGrants));

  const roleRows = roles.map((role) => {
    const code = String(role.code).toLowerCase();
    return [
      `Papel — ${role.name} (${role.code})`,
      ...users.map((u) =>
        cell((u.role_codes || []).some((c) => String(c).toLowerCase() === code))
      ),
    ];
  });

  const scaleRows =
    scaleTypes.length > 0
      ? scaleTypes.map((st) => [
          `Liderança escala — ${st.nome}${st.codigo ? ` (${st.codigo})` : ''}`,
          ...users.map((u) =>
            cell(
              (u.scale_leadership || []).some(
                (l) => String(l.tipo_escala_id) === String(st.id) || String(l.codigo) === String(st.codigo)
              )
            )
          ),
        ])
      : [['Liderança escala — (nenhum tipo cadastrado)', ...users.map(() => '—')]];

  const menuRows = MEMBER_MENU.map((item) => [
    item.label,
    ...users.map((u, idx) => cell(canSeeItem(u, item, userResources[idx]))),
  ]);

  const gearRows = GEAR_ITEMS.map((item) => [
    item.label,
    ...users.map((u, idx) => cell(canSeeItem(u, item, userResources[idx]))),
  ]);

  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(
    outMd,
    buildMarkdown(report, users, roleRows, scaleRows, menuRows, gearRows),
    'utf8'
  );
  buildPdf(report, users, roleRows, scaleRows, menuRows, gearRows);

  const xlsxScript = path.join(__dirname, 'export-access-matrix-xlsx.mjs');
  const xlsxResult = spawnSync(process.execPath, [xlsxScript], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (xlsxResult.status !== 0) {
    throw new Error('Falha ao gerar o Excel da matriz de acessos.');
  }

  console.log(`MD  → ${outMd}`);
  console.log(`PDF → ${outPdf}`);
  console.log(`XLSX → ${path.join(root, 'docs', 'matriz-acessos-usuarios.xlsx')}`);
  console.log(`Usuários: ${users.length}`);
}

main();
