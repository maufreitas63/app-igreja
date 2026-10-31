/**
 * Seleciona, por capítulo, os versículos com mais referências cruzadas
 * e grava o texto bilíngue em public.bible_verses.
 *
 * Inglês: King James Version (domínio público).
 * Português: Tradução Brasileira (domínio público).
 * NVI e NIV não são ingeridas.
 *
 * Referências cruzadas: OpenBible.info, licença CC BY.
 * https://www.openbible.info/labs/cross-references/
 *
 * Uso: npm run seed:ranked-verses
 */
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, 'scripts', '.cache', 'bible-seed');

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const TB_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_tb.json';
const CROSS_REF_URL = 'https://a.openbible.info/data/cross-references.zip';

const SHORT_BOOKS = new Set([31, 57, 63, 64, 65]);
const DEFAULT_RATIO = 0.55;
const SHORT_RATIO = 0.65;
const CHUNK_SIZE = 500;

const OSIS_TO_ORDER: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5, Josh: 6, Judg: 7, Ruth: 8,
  '1Sam': 9, '2Sam': 10, '1Kgs': 11, '2Kgs': 12, '1Chr': 13, '2Chr': 14,
  Ezra: 15, Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20, Eccl: 21, Song: 22,
  Isa: 23, Jer: 24, Lam: 25, Ezek: 26, Dan: 27, Hos: 28, Joel: 29, Amos: 30,
  Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35, Zeph: 36, Hag: 37, Zech: 38, Mal: 39,
  Matt: 40, Mark: 41, Luke: 42, John: 43, Acts: 44, Rom: 45,
  '1Cor': 46, '2Cor': 47, Gal: 48, Eph: 49, Phil: 50, Col: 51,
  '1Thess': 52, '2Thess': 53, '1Tim': 54, '2Tim': 55, Titus: 56, Phlm: 57,
  Heb: 58, Jas: 59, '1Pet': 60, '2Pet': 61, '1John': 62, '2John': 63, '3John': 64,
  Jude: 65, Rev: 66,
  Psa: 19, Cant: 22, Sos: 22, Phm: 57, Php: 50,
  '1Sa': 9, '2Sa': 10, '1Ki': 11, '2Ki': 12, '1Ch': 13, '2Ch': 14,
  '1Jn': 62, '2Jn': 63, '3Jn': 64,
};

type BibleBookJson = { chapters: string[][] };
type BookRow = { id: number; order_index: number; name_pt: string; name_en: string };
type VerseData = {
  book_id: number;
  book_order: number;
  chapter: number;
  verse: number;
  verse_reference: string;
  text_pt: string;
  text_en: string;
  translation_pt: string;
  translation_en: string;
  cross_references_count: number;
  is_key_verse: boolean;
};
type ExerciseRow = {
  id: number;
  exercise_type: string;
  bible_passage_ref: string | null;
  payload: Record<string, unknown> | null;
};

function loadEnvLocal(): void {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

async function cachedBuffer(url: string, fileName: string): Promise<Buffer> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, fileName);
  if (existsSync(file)) {
    return readFileSync(file);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(file, buffer);
  return buffer;
}

async function loadBible(url: string, fileName: string): Promise<BibleBookJson[]> {
  const raw = (await cachedBuffer(url, fileName)).toString('utf8');
  const books = JSON.parse(raw) as BibleBookJson[];
  if (!Array.isArray(books) || books.length < 66) {
    throw new Error(`${fileName} não tem os 66 livros.`);
  }
  return books;
}

