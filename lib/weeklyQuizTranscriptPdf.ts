const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const LINE_HEIGHT = 5;

const INK = [15, 23, 42] as const;
const MUTED = [71, 85, 105] as const;
const NAVY = [0, 0, 139] as const;

type JsPDF = import('jspdf').jsPDF;

type PdfContext = {
  doc: JsPDF;
  y: number;
};

const loadJsPdf = async () => {
  // @ts-expect-error — bundle ESM minificado do jspdf não declara tipos
  const module = await import('jspdf/dist/jspdf.es.min.js');
  return module.jsPDF as new (options: { unit: 'mm'; format: 'a4' }) => JsPDF;
};

const ensureSpace = (ctx: PdfContext, height: number) => {
  if (ctx.y + height <= PAGE_HEIGHT - MARGIN_BOTTOM) {
    return;
  }

  ctx.doc.addPage();
  ctx.y = MARGIN_TOP;
};

const writeLines = (ctx: PdfContext, lines: string[], size: number, style: 'normal' | 'bold', color: readonly [number, number, number]) => {
  ctx.doc.setFont('helvetica', style);
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(color[0], color[1], color[2]);

  for (const line of lines) {
    ensureSpace(ctx, LINE_HEIGHT);
    ctx.doc.text(line, MARGIN_X, ctx.y);
    ctx.y += LINE_HEIGHT;
  }
};

const transcriptFileName = (title: string) => {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();

  return `transcricao-${slug || 'pregacao'}.pdf`;
};

const drawFooters = (doc: JsPDF) => {
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Transcrição da pregação', MARGIN_X, PAGE_HEIGHT - 10);
    doc.text(`${page} de ${total}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 10, { align: 'right' });
  }
};

export const downloadWeeklyQuizTranscriptPdf = async (input: {
  title: string;
  sermonDate: string;
  transcript: string;
}) => {
  const title = input.title.trim() || 'Pregação';
  const transcript = input.transcript.trim();

  if (!transcript) {
    throw new Error('Esta pregação não tem transcrição arquivada.');
  }

  if (typeof document === 'undefined') {
    throw new Error('O PDF da transcrição é baixado no navegador.');
  }

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const ctx: PdfContext = { doc, y: MARGIN_TOP };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  writeLines(ctx, doc.splitTextToSize(title, CONTENT_WIDTH) as string[], 14, 'bold', NAVY);
  ctx.y += 1;

  if (input.sermonDate.trim()) {
    writeLines(ctx, [`Publicada em ${input.sermonDate.trim()}`], 10, 'normal', MUTED);
  }

  ctx.y += 3;
  const paragraphs = transcript.split(/\n{2,}/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);

  for (const paragraph of paragraphs) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(paragraph, CONTENT_WIDTH) as string[];
    writeLines(ctx, lines, 11, 'normal', INK);
    ctx.y += 2.2;
  }

  drawFooters(doc);

  const filename = transcriptFileName(title);
  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
