import {
  formatSupportSuggestionDateTime,
  formatSupportSuggestionHistoricoMeta,
  formatSupportSuggestionHistoricoTitle,
  parseSupportSuggestionReportRow,
  type SupportSuggestionReportRow,
} from '@/lib/maintenanceSupportSuggestionsReport';
import type { MaintenanceReportResult } from '@/lib/maintenanceReportsApi';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const LINE_HEIGHT = 4.6;
const SECTION_GAP = 3;
const TOTAL_PAGES_ALIAS = '{total_pages}';

const COLORS = {
  ink: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  accent: [124, 58, 237] as const,
  accentSoft: [237, 233, 254] as const,
};

type JsPDF = import('jspdf').jsPDF;

type PdfContext = {
  doc: JsPDF;
  y: number;
  pageNumber: number;
  generatedAt?: string;
};

const loadJsPdf = async () => {
  const module = await import('jspdf/dist/jspdf.es.min.js');
  return module.jsPDF;
};

const drawPageFooter = (doc: JsPDF, pageNumber: number, generatedAt?: string) => {
  const footerY = PAGE_HEIGHT - 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text(`Página ${pageNumber} de ${TOTAL_PAGES_ALIAS}`, PAGE_WIDTH / 2, footerY, {
    align: 'center',
  });

  if (generatedAt) {
    doc.text(
      `Gerado em ${formatSupportSuggestionDateTime(generatedAt)}`,
      PAGE_WIDTH - MARGIN_X,
      footerY,
      { align: 'right' }
    );
  }
};

const applyFooters = (doc: JsPDF, generatedAt?: string) => {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawPageFooter(doc, page, generatedAt);
  }

  doc.putTotalPages(TOTAL_PAGES_ALIAS);
};

const ensureSpace = (ctx: PdfContext, height: number) => {
  const bottomLimit = PAGE_HEIGHT - MARGIN_BOTTOM;

  if (ctx.y + height <= bottomLimit) {
    return;
  }

  ctx.doc.addPage();
  ctx.pageNumber += 1;
  ctx.y = MARGIN_TOP;
};

const writeLines = (
  ctx: PdfContext,
  lines: string[],
  options?: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    color?: readonly [number, number, number];
    indent?: number;
    lineHeight?: number;
  }
) => {
  const fontSize = options?.fontSize ?? 10;
  const fontStyle = options?.fontStyle ?? 'normal';
  const color = options?.color ?? COLORS.ink;
  const indent = options?.indent ?? 0;
  const lineHeight = options?.lineHeight ?? LINE_HEIGHT;

  ctx.doc.setFont('helvetica', fontStyle);
  ctx.doc.setFontSize(fontSize);
  ctx.doc.setTextColor(color[0], color[1], color[2]);

  for (const line of lines) {
    ensureSpace(ctx, lineHeight + 0.5);
    ctx.doc.text(line, MARGIN_X + indent, ctx.y);
    ctx.y += lineHeight;
  }
};

const writeWrapped = (
  ctx: PdfContext,
  text: string,
  options?: Parameters<typeof writeLines>[2]
) => {
  const fontSize = options?.fontSize ?? 10;
  const indent = options?.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;

  ctx.doc.setFontSize(fontSize);
  const lines = ctx.doc.splitTextToSize(text, maxWidth) as string[];
  writeLines(ctx, lines, options);
};

const writeSectionLabel = (ctx: PdfContext, label: string) => {
  ctx.y += SECTION_GAP;
  writeLines(ctx, [label.toUpperCase()], {
    fontSize: 8,
    fontStyle: 'bold',
    color: COLORS.muted,
    lineHeight: 4,
  });
};