async function loadCrossReferenceCounts(): Promise<Map<string, number>> {
  const zipPath = join(cacheDir, 'cross-references.zip');
  await cachedBuffer(CROSS_REF_URL, 'cross-references.zip');
  await execFileAsync('tar', ['-xf', zipPath, '-C', cacheDir]);
  const textPath = join(cacheDir, 'cross_references.txt');
  if (!existsSync(textPath)) {
    throw new Error('O zip de referências cruzadas não trouxe cross_references.txt.');
  }
  const counts = new Map<string, number>();
  const unknown = new Map<string, number>();
  for (const line of readFileSync(textPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('From')) {
      continue;
    }
    const [fromRef, , votesRaw] = line.split('\t');
    const votes = Number(votesRaw);
    if (Number.isFinite(votes) && votes <= 0) {
      continue;
    }
    const parsed = parseOsisStart(fromRef ?? '');
    if (!parsed) {
      continue;
    }
    if (parsed.order == null) {
      unknown.set(parsed.book, (unknown.get(parsed.book) ?? 0) + 1);
      continue;
    }
    const key = verseKey(parsed.order, parsed.chapter, parsed.verse);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (unknown.size > 0) {
    const sample = [...unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.warn('Siglas de livro ignoradas nas referências cruzadas:', sample);
  }
  return counts;
}

function parseOsisStart(ref: string): { book: string; order: number | null; chapter: number; verse: number } | null {
  const start = ref.split('-')[0]?.trim() ?? '';
  const match = start.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  const book = match[1];
  return {
    book,
    order: OSIS_TO_ORDER[book] ?? null,
    chapter: Number(match[2]),
    verse: Number(match[3]),
  };
}

function verseKey(order: number, chapter: number, verse: number): string {
  return `${order}:${chapter}:${verse}`;
}

function cutoffCount(total: number, ratio: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(total, Math.ceil(total * ratio));
}

function rankChapter(verses: VerseData[], ratio: number): VerseData[] {
  const ranked = [...verses].sort((a, b) =>
    b.cross_references_count - a.cross_references_count || a.verse - b.verse
  );
  return ranked.slice(0, cutoffCount(ranked.length, ratio));
}

function buildVerses(
  books: BookRow[],
  english: BibleBookJson[],
  portuguese: BibleBookJson[],
  counts: Map<string, number>
): VerseData[] {
  const selected: VerseData[] = [];
  for (const book of books) {
    const index = book.order_index - 1;
    const enBook = english[index];
    const ptBook = portuguese[index];
    if (!enBook || !ptBook) {
      throw new Error(`Livro ${book.order_index} sem texto bilíngue.`);
    }
    const chapterCount = Math.min(enBook.chapters.length, ptBook.chapters.length);
    const ratio = SHORT_BOOKS.has(book.order_index) ? SHORT_RATIO : DEFAULT_RATIO;
    for (let chapterIndex = 0; chapterIndex < chapterCount; chapterIndex += 1) {
      const enChapter = enBook.chapters[chapterIndex] ?? [];
      const ptChapter = ptBook.chapters[chapterIndex] ?? [];
      const verseCount = Math.min(enChapter.length, ptChapter.length);
      const chapterVerses: VerseData[] = [];
      for (let verseIndex = 0; verseIndex < verseCount; verseIndex += 1) {
        const textEn = enChapter[verseIndex]?.trim();
        const textPt = ptChapter[verseIndex]?.trim();
        if (!textEn || !textPt) {
          continue;
        }
        const verse = verseIndex + 1;
        const chapter = chapterIndex + 1;
        chapterVerses.push({
          book_id: book.id,
          book_order: book.order_index,
          chapter,
          verse,
          verse_reference: `${book.name_en} ${chapter}:${verse}`,
          text_pt: textPt,
          text_en: textEn,
          translation_pt: 'TB1917',
          translation_en: 'KJV',
          cross_references_count: counts.get(verseKey(book.order_index, chapter, verse)) ?? 0,
          is_key_verse: true,
        });
      }
      selected.push(...rankChapter(chapterVerses, ratio));
    }
  }
  selected.sort((a, b) => a.book_order - b.book_order || a.chapter - b.chapter || a.verse - b.verse);
  return selected;
}

async function insertChunks(supabase: SupabaseClient, rows: VerseData[]): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { error } = await supabase
      .from('bible_verses')
      .upsert(chunk, { onConflict: 'book_id,chapter,verse' });
    if (error) {
      throw new Error(`Erro ao inserir lote ${index / CHUNK_SIZE}: ${error.message}`);
    }
    console.log(`Lote ${index / CHUNK_SIZE + 1} gravado (${chunk.length} versículos).`);
  }
}

