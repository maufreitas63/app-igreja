import {
  buildFinancialAnalyticalSummaryReport,
  type FinancialAnalyticalSummaryReport,
} from '@/lib/financialAnalyticalSummaryReport';
import type { FinancialEntry } from '@/lib/financialEntry';
import { formatFinancialBrl, formatFinancialMonthLabel, type FinancialMonthKey } from '@/lib/financialMonth';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 14;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

type JsPDF = import('jspdf').jsPDF;

const loadJsPdf = async () => {
  const module = await import('jspdf/dist/jspdf.es.min.js');
  return module.jsPDF;
};

const navy = [30, 58, 95] as const;
const muted = [100, 116, 139] as const;
const ink = [15, 23, 42] as const;

const money = (value: number) => formatFinancialBrl(value);

const drawTable = (
  doc: JsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
) => {
  const rowHeight = 7;
  let cursorY = y;
  const startX = MARGIN_X;

  const drawRow = (cells: string[], header: boolean) => {
    if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    let x = startX;
    cells.forEach((cell, index) => {
      const width = colWidths[index] ?? 30;
      if (header) {
        doc.setFillColor(navy[0], navy[1], navy[2]);
        doc.rect(x, cursorY, width, rowHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, cursorY, width, rowHeight);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.setFont('helvetica', index === 0 ? 'normal' : 'bold');
      }
      doc.setFontSize(8);
      const align = index === 0 ? 'left' : 'right';
      const textX = align === 'left' ? x + 2 : x + width - 2;
      doc.text(cell, textX, cursorY + 4.8, { align });
      x += width;
    });
    cursorY += rowHeight;
  };

  drawRow(headers, true);
  rows.forEach((row) => drawRow(row, false));
  return cursorY + 4;
};

const renderReport = (
  doc: JsPDF,
  report: FinancialAnalyticalSummaryReport,
  churchName: string
) => {
  const monthLabel = formatFinancialMonthLabel(report.endMonth);

  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(MARGIN_X, MARGIN_TOP, CONTENT_WIDTH, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`RESUMO FINANCEIRO ${monthLabel}`, PAGE_WIDTH / 2, MARGIN_TOP + 9, { align: 'center' });

  let y = MARGIN_TOP + 20;
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (churchName) {
    doc.text(churchName, MARGIN_X, y);
    y += 6;
  }

  const cashHeaders = ['Movimento', ...report.cashflowColumns.map((column) => column.header)];
  const cashRows = [
    ['Entradas', ...report.cashflowColumns.map((column) => money(column.entradas))],
    ['Saídas', ...report.cashflowColumns.map((column) => money(column.saidas))],
    ['Total', ...report.cashflowColumns.map((column) => money(column.total))],
  ];
  const threeCol = [CONTENT_WIDTH * 0.34, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.22];
  y = drawTable(doc, y, cashHeaders, cashRows, threeCol);

  const periodHeaders = ['Período', ...report.periodColumns.map((column) => column.header)];
  const periodRows = [
    ['Ordinário', ...report.periodColumns.map((column) => money(column.ordinario))],
    ['Extraordinário', ...report.periodColumns.map((column) => money(column.extraordinario))],
    ['Resultado total', ...report.periodColumns.map((column) => money(column.total))],
  ];
  y = drawTable(doc, y, periodHeaders, periodRows, threeCol);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('MOVIMENTOS DO MÊS', MARGIN_X, y);
  y += 4;

  const moveHeaders = ['Conta', 'Ordinários', 'Extraordinários', 'Total'];
  const moveRows = [
    ...report.accountRows.map((row) => [
      row.account,
      money(row.ordinario),
      money(row.extraordinario),
      money(row.total),
    ]),
    [
      'TOTAL',
      money(report.monthTotals.ordinario),
      money(report.monthTotals.extraordinario),
      money(report.monthTotals.total),
    ],
  ];
  y = drawTable(doc, y, moveHeaders, moveRows, threeCol);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('ACUMULADO HISTÓRICO', MARGIN_X, y);
  y += 4;
  drawTable(
    doc,
    y,
    ['Ordinário', 'Extraordinário', 'Saldo acumulado'],
    [[
      money(report.historical.ordinario),
      money(report.historical.extraordinario),
      money(report.historical.saldo),
    ]],
    [CONTENT_WIDTH / 3, CONTENT_WIDTH / 3, CONTENT_WIDTH / 3]
  );
};

export async function buildFinancialAnalyticalSummaryPdfBlob(input: {
  endMonth: FinancialMonthKey;
  realizedEntries: FinancialEntry[];
  churchName?: string;
}): Promise<{ blob: Blob; fileName: string }> {
  const jsPDF = await loadJsPdf();
  const report = buildFinancialAnalyticalSummaryReport(input.endMonth, input.realizedEntries);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  renderReport(doc, report, input.churchName?.trim() || '');

  const monthKey = `${input.endMonth.year}-${String(input.endMonth.month).padStart(2, '0')}`;
  const fileName = `resumo-financeiro-${monthKey}.pdf`;
  const blob = doc.output('blob') as Blob;
  return { blob, fileName };
}