const drawRequestHeaderBand = (ctx: PdfContext, index: number, total: number) => {
  const bandHeight = 14;
  ensureSpace(ctx, bandHeight + 6);

  ctx.doc.setFillColor(COLORS.accentSoft[0], COLORS.accentSoft[1], COLORS.accentSoft[2]);
  ctx.doc.roundedRect(MARGIN_X, ctx.y - 4, CONTENT_WIDTH, bandHeight, 2, 2, 'F');

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  ctx.doc.text('Sugestões e Melhorias', MARGIN_X + 4, ctx.y + 2);

  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  ctx.doc.text(`Solicitação ${index + 1} de ${total}`, PAGE_WIDTH - MARGIN_X - 4, ctx.y + 2, {
    align: 'right',
  });

  ctx.y += bandHeight + 2;
};

const drawStatusBadge = (ctx: PdfContext, status: string) => {
  const badgeWidth = Math.min(42, Math.max(28, status.length * 2.4 + 10));
  const badgeX = PAGE_WIDTH - MARGIN_X - badgeWidth;
  const badgeY = ctx.y - 1;

  ctx.doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  ctx.doc.setFillColor(255, 255, 255);
  ctx.doc.roundedRect(badgeX, badgeY, badgeWidth, 8, 2, 2, 'FD');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  ctx.doc.text(status || '—', badgeX + badgeWidth / 2, badgeY + 5.2, { align: 'center' });
};

const renderHistorico = (ctx: PdfContext, row: SupportSuggestionReportRow) => {
  writeSectionLabel(ctx, 'Histórico cronológico');

  if (row.historico.length === 0) {
    writeWrapped(ctx, 'Nenhuma interação registrada.', {
      fontSize: 9,
      color: COLORS.muted,
      fontStyle: 'italic',
    });
    return;
  }

  row.historico.forEach((entry, entryIndex) => {
    const title = formatSupportSuggestionHistoricoTitle(entry);
    const meta = formatSupportSuggestionHistoricoMeta(entry);
    const dateLabel = formatSupportSuggestionDateTime(entry.data_hora);

    writeLines(ctx, [`${entryIndex + 1}. ${title}`], {
      fontSize: 9.5,
      fontStyle: 'bold',
      lineHeight: 4.4,
    });
    writeLines(ctx, [`${dateLabel}${meta ? ` · ${meta}` : ''}`], {
      fontSize: 8,
      color: COLORS.muted,
      lineHeight: 4,
    });

    if (entry.mensagem.trim()) {
      writeWrapped(ctx, entry.mensagem.trim(), {
        fontSize: 9,
        indent: 4,
        lineHeight: 4.2,
      });
    }

    ctx.y += 1.5;
  });
};