function tokens(text: string): string[] {
  return text.match(/[A-Za-z0-9']+/g) ?? [];
}

function sameWord(token: string, lemma: string): boolean {
  const left = token.toLowerCase();
  const right = lemma.trim().toLowerCase();
  if (!right) {
    return false;
  }
  return left === right || left + 's' === right || right + 's' === left;
}

function windowAround(words: string[], lemma: string): string[] | null {
  const index = words.findIndex((word) => sameWord(word, lemma));
  if (index < 0) {
    return null;
  }
  const size = 12;
  if (words.length <= size) {
    return words;
  }
  const start = Math.max(0, Math.min(index - 3, words.length - size));
  return words.slice(start, start + size);
}

function seededShuffle(words: string[], seed: string): string[] {
  const next = [...words];
  let state = createHash('sha256').update(seed).digest().readUInt32BE(0);
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    const item = next[index];
    next[index] = next[swap];
    next[swap] = item;
  }
  if (next.length > 1 && next.join('\u0000') === words.join('\u0000')) {
    const first = next[0];
    next[0] = next[1];
    next[1] = first;
  }
  return next;
}

function payloadFromVerse(
  exercise: ExerciseRow,
  verse: VerseData
): Record<string, unknown> | null {
  const payload = exercise.payload;
  if (!payload) {
    return null;
  }
  const lemma = typeof payload.lemma === 'string'
    ? payload.lemma
    : typeof payload.answer === 'string'
      ? payload.answer
      : '';
  const words = windowAround(tokens(verse.text_en), lemma);
  if (!words || !lemma) {
    return null;
  }
  if (exercise.exercise_type === 'FILL_BLANK') {
    const answer = typeof payload.answer === 'string' ? payload.answer : lemma;
    const options = Array.isArray(payload.options) ? payload.options.map(String) : [answer];
    return {
      ...payload,
      sentence: words.map((word) => sameWord(word, lemma) ? '_____' : word).join(' '),
      answer,
      options,
      lemma,
    };
  }
  if (exercise.exercise_type === 'ORDER_WORDS') {
    return {
      ...payload,
      answer: words,
      shuffled: seededShuffle(words, `${verse.verse_reference}:${lemma}`),
      lemma,
    };
  }
  return null;
}

async function syncExercises(supabase: SupabaseClient, verses: VerseData[]): Promise<number> {
  const byReference = new Map(verses.map((verse) => [verse.verse_reference, verse]));
  let updated = 0;
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('verbum_exercises')
      .select('id, exercise_type, bible_passage_ref, payload')
      .in('exercise_type', ['FILL_BLANK', 'ORDER_WORDS'])
      .range(from, from + page - 1);
    if (error) {
      throw new Error(`Falha ao ler exercícios: ${error.message}`);
    }
    const rows = (data ?? []) as ExerciseRow[];
    for (const row of rows) {
      const verse = row.bible_passage_ref ? byReference.get(row.bible_passage_ref) : undefined;
      if (!verse) {
        continue;
      }
      const payload = payloadFromVerse(row, verse);
      const patch: Record<string, unknown> = {
        verse_target_en: verse.text_en,
        verse_target_pt: verse.text_pt,
      };
      if (payload) {
        patch.payload = payload;
      }
      const { error: updateError } = await supabase
        .from('verbum_exercises')
        .update(patch)
        .eq('id', row.id);
      if (updateError) {
        throw new Error(`Falha ao atualizar exercício ${row.id}: ${updateError.message}`);
      }
      updated += 1;
    }
    if (rows.length < page) {
      break;
    }
    from += page;
  }
  return updated;
}

export async function seedRankedVerses(): Promise<void> {
  loadEnvLocal();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Defina EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.');
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log('Iniciando processamento dos versículos ranqueados (55% por capítulo, 65% nos livros curtos)...');

  const { data: books, error: booksError } = await supabase
    .from('verbum_bible_books')
    .select('id, order_index, name_pt, name_en')
    .order('order_index', { ascending: true });
  if (booksError || !books?.length) {
    throw new Error(`Falha ao carregar livros: ${booksError?.message ?? 'lista vazia'}`);
  }

  const [english, portuguese, counts] = await Promise.all([
    loadBible(KJV_URL, 'en_kjv.json'),
    loadBible(TB_URL, 'pt_tb.json'),
    loadCrossReferenceCounts(),
  ]);
  const rows = buildVerses(books as BookRow[], english, portuguese, counts);
  console.log(`${rows.length} versículos selecionados em ordem canônica.`);
  await insertChunks(supabase, rows);
  const exercises = await syncExercises(supabase, rows);
  console.log(`${exercises} exercícios de completar e ordenar passaram a usar o versículo gravado.`);
  console.log('Seed de versículos concluído.');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed-ranked-verses.ts');
if (isDirectRun) {
  seedRankedVerses().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
