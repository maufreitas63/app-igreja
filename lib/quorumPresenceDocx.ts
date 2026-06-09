import { formatShortName } from '@/lib/formatShortName';
import {
  formatEventDateDocumentLabel,
  formatEventTimeRangeLabel,
  formatQuorumCheckinTime,
} from '@/lib/quorumCheckinTime';
import {
  QUORUM_PRESENCE_DOCUMENT_TITLE,
  QUORUM_PRESENCE_INTRO_TEXT,
} from '@/lib/quorumPresenceDocument';
import type { QuorumRegistryRow } from '@/lib/quorumRegistry';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export type QuorumPresenceDocxInput = {
  eventName: string;
  eventDate: string | null;
  eventLocal: string | null;
  rows: QuorumRegistryRow[];
};

const paragraph = (text: string, options?: { bold?: boolean; italics?: boolean }) =>
  new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italics,
      }),
    ],
  });

const labelLine = (label: string, value: string) =>
  new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });

const tableCell = (text: string, bold = false) =>
  new TableCell({
    children: [paragraph(text, { bold })],
  });

const buildAttendanceTable = (rows: QuorumRegistryRow[]) => {
  const header = new TableRow({
    children: [
      tableCell('#', true),
      tableCell('Nome', true),
      tableCell('Hora do check-in', true),
    ],
  });

  if (!rows.length) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        header,
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              children: [
                paragraph('Nenhum check-in registrado para este evento até o momento.', {
                  italics: true,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  const dataRows = rows.map((row, index) =>
    new TableRow({
      children: [
        tableCell(String(index + 1)),
        tableCell(formatShortName(row.participant_name)),
        tableCell(formatQuorumCheckinTime(row)),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
  });
};

export const buildQuorumPresenceDocx = (input: QuorumPresenceDocxInput) => {
  const eventName = input.eventName.trim() || 'Evento';
  const local = input.eventLocal?.trim() || '[Local do evento]';

  return new Document({
    sections: [
      {
        children: [
          paragraph(QUORUM_PRESENCE_DOCUMENT_TITLE, { bold: true }),
          paragraph(eventName, { bold: true }),
          labelLine('Data', formatEventDateDocumentLabel(input.eventDate)),
          labelLine('Horário', formatEventTimeRangeLabel(input.eventDate)),
          labelLine('Local', local),
          paragraph(''),
          paragraph(QUORUM_PRESENCE_INTRO_TEXT, { italics: true }),
          paragraph(''),
          buildAttendanceTable(input.rows),
        ],
      },
    ],
  });
};

export const buildQuorumPresenceDocxBase64 = async (input: QuorumPresenceDocxInput) => {
  const document = buildQuorumPresenceDocx(input);
  return Packer.toBase64String(document);
};

const sanitizeFileSlug = (value: string) => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return slug.slice(0, 48) || 'evento';
};

export const buildQuorumPresenceDocxFileName = (eventName: string) => {
  const stamp = new Date().toISOString().slice(0, 10);
  return `lista-presenca-${sanitizeFileSlug(eventName)}-${stamp}.docx`;
};
