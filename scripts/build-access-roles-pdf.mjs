/**
 * Gera PDF visual dos papéis ACL (telas, tabelas e colunas por papel).
 *
 * Uso:
 *   node scripts/build-access-roles-pdf.mjs
 *
 * Fonte dos dados (em ordem):
 *   1. Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em .env.local)
 *   2. Parser dos scripts SQL em scripts/access-control*.sql
 *
 * Saída:
 *   PAPEIS_CONTROLE_ACESSO.md
 *   pdfs/PAPEIS_CONTROLE_ACESSO.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const scriptsDir = __dirname;
const outMdPath = path.join(projectRoot, 'PAPEIS_CONTROLE_ACESSO.md');
const outPdfPath = path.join(projectRoot, 'pdfs', 'PAPEIS_CONTROLE_ACESSO.pdf');

const ROLE_ORDER = [
  'visitantes',
  'congregado',
  'member',
  'family_acceptor',
  'lider',
  'events_admin',
  'pastoral',
  'super_admin',
];

const TYPE_ORDER = ['screen', 'table', 'column'];
const TYPE_LABEL = {
  screen: 'Telas',
  table: 'Tabelas',
  column: 'Colunas',
};

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
};

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));

const roleRank = (code) => {
  const index = ROLE_ORDER.indexOf(code.trim().toLowerCase());

  return index >= 0 ? index : ROLE_ORDER.length + 1;
};

const grantKey = (roleCode, resourceType, resourceKey) =>
  `${roleCode}::${resourceType}::${resourceKey}`;

const parseSqlResources = (sqlText) => {
  const resources = new Map();

  const resourceInsertRegex =
    /insert into public\.access_resources[\s\S]*?values\s*([\s\S]*?)\s*on conflict/gi;

  for (const match of sqlText.matchAll(resourceInsertRegex)) {
    const tupleRegex =
      /\(\s*'((?:screen|table|column))'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/gi;

    for (const tuple of match[1].matchAll(tupleRegex)) {
      const resourceType = tuple[1];
      const resourceKey = tuple[2].replace(/''/g, "'");
      const label = tuple[3].replace(/''/g, "'");

      resources.set(`${resourceType}::${resourceKey}`, {
        resourceType,
        resourceKey,
        label: label || resourceKey,
      });
    }
  }

  return resources;
};

const parseSqlRoles = (sqlText) => {
  const roles = new Map();

  const roleInsertRegex =
    /insert into public\.access_roles[\s\S]*?values\s*([\s\S]*?)\s*on conflict/gi;

  for (const match of sqlText.matchAll(roleInsertRegex)) {
    const tupleRegex =
      /\(\s*'([a-z][a-z0-9_]*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/gi;

    for (const tuple of match[1].matchAll(tupleRegex)) {
      const code = tuple[1];
      const name = tuple[2].replace(/''/g, "'");
      const description = tuple[3].replace(/''/g, "'");

      roles.set(code, { code, name, description });
    }
  }

  const singleRoleRegex =
    /insert into public\.access_roles[\s\S]*?values\s*\(\s*'([a-z][a-z0-9_]*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/gi;

  for (const match of sqlText.matchAll(singleRoleRegex)) {
    const code = match[1];
    const name = match[2].replace(/''/g, "'");
    const description = match[3].replace(/''/g, "'");

    roles.set(code, { code, name, description });
  }

  return roles;
};

const parseValueTuples = (valuesBlock) => {
  const rows = [];
  const tupleRegex =
    /\(\s*'((?:screen|table|column)|[^']*)'\s*(?:,\s*'((?:[^']|'')*)')+\s*\)/gi;

  const lineRegex =
    /\(\s*((?:'(?:[^']|'')*'|true|false|\d+(?:\.\d+)?)(?:\s*,\s*(?:'(?:[^']|'')*'|true|false|\d+(?:\.\d+)?))*)\s*\)/gi;

  for (const tuple of valuesBlock.matchAll(lineRegex)) {
    const parts = [];
    const partRegex = /'((?:[^']|'')*)'|true|false/gi;

    for (const part of tuple[1].matchAll(partRegex)) {
      if (part[0].toLowerCase() === 'true' || part[0].toLowerCase() === 'false') {
        parts.push(part[0].toLowerCase() === 'true');
      } else {
        parts.push((part[1] ?? '').replace(/''/g, "'"));
      }
    }

    if (parts.length < 3) {
      continue;
    }

    if (parts[0] === 'screen' || parts[0] === 'table' || parts[0] === 'column') {
      const resourceType = parts[0];
      const resourceKey = parts[1];
      const canView = parts[2] === true;
      const canUpdate = parts[3] === true;

      rows.push({ resourceType, resourceKey, canView, canUpdate });
      continue;
    }

    if (parts.length === 3 && typeof parts[2] === 'boolean') {
      rows.push({
        resourceType: 'screen',
        resourceKey: parts[0],
        canView: parts[1] === true,
        canUpdate: parts[2] === true,
      });
    }
  }

  return rows;
};

const parseSqlGrants = (sqlFiles) => {
  const resources = new Map();
  const roles = new Map();
  const grants = new Map();
  const sqlTexts = sqlFiles.map((filePath) => fs.readFileSync(filePath, 'utf8'));

  for (const sqlText of sqlTexts) {
    for (const [key, value] of parseSqlResources(sqlText)) {
      resources.set(key, value);
    }

    for (const [code, value] of parseSqlRoles(sqlText)) {
      roles.set(code, value);
    }
  }

  for (const sqlText of sqlTexts) {
    const grantRegex = /insert into public\.access_grants[\s\S]*?(?=;\s*(?:\r?\n|$))/gi;

    for (const block of sqlText.matchAll(grantRegex)) {
      const text = block[0];
      const roleMatch =
        /where\s+(?:r|pastoral)\.code\s*=\s*'([a-z][a-z0-9_]*)'/i.exec(text);

      if (!roleMatch) {
        continue;
      }

      const roleCode = roleMatch[1];

      if (text.includes("res.resource_key = '*'")) {
        for (const wildcardType of TYPE_ORDER) {
          grants.set(grantKey(roleCode, wildcardType, '*'), {
            roleCode,
            resourceType: wildcardType,
            resourceKey: '*',
            label: `Todas as ${TYPE_LABEL[wildcardType].toLowerCase()} (curinga)`,
            canView: true,
            canUpdate: true,
          });
        }
        continue;
      }

      const inKeysMatch = /resource_key in \(([\s\S]*?)\)/i.exec(text);

      if (inKeysMatch) {
        const keys = [...inKeysMatch[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
          m[1].replace(/''/g, "'")
        );
        const typeMatch = /resource_type\s*=\s*'([a-z]+)'/i.exec(text);
        const resourceType = typeMatch?.[1] ?? 'screen';

        for (const resourceKey of keys) {
          grants.set(grantKey(roleCode, resourceType, resourceKey), {
            roleCode,
            resourceType,
            resourceKey,
            label: resources.get(`${resourceType}::${resourceKey}`)?.label ?? resourceKey,
            canView: true,
            canUpdate: text.includes('true, true') || resourceType === 'table',
          });
        }
        continue;
      }

      const valuesMatch = /values\s*([\s\S]*?)\)\s*as\s+g/i.exec(text);

      if (!valuesMatch) {
        if (text.includes('member_grant.resource_id')) {
          const pastoralExtras = grants;
          const memberGrants = [...grants.values()].filter((g) => g.roleCode === 'member');

          for (const memberGrant of memberGrants) {
            pastoralExtras.set(
              grantKey('pastoral', memberGrant.resourceType, memberGrant.resourceKey),
              { ...memberGrant, roleCode: 'pastoral' }
            );
          }
        }

        continue;
      }

      const tuples = parseValueTuples(valuesMatch[1]);

      for (const tuple of tuples) {
        grants.set(grantKey(roleCode, tuple.resourceType, tuple.resourceKey), {
          roleCode,
          resourceType: tuple.resourceType,
          resourceKey: tuple.resourceKey,
          label:
            resources.get(`${tuple.resourceType}::${tuple.resourceKey}`)?.label ??
            tuple.resourceKey,
          canView: tuple.canView,
          canUpdate: tuple.canUpdate,
        });
      }
    }
  }

  return { roles, grants: [...grants.values()] };
};

const fetchGrantsFromSupabase = async () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [{ data: roles, error: rolesError }, { data: resources, error: resourcesError }, { data: grants, error: grantsError }] =
    await Promise.all([
      supabase.from('access_roles').select('id, code, name, description'),
      supabase.from('access_resources').select('id, resource_type, resource_key, label, is_active'),
      supabase
        .from('access_grants')
        .select('role_id, resource_id, can_view, can_update')
        .not('role_id', 'is', null),
    ]);

  if (rolesError || resourcesError || grantsError) {
    throw rolesError ?? resourcesError ?? grantsError;
  }

  const roleById = new Map((roles ?? []).map((row) => [row.id, row]));
  const resourceById = new Map((resources ?? []).map((row) => [row.id, row]));

  const parsedGrants = [];

  for (const grant of grants ?? []) {
    const role = roleById.get(grant.role_id);
    const resource = resourceById.get(grant.resource_id);

    if (!role || !resource || resource.is_active === false) {
      continue;
    }

    if (!grant.can_view && !grant.can_update) {
      continue;
    }

    parsedGrants.push({
      roleCode: role.code,
      roleName: role.name,
      roleDescription: role.description ?? '',
      resourceType: resource.resource_type,
      resourceKey: resource.resource_key,
      label: resource.label?.trim() || resource.resource_key,
      canView: Boolean(grant.can_view),
      canUpdate: Boolean(grant.can_update),
    });
  }

  return {
    roles: new Map(
      (roles ?? []).map((row) => [
        row.code,
        { code: row.code, name: row.name, description: row.description ?? '' },
      ])
    ),
    grants: parsedGrants,
    source: 'supabase',
  };
};

const loadGrants = async () => {
  try {
    const remote = await fetchGrantsFromSupabase();

    if (remote?.grants?.length) {
      return remote;
    }
  } catch (error) {
    console.warn('Supabase indisponível, usando scripts SQL:', error?.message ?? error);
  }

  const sqlFiles = fs
    .readdirSync(scriptsDir)
    .filter(
      (name) =>
        (name.startsWith('access-control') && name.endsWith('.sql')) ||
        name === 'financial-module-access.sql'
    )
    .map((name) => path.join(scriptsDir, name))
    .sort();

  const parsed = parseSqlGrants(sqlFiles);

  return {
    roles: parsed.roles,
    grants: parsed.grants.map((grant) => {
      const role = parsed.roles.get(grant.roleCode);

      return {
        ...grant,
        roleName: role?.name ?? grant.roleCode,
        roleDescription: role?.description ?? '',
      };
    }),
    source: 'sql-scripts',
  };
};

const permCell = (allowed) => (allowed ? '**Sim**' : '—');

const buildMarkdown = ({ roles, grants, source }) => {
  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const grantsByRole = new Map();

  for (const grant of grants) {
    const bucket = grantsByRole.get(grant.roleCode) ?? [];
    bucket.push(grant);
    grantsByRole.set(grant.roleCode, bucket);
  }

  const roleCodes = [...new Set([...roles.keys(), ...grantsByRole.keys()])].sort(
    (left, right) => roleRank(left) - roleRank(right)
  );

  const lines = [
    '# Mapa visual de papéis — Controle de Acesso',
    '',
    `Gerado em: ${generatedAt}`,
    `Fonte: ${source === 'supabase' ? 'banco Supabase (ao vivo)' : 'scripts SQL do repositório'}`,
    '',
    'Legenda: **Ver** = visualizar recurso; **Editar** = alterar recurso.',
    '',
    '---',
    '',
  ];

  for (const roleCode of roleCodes) {
    const role = roles.get(roleCode);
    const roleGrants = (grantsByRole.get(roleCode) ?? []).sort((left, right) => {
      const byType = TYPE_ORDER.indexOf(left.resourceType) - TYPE_ORDER.indexOf(right.resourceType);

      if (byType !== 0) {
        return byType;
      }

      return left.label.localeCompare(right.label, 'pt-BR');
    });

    if (!roleGrants.length) {
      continue;
    }

    lines.push(`## ${role?.name ?? roleCode}`);
    lines.push('');
    lines.push(`- **Código:** \`${roleCode}\``);

    if (role?.description) {
      lines.push(`- **Descrição:** ${role.description}`);
    }

    lines.push('');

    for (const resourceType of TYPE_ORDER) {
      const sectionGrants = roleGrants.filter((grant) => grant.resourceType === resourceType);

      if (!sectionGrants.length) {
        continue;
      }

      lines.push(`### ${TYPE_LABEL[resourceType]}`);
      lines.push('');
      lines.push('| Nome | Chave técnica | Ver | Editar |');
      lines.push('| --- | --- | :---: | :---: |');

      for (const grant of sectionGrants) {
        lines.push(
          `| ${grant.label} | \`${grant.resourceKey}\` | ${permCell(grant.canView)} | ${permCell(grant.canUpdate)} |`
        );
      }

      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
};

const pdfCss = `
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.4;
    color: #1e293b;
  }
  h1 { font-size: 20pt; color: #0f172a; page-break-after: avoid; }
  h2 {
    font-size: 15pt;
    color: #1e3a8a;
    margin-top: 1.4em;
    page-break-before: always;
    page-break-after: avoid;
  }
  h2:first-of-type { page-break-before: avoid; }
  h3 { font-size: 12pt; color: #334155; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 8px 0 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
  th { background: #f1f5f9; text-align: left; }
  td:nth-child(3), td:nth-child(4), th:nth-child(3), th:nth-child(4) { text-align: center; width: 56px; }
  code { font-family: Consolas, 'Courier New', monospace; font-size: 8.5pt; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
`;

const main = async () => {
  const data = await loadGrants();

  if (!data.grants.length) {
    console.error('Nenhum grant encontrado. Configure .env.local ou execute os scripts ACL no Supabase.');
    process.exit(1);
  }

  const markdown = buildMarkdown(data);
  fs.writeFileSync(outMdPath, markdown, 'utf8');
  console.log(`Markdown: ${outMdPath}`);
  console.log(`Fonte: ${data.source}`);
  console.log(`Papéis com grants: ${new Set(data.grants.map((g) => g.roleCode)).size}`);

  fs.mkdirSync(path.dirname(outPdfPath), { recursive: true });
  process.stdout.write(`Gerando PDF ... `);

  const pdf = await mdToPdf(
    { content: markdown },
    {
      dest: outPdfPath,
      pdf_options: {
        format: 'A4',
        margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
        printBackground: true,
      },
      css: pdfCss,
      launch_options: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    }
  );

  if (!pdf?.filename) {
    throw new Error('PDF não gerado');
  }

  console.log('ok');
  console.log(`PDF: ${outPdfPath}`);
};

await main();