const renderRequest = (
  ctx: PdfContext,
  row: SupportSuggestionReportRow,
  index: number,
  total: number
) => {
  if (index > 0) {
    ctx.doc.addPage();
    ctx.pageNumber += 1;
    ctx.y = MARGIN_TOP;
  }

  drawRequestHeaderBand(ctx, index, total);

  const titleStartY = ctx.y;
  writeLines(ctx, [row.tipo || 'Solicitação'], {
    fontSize: 14,
    fontStyle: 'bold',
    lineHeight: 6.5,
  });
  drawStatusBadge(ctx, row.status);
  ctx.y = Math.max(ctx.y, titleStartY + 10);

  writeWrapped(
    ctx,
    `${row.solicitante}${row.telefone ? ` · ${row.telefone}` : ''}`,
    { fontSize: 9.5, color: COLORS.muted, lineHeight: 4.4 }
  );
  writeWrapped(ctx, `Aberta em ${formatSupportSuggestionDateTime(row.abertura_em)}`, {
    fontSize: 9,
    color: COLORS.muted,
    lineHeight: 4.2,
  });

  if (row.tema?.trim()) {
    writeSectionLabel(ctx, 'Tema');
    writeWrapped(ctx, row.tema.trim(), { fontSize: 10, lineHeight: 4.6 });
  }

  writeSectionLabel(ctx, 'Descrição detalhada');
  writeWrapped(ctx, row.descricao || '—', { fontSize: 10, lineHeight: 4.6 });

  writeSectionLabel(ctx, 'Preferências de contato');
  writeWrapped(
    ctx,
    `WhatsApp ${row.whatsapp_autorizado ? 'autorizado' : 'não autorizado'} · Notificação no app ${
      row.notificar_app ? 'ativa' : 'inativa'
    }`,
    { fontSize: 9, lineHeight: 4.2 }
  );

  writeWrapped(ctx, `Atualizada em ${formatSupportSuggestionDateTime(row.atualizado_em)}`, {
    fontSize: 8.5,
    color: COLORS.muted,
    lineHeight: 4,
  });

  if (row.respondido_em) {
    writeWrapped(ctx, `Resposta em ${formatSupportSuggestionDateTime(row.respondido_em)}`, {
      fontSize: 8.5,
      color: COLORS.muted,
      lineHeight: 4,
    });
  }

  if (row.anexos > 0) {
    writeSectionLabel(ctx, `Anexos (${row.anexos})`);
    writeWrapped(
      ctx,
      row.anexos_nomes.length > 0 ? row.anexos_nomes.join(', ') : `${row.anexos} arquivo(s)`,
      { fontSize: 9, lineHeight: 4.2 }
    );
  }

  const hasTreatment =
    Boolean(row.acao_desenvolvedor?.trim())
    || Boolean(row.orientacoes?.trim())
    || Boolean(row.previsao_conclusao?.trim());

  if (hasTreatment) {
    writeSectionLabel(ctx, 'Tratamento pelo desenvolvedor');

    if (row.acao_desenvolvedor?.trim()) {
      writeLines(ctx, ['Ação tomada ou planejada'], {
        fontSize: 8,
        fontStyle: 'bold',
        color: COLORS.muted,
        lineHeight: 3.8,
      });
      writeWrapped(ctx, row.acao_desenvolvedor.trim(), { fontSize: 9.5, lineHeight: 4.4 });
    }

    if (row.previsao_conclusao?.trim()) {
      writeLines(ctx, ['Previsão de implementação/conclusão'], {
        fontSize: 8,
        fontStyle: 'bold',
        color: COLORS.muted,
        lineHeight: 3.8,
      });
      writeWrapped(ctx, row.previsao_conclusao.trim(), { fontSize: 9.5, lineHeight: 4.4 });
    }

    if (row.orientacoes?.trim()) {
      writeLines(ctx, ['Orientações detalhadas ao usuário'], {
        fontSize: 8,
        fontStyle: 'bold',
        color: COLORS.muted,
        lineHeight: 3.8,
      });
      writeWrapped(ctx, row.orientacoes.trim(), { fontSize: 9.5, lineHeight: 4.4 });
    }
  }

  renderHistorico(ctx, row);
};

const buildPdfDocument = async (result: MaintenanceReportResult) => {
  const jsPDF = await loadJsPdf();
  const rows = result.rows.map((row) => parseSupportSuggestionReportRow(row));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const ctx: PdfContext = {
    doc,
    y: MARGIN_TOP,
    pageNumber: 1,
    generatedAt: result.generatedAt,
  };

  if (rows.length === 0) {
    writeWrapped(ctx, 'Nenhuma solicitação encontrada para os filtros informados.', {
      fontSize: 12,
      lineHeight: 6,
    });
    applyFooters(doc, result.generatedAt);
    return doc;
  }

  rows.forEach((row, index) => {
    renderRequest(ctx, row, index, rows.length);
  });

  applyFooters(doc, result.generatedAt);
  return doc;
};

export async function buildSupportSuggestionsReportPdfBlob(
  result: MaintenanceReportResult
): Promise<Blob> {
  const doc = await buildPdfDocument(result);
  return doc.output('blob');
}

export async function buildSupportSuggestionsReportPdfObjectUrl(
  result: MaintenanceReportResult
): Promise<string> {
  const blob = await buildSupportSuggestionsReportPdfBlob(result);
  return URL.createObjectURL(blob);
}
