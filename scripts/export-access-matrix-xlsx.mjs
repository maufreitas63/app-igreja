/**
 * Converte docs/matriz-acessos-usuarios.md → docs/matriz-acessos-usuarios.xlsx
 *
 * Uso: node scripts/export-access-matrix-xlsx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mdPath = path.join(root, 'docs', 'matriz-acessos-usuarios.md');
const outPath = path.join(root, 'docs', 'matriz-acessos-usuarios.xlsx');

const SHEET_META = [
  { match: /^1\.\s*Papéis/, name: '1. Papéis', color: '1E3A8A' },
  { match: /^2\.\s*Liderança/, name: '2. Liderança escala', color: '0F766E' },
  { match: /^3\.\s*Menu/, name: '3. Menu principal', color: '1D4ED8' },
  { match: /^4\.\s*Engrenagem/, name: '4. Engrenagem', color: '7C3AED' },
  { match: /^5\.\s*Catálogo/, name: '5. Catálogo ACL', color: 'B45309' },
];

function parseMarkdownTables(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;
  let generatedAt = '';

  const generatedMatch = md.match(/Gerado em:\s*\*\*(.+?)\*\*/);
  if (generatedMatch) {
    generatedAt = generatedMatch[1].trim();
  }

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)\s*$/);
    if (heading) {
      const title = heading[1].trim();
      if (title.toLowerCase().startsWith('legenda')) {
        current = null;
        continue;
      }
      current = { title, headers: [], rows: [] };
      sections.push(current);
      continue;
    }

    if (!current || !line.startsWith('|')) {
      continue;
    }

    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim().replace(/\\\|/g, '|'));

    if (cells.every((cell) => /^:?-+:?$/.test(cell))) {
      continue;
    }

    if (current.headers.length === 0) {
      current.headers = cells;
      continue;
    }

    current.rows.push(cells);
  }

  return { generatedAt, sections };
}

function sheetNameFor(title) {
  const meta = SHEET_META.find((item) => item.match.test(title));
  const raw = meta?.name ?? title.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31);
  return raw.slice(0, 31);
}

function headerColorFor(title) {
  return SHEET_META.find((item) => item.match.test(title))?.color ?? '0F172A';
}

function applyMatrixSheet(workbook, section) {
  const sheet = workbook.addWorksheet(sheetNameFor(section.title), {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    properties: { defaultRowHeight: 18 },
  });

  const headers = section.headers;
  const headerRow = sheet.addRow(headers);

  headerRow.height = 36;
  headerRow.eachCell((cell, colNumber) => {
    cell.value = headers[colNumber - 1] ?? '';
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${headerColorFor(section.title)}` },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 1 ? 'left' : 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  sheet.getColumn(1).width = 42;
  for (let col = 2; col <= headers.length; col += 1) {
    sheet.getColumn(col).width = 12;
  }

  section.rows.forEach((rowCells, rowIndex) => {
    const excelRow = sheet.addRow(rowCells);
    excelRow.height = 18;

    excelRow.eachCell((cell, colNumber) => {
      const raw = String(rowCells[colNumber - 1] ?? '');
      cell.font = {
        name: 'Calibri',
        size: colNumber === 1 ? 9 : 10,
        bold: colNumber === 1 || raw === 'Sim',
        color:
          raw === 'Sim'
            ? { argb: 'FF047857' }
            : raw === 'Não'
              ? { argb: 'FFB91C1C' }
              : { argb: 'FF0F172A' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : 'center',
        wrapText: colNumber === 1,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (rowIndex % 2 === 1 && colNumber === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      if (raw === 'Sim') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' },
        };
      } else if (raw === 'Não') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

function applyCatalogSheet(workbook, section) {
  const sheet = workbook.addWorksheet(sheetNameFor(section.title), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = section.headers;
  const headerRow = sheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${headerColorFor(section.title)}` },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const widths = [28, 22, 55, 12, 10, 10];
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = widths[index] ?? 18;
  });

  section.rows.forEach((rowCells, rowIndex) => {
    const excelRow = sheet.addRow(rowCells);
    excelRow.eachCell((cell, colNumber) => {
      const raw = String(rowCells[colNumber - 1] ?? '');
      cell.font = { name: 'Calibri', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 4 ? 'center' : 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      if (raw === 'Sim') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' },
        };
      } else if (raw === 'Não') {
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FFB91C1C' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

async function main() {
  if (!fs.existsSync(mdPath)) {
    throw new Error(`Arquivo não encontrado: ${mdPath}`);
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const { generatedAt, sections } = parseMarkdownTables(md);

  if (!sections.length) {
    throw new Error('Nenhuma tabela encontrada no markdown.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'app-igreja';
  workbook.created = new Date();
  workbook.modified = new Date();

  const cover = workbook.addWorksheet('Capa', {
    properties: { tabColor: { argb: 'FF0F172A' } },
  });
  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 70;
  cover.addRow(['Matriz de Visibilidade e Acessos por Usuário']).font = {
    bold: true,
    size: 16,
    color: { argb: 'FF0F172A' },
  };
  cover.addRow([]);
  cover.addRow(['Gerado em', generatedAt || '—']);
  cover.addRow(['Origem', 'docs/matriz-acessos-usuarios.md']);
  cover.addRow(['Usuários (colunas)', String(Math.max(0, (sections[0]?.headers.length ?? 1) - 1))]);
  cover.addRow(['Abas', sections.map((section) => sheetNameFor(section.title)).join(' · ')]);
  cover.addRow([]);
  cover.addRow(['Legenda']).font = { bold: true, size: 12 };
  cover.addRow(['Sim', 'Visualiza / possui o item']).eachCell((cell, col) => {
    if (col === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { bold: true, color: { argb: 'FF047857' } };
    }
  });
  cover.addRow(['Não', 'Sem acesso / sem atribuição']).eachCell((cell, col) => {
    if (col === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { bold: true, color: { argb: 'FFB91C1C' } };
    }
  });
  cover.addRow([]);
  cover.addRow([
    'Observação',
    'Menu e engrenagem estimados pelos grants dos papéis (super_admin = acesso total). Primeira coluna congelada; filtros ativos no cabeçalho.',
  ]);

  for (const section of sections) {
    if (/^5\./.test(section.title)) {
      applyCatalogSheet(workbook, section);
    } else {
      applyMatrixSheet(workbook, section);
    }
  }

  await workbook.xlsx.writeFile(outPath);
  console.log(`Excel → ${outPath}`);
  console.log(`Abas: ${workbook.worksheets.map((sheet) => sheet.name).join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
