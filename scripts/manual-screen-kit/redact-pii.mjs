import {
  FICTIONAL,
  fictionalFamilyRepresentative,
  fictionalIndividualName,
  pad3,
} from './fictional-data.mjs';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const STATIC_REPLACEMENTS = [
  ['Maurício de Freitas', FICTIONAL.representative],
  ['Mauricio de Freitas', FICTIONAL.representative],
  ['Maurício Freitas', FICTIONAL.representative],
  ['Inalva Pereira Santiago de Freitas', FICTIONAL.spouse],
  ['Karina Santiago de Freitas', FICTIONAL.teen],
  ['IBN0001', FICTIONAL.familyCode],
  ['(19) 99616-6161', FICTIONAL.phonePrimary],
  ['(19) 98826-2617', FICTIONAL.phoneSecondary],
  ['(19) 99832-1832', FICTIONAL.phoneTertiary],
  ['Igreja Batista Norte', FICTIONAL.churchName],
];

/**
 * @returns {Promise<{ from: string, to: string }[]>}
 */
export async function loadRedactionReplacements() {
  const pairs = [...STATIC_REPLACEMENTS.map(([from, to]) => ({ from, to }))];
  const seen = new Set(pairs.map((p) => p.from.toLowerCase()));

  const push = (from, to) => {
    const key = String(from || '').trim();
    if (!key || key.length < 2 || seen.has(key.toLowerCase())) return;
    seen.add(key.toLowerCase());
    pairs.push({ from: key, to });
  };

  try {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };

    const [profiles, members] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=full_name,phone,family_id,codigo_membro,email&limit=1000`, {
        headers,
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/members?select=full_name,phone,family_id&limit=1000`, {
        headers,
      }).then((r) => (r.ok ? r.json() : [])),
    ]);

    let nameIndex = 1;
    let familyIndex = 1;

    const mapName = (rawName) => {
      const name = String(rawName || '').trim();
      if (!name || name.toLowerCase().includes('tstmax')) {
        return fictionalIndividualName(nameIndex++);
      }
      if (name.toLowerCase().includes('representante')) {
        return fictionalFamilyRepresentative(familyIndex++);
      }
      return fictionalIndividualName(nameIndex++);
    };

    for (const row of [...(profiles || []), ...(members || [])]) {
      if (row.full_name) push(row.full_name, mapName(row.full_name));
      if (row.phone) push(row.phone, FICTIONAL.phonePrimary);
      if (row.family_id && !String(row.family_id).startsWith('TstMax')) {
        push(row.family_id, `TstMaxF${pad3((familyIndex % 30) + 1)}`);
      }
      if (row.codigo_membro && !String(row.codigo_membro).startsWith('TstMax')) {
        push(row.codigo_membro, FICTIONAL.memberCode);
      }
      if (row.email && !String(row.email).includes('@tstmax.demo')) {
        push(row.email, `usuario${nameIndex}${FICTIONAL.emailDomain}`);
      }
    }
  } catch (err) {
    console.warn('Redação: não foi possível carregar perfis do Supabase:', err.message);
  }

  return pairs.sort((a, b) => b.from.length - a.from.length);
}

/**
 * @param {import('puppeteer').Page} page
 * @param {{ from: string, to: string }[]} replacements
 */
export async function redactPagePii(page, replacements) {
  await page.evaluate(
    (pairs, fictional) => {
      const literal = pairs.filter((p) => p.from && p.to);

      const regexRules = [
        [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, fictional.cnpj],
        [/\bIBN\d{3,6}\b/gi, fictional.familyCode],
        [/\bFAM-\d+\b/gi, fictional.familyCode],
        [/\(\d{2}\)\s*\d{4,5}-\d{4}/g, fictional.phonePrimary],
        [/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, '12990001001'],
        [/[A-Z]{3}\d[A-Z]\d{2,3}/g, fictional.plate],
        [/\b[A-Z0-9._%+-]+@(?!tstmax\.demo)[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, `usuario${fictional.emailDomain}`],
      ];

      const apply = (value) => {
        if (!value) return value;
        let next = value;
        for (const { from, to } of literal) {
          next = next.split(from).join(to);
        }
        for (const [pattern, to] of regexRules) {
          next = next.replace(pattern, to);
        }
        return next;
      };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;
        const updated = apply(node.textContent || '');
        if (updated !== node.textContent) node.textContent = updated;
      }

      document.querySelectorAll('input, textarea').forEach((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const updated = apply(el.value);
          if (updated !== el.value) el.value = updated;
          const placeholder = apply(el.getAttribute('placeholder') || '');
          if (placeholder !== el.getAttribute('placeholder')) el.setAttribute('placeholder', placeholder);
        }
      });
    },
    replacements,
    FICTIONAL
  );
}
