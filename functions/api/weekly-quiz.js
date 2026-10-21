const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id, x-ghost-profile-id, x-tenant-id',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];
const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });

const isUsableSupabaseUrl = (base) => {
  try {
    const parsed = new URL(base);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const isUsableSupabaseKey = (value) => {
  const key = String(value || '').trim();
  return key.startsWith('eyJ') && key.length > 80;
};

const getSupabaseUrl = (env) => {
  const candidates = [env?.SUPABASE_URL, env?.EXPO_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL];

  for (const raw of candidates) {
    const base = String(raw || '').trim().replace(/\/$/, '');
    if (isUsableSupabaseUrl(base)) {
      return base;
    }
  }

  return DEFAULT_SUPABASE_URL;
};

const getSupabaseKey = (env) => {
  const candidates = [
    env?.SUPABASE_SERVICE_ROLE_KEY,
    env?.SUPABASE_ANON_KEY,
    env?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    DEFAULT_SUPABASE_ANON_KEY,
  ];

  for (const raw of candidates) {
    if (isUsableSupabaseKey(raw)) {
      return String(raw).trim();
    }
  }

  return DEFAULT_SUPABASE_ANON_KEY;
};

const copyIdentityHeaders = (request) => {
  const headers = {};
  const pairs = [
    ['x-session-token', 'x-session-token'],
    ['x-profile-id', 'x-profile-id'],
    ['x-ghost-profile-id', 'x-ghost-profile-id'],
    ['x-tenant-id', 'x-tenant-id'],
  ];

  for (const [lower, canonical] of pairs) {
    const value = request.headers.get(lower)?.trim() || request.headers.get(canonical)?.trim();
    if (value) {
      headers[canonical] = value;
    }
  }

  return headers;
};

const supabaseRpc = async (env, functionName, payload, request) => {
  const supabaseUrl = getSupabaseUrl(env);
  const supabaseKey = getSupabaseKey(env);

  if (!supabaseKey) {
    throw new Error('missing_env:supabase');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      ...copyIdentityHeaders(request),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!response.ok) {
    const message = body?.message || body?.error || text || 'Falha ao consultar o banco.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
};

const resolveActorProfileId = async (env, request) => {
  const sessionToken = request.headers.get('x-session-token')?.trim() || '';
  const realProfileId = await supabaseRpc(
    env,
    'resolve_profile_session_token',
    { p_token: sessionToken },
    request
  );

  if (!realProfileId || typeof realProfileId !== 'string') {
    return null;
  }

  const ghostProfileId = request.headers.get('x-ghost-profile-id')?.trim() || '';

  if (ghostProfileId && ghostProfileId !== realProfileId) {
    const canGhost = await supabaseRpc(
      env,
      'can_operate_ghost_mode',
      { p_profile_id: realProfileId },
      request
    );

    if (canGhost === true) {
      return ghostProfileId;
    }
  }

  return realProfileId;
};

const resolveGeminiApiKey = async (env, request) => {
  const supabaseUrl = getSupabaseUrl(env);
  const supabaseKey = getSupabaseKey(env);

  if (supabaseKey) {
    try {
      const configResponse = await fetch(
        `${supabaseUrl}/rest/v1/ai_server_config?config_key=eq.gemini_api_key&select=config_value`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
          },
        }
      );

      if (configResponse.ok) {
        const rows = await configResponse.json();
        const fromTable = Array.isArray(rows) ? String(rows[0]?.config_value ?? '').trim() : '';
        if (fromTable.startsWith('AIza')) {
          return fromTable;
        }
      }
    } catch (error) {
      console.error('weekly-quiz.ai_server_config', error);
    }
  }

  try {
    const actorProfileId = await resolveActorProfileId(env, request);

    if (actorProfileId) {
      const fromDatabase = await supabaseRpc(
        env,
        'obter_chave_gemini_ia_lideranca',
        { p_actor_profile_id: actorProfileId },
        request
      );
      const key = typeof fromDatabase === 'string' ? fromDatabase.trim() : '';

      if (key.startsWith('AIza')) {
        return key;
      }
    }
  } catch (error) {
    console.error('weekly-quiz.obter_chave_gemini', error);
  }

  const fromEnv = env?.GEMINI_API_KEY?.trim();
  return fromEnv && fromEnv.startsWith('AIza') ? fromEnv : null;
};

const decodeXml = (value) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar o YouTube (${response.status}).`);
  }

  return response.text();
};

const extractChannelId = (page) => {
  const match = String(page || '').match(/"(?:channelId|externalId|browseId)":"(UC[\w-]{22})"/);
  return match?.[1] ?? null;
};

const resolveChannelId = async (youtubeUrl) => {
  let parsed;

  try {
    parsed = new URL(youtubeUrl);
  } catch {
    throw new Error('A URL do YouTube desta igreja é inválida.');
  }

  const direct = parsed.pathname.match(/\/channel\/(UC[\w-]{22})/);
  if (direct) {
    return direct[1];
  }

  if (parsed.searchParams.get('v') || parsed.hostname === 'youtu.be') {
    throw new Error('Cadastre a URL do canal do YouTube, não a de um vídeo, em Instâncias.');
  }

  const page = await fetchText(parsed.toString());
  const channelId = extractChannelId(page);

  if (!channelId) {
    throw new Error('Não foi possível identificar o canal a partir da URL cadastrada.');
  }

  return channelId;
};

const listChannelVideos = async (channelId) => {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  const entries = xml.split('<entry>').slice(1);
  const videos = [];

  for (const entry of entries) {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]?.trim();
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');

    if (videoId && published && title) {
      videos.push({ videoId, published, title });
    }
  }

  return videos;
};

const transcriptFromJson = (payload) => {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const parts = [];

  for (const event of events) {
    const segs = Array.isArray(event?.segs) ? event.segs : [];
    for (const seg of segs) {
      const text = String(seg?.utf8 ?? '').trim();
      if (text && text !== '\n') {
        parts.push(text);
      }
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const transcriptFromXml = (xml) => {
  const parts = [];
  const pattern = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  let match = pattern.exec(xml);

  while (match) {
    const text = decodeXml(match[1]);
    if (text) {
      parts.push(text);
    }
    match = pattern.exec(xml);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const fetchCaptionUrl = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });

  if (!response.ok) {
    return '';
  }

  const raw = await response.text();
  const trimmed = raw.trim();

  if (trimmed.startsWith('{')) {
    try {
      return transcriptFromJson(JSON.parse(trimmed));
    } catch {
      return '';
    }
  }

  return transcriptFromXml(raw);
};

const captionTracksFromPlayer = (payload) => {
  const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) ? tracks : [];
};

const pickCaptionTrack = (tracks) => {
  const ranked = [...tracks].sort((left, right) => {
    const score = (track) => {
      const code = String(track?.languageCode ?? '').toLowerCase();
      if (code === 'pt-br' || code === 'pt') {
        return 0;
      }
      if (code.startsWith('pt')) {
        return 1;
      }
      return 2;
    };

    return score(left) - score(right);
  });

  return ranked[0] ?? null;
};

const fetchInnertubeCaptions = async (videoId, clientName, clientVersion) => {
  const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      context: { client: { clientName, clientVersion, hl: 'pt', gl: 'BR' } },
      videoId,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return captionTracksFromPlayer(payload);
};

const fetchCaptionTranscript = async (videoId) => {
  const trackSets = await Promise.all([
    fetchInnertubeCaptions(videoId, 'ANDROID', '19.17.34'),
    fetchInnertubeCaptions(videoId, 'WEB', '2.20240101.00.00'),
  ]);
  const track = pickCaptionTrack(trackSets.flat());

  if (track?.baseUrl) {
    const fromTrack = await fetchCaptionUrl(`${track.baseUrl}&fmt=json3`);
    if (fromTrack.length >= 400) {
      return fromTrack;
    }
  }

  const timed = await fetchCaptionUrl(
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=pt&fmt=json3`
  );

  return timed.length >= 400 ? timed : '';
};

const geminiResponseText = (payload) =>
  payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n') ?? '';

const cleanupTranscript = (value) =>
  String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const transcriptForQuiz = (transcript) => {
  const text = cleanupTranscript(transcript);

  if (text.length <= 100000) {
    return text;
  }

  const head = text.slice(0, 40000);
  const tail = text.slice(-40000);
  const middleStart = Math.max(0, Math.floor(text.length / 2) - 10000);
  const middle = text.slice(middleStart, middleStart + 20000);

  return `${head}\n\n[...]\n\n${middle}\n\n[...]\n\n${tail}`;
};

const TRANSCRIPT_WINDOW_SECONDS = 90;

const clockLabel = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
};

const fetchVideoDurationSeconds = async (videoId) => {
  const clients = [
    { clientName: 'ANDROID', clientVersion: '19.17.34' },
    { clientName: 'WEB', clientVersion: '2.20240101.00.00' },
  ];

  for (const client of clients) {
    try {
      const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          context: { client: { ...client, hl: 'pt', gl: 'BR' } },
          videoId,
        }),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const seconds = Number(payload?.videoDetails?.lengthSeconds);

      if (Number.isFinite(seconds) && seconds > 30) {
        return Math.floor(seconds);
      }
    } catch {
      continue;
    }
  }

  return 0;
};

const celebrationDateLabel = (publishedAt) => {
  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdays[pick('weekday')] ?? 0;
  const cursor = new Date(Date.UTC(Number(pick('year')), Number(pick('month')) - 1, Number(pick('day'))));
  cursor.setUTCDate(cursor.getUTCDate() - weekday);
  const day = String(cursor.getUTCDate()).padStart(2, '0');
  const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${cursor.getUTCFullYear()}`;
};

const sermonIdentity = (title, publishedAt) => {
  const parts = String(title || '')
    .split(/\s*\/\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  let theme = parts[0] || String(title || '').trim() || 'Pregação';
  let preacher = 'Não identificado no título';

  if (parts.length >= 3) {
    theme = parts.slice(1, -1).join(' // ');
    preacher = parts[parts.length - 1];
  } else if (parts.length === 2) {
    const opening = parts[0].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (opening.includes('celebr')) {
      theme = parts[1];
    } else {
      theme = parts[0];
      preacher = parts[1];
    }
  }

  return {
    theme,
    preacher,
    celebrationDate: celebrationDateLabel(publishedAt),
  };
};

const transcribeNextPart = async (apiKey, videoId, title, startSeconds, endSeconds) => {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const instruction = [
    `Transcreva somente o intervalo de ${clockLabel(startSeconds)} até ${clockLabel(endSeconds)}.`,
    'O vídeo já está recortado nesse intervalo. Não volte ao início e não antecipe o que vem depois.',
    'Escreva em português do Brasil, na ordem falada, sem resumir e sem inventar falas, histórias ou versículos.',
    'Quando a pregação citar a Bíblia, registre livro, capítulo e versículo como foram ditos.',
    'Pode omitir louvor, oração da liturgia, saudação, avisos e testemunhos de outras pessoas.',
    'Se neste intervalo não houver pregação, responda apenas [[CONTINUA]].',
    'Se a pregação terminar dentro deste intervalo, transcreva até o fim dela e termine com [[FIM]].',
    'Se a pregação continuar depois deste intervalo, pare numa frase completa e termine com [[CONTINUA]].',
    `Título: ${title}`,
  ].join('\n');
  let lastError = 'Não foi possível transcrever o áudio desta pregação.';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  file_data: { file_uri: watchUrl },
                  video_metadata: {
                    start_offset: `${Math.max(0, Math.floor(startSeconds))}.0s`,
                    end_offset: `${Math.max(1, Math.floor(endSeconds))}.0s`,
                  },
                },
                { text: instruction },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        lastError = payload?.error?.message || `Gemini recusou a transcrição (${response.status}).`;
        if (youtubeReadDenied({ message: lastError })) {
          throw new Error(lastError);
        }
        continue;
      }

      const raw = geminiResponseText(payload).trim();
      const finished = raw.includes('[[FIM]]');
      const text = cleanupTranscript(raw.replace(/\[\[CONTINUA\]\]|\[\[FIM\]\]/g, ''));

      if (!finished && !raw.includes('[[CONTINUA]]') && text.length < 40) {
        lastError = 'A transcrição deste trecho ficou vazia.';
        continue;
      }

      return {
        text: text.length >= 40 ? text : '',
        finished,
      };
    } catch (error) {
      lastError = error?.message || lastError;
    }
  }

  if (lastError === 'A transcrição deste trecho ficou vazia.') {
    return { text: '', finished: false };
  }

  throw new Error(lastError);
};

const extractJson = (text) => {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');

  if (start < 0 || end <= start) {
    throw new Error('A geração não devolveu as 15 perguntas.');
  }

  return JSON.parse(source.slice(start, end + 1));
};

const normalizeQuestions = (payload) => {
  const rows = Array.isArray(payload?.questions) ? payload.questions : [];

  if (rows.length !== 15) {
    throw new Error('A geração não devolveu exatamente 15 perguntas.');
  }

  return rows.map((row) => {
    const options = Array.isArray(row?.options) ? row.options.map((item) => String(item ?? '').trim()) : [];
    const correctIndex = Number(row?.correctIndex);
    const bibleChapter = Number(row?.bibleChapter);
    const bibleVerse = Number(row?.bibleVerse);
    const prompt = String(row?.prompt ?? '').trim();
    const bibleBook = String(row?.bibleBook ?? '').trim();
    const bibleReference = String(row?.bibleReference ?? '').trim();

    if (
      options.length !== 4
      || options.some((option) => !option)
      || !Number.isInteger(correctIndex)
      || correctIndex < 0
      || correctIndex > 3
      || !prompt
      || !bibleBook
      || !Number.isInteger(bibleChapter)
      || bibleChapter <= 0
      || !Number.isInteger(bibleVerse)
      || bibleVerse <= 0
      || !bibleReference
    ) {
      throw new Error('Cada pergunta precisa de 4 alternativas e uma referência bíblica da pregação.');
    }

    return {
      prompt,
      options,
      correctIndex,
      bibleBook,
      bibleChapter,
      bibleVerse,
      bibleReference,
    };
  });
};

const generateQuestions = async (apiKey, transcript, title) => {
  const system = [
    'Você cria um quiz de múltipla escolha só com o conteúdo específico da pregação.',
    'Use a exposição bíblica, o texto explicado e a mensagem pregada.',
    'Deixe de fora orações, saudações, avisos, testemunhos e comentários de cunho pessoal.',
    'Não pergunte o que foi orado, a vida particular de quem pregou, nem opinião pessoal fora do texto.',
    'Devolva JSON puro, sem markdown, neste formato:',
    '{"questions":[{"prompt":"","options":["","","",""],"correctIndex":0,"bibleBook":"","bibleChapter":1,"bibleVerse":1,"bibleReference":""}]}',
    'Regras: exatamente 15 perguntas; 4 alternativas; uma correta; correctIndex de 0 a 3.',
    'As perguntas devem percorrer a pregação do início, do meio e da conclusão, não só a abertura.',
    'A referência bíblica precisa ser um texto citado na exposição da pregação, com livro, capítulo e versículo.',
    'Não invente versículo, história ou aplicação que não estejam na mensagem pregada.',
    'As alternativas erradas devem ser plausíveis, mas não podem contradizer a citação usada.',
  ].join('\n');

  const userText = `Título: ${title}\n\nTranscrição completa:\n${transcriptForQuiz(transcript)}`;
  let lastError = 'Não foi possível gerar as perguntas.';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 12000,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        lastError = payload?.error?.message || `Gemini recusou a geração (${response.status}).`;
        continue;
      }

      return normalizeQuestions(extractJson(geminiResponseText(payload)));
    } catch (error) {
      lastError = error?.message || lastError;
    }
  }

  throw new Error(lastError);
};

const generateSermonSummary = async (apiKey, transcript, title) => {
  const system = [
    'Escreva um resumo contextual em português do Brasil da pregação.',
    'Use só a exposição bíblica, o texto explicado e a mensagem pregada.',
    'Deixe de fora orações, saudações, avisos, testemunhos e comentários de cunho pessoal.',
    'Diga o texto bíblico central, a tese da mensagem e os pontos que a pregação desenvolveu do início ao fim.',
    'Não invente versículos nem aplicações que não estejam na transcrição.',
    'Devolva só o resumo, em 3 a 6 parágrafos curtos.',
  ].join('\n');
  const userText = `Título: ${title}\n\nTranscrição completa:\n${transcriptForQuiz(transcript)}`;
  let lastError = 'Não foi possível resumir a pregação.';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        lastError = payload?.error?.message || `Gemini recusou o resumo (${response.status}).`;
        continue;
      }

      const summary = geminiResponseText(payload).replace(/\s+\n/g, '\n').trim();

      if (summary.length >= 80) {
        return summary;
      }

      lastError = 'O resumo contextual da pregação ficou curto demais.';
    } catch (error) {
      lastError = error?.message || lastError;
    }
  }

  throw new Error(lastError);
};

const readJsonBody = async (request) => {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
};

const storeQuizDraft = async (env, request, sermon, transcript, summary, questions) =>
  supabaseRpc(
    env,
    'weekly_quiz_store_draft',
    {
      p_video_id: sermon.videoId,
      p_title: sermon.title,
      p_sermon_published_at: sermon.publishedAt,
      p_transcript: transcript,
      p_context_summary: summary,
      p_questions: questions,
    },
    request
  );

const saveTranscript = (env, request, sermon, transcript, complete, offsetSeconds) =>
  supabaseRpc(
    env,
    'weekly_quiz_save_transcript',
    {
      p_video_id: sermon.videoId,
      p_title: sermon.title,
      p_sermon_published_at: sermon.publishedAt,
      p_transcript: transcript,
      p_complete: complete,
      p_offset_seconds: Math.max(0, Math.floor(Number(offsetSeconds) || 0)),
    },
    request
  );

const youtubeReadDenied = (error) =>
  /does not have permission|permission denied/i.test(String(error?.message || ''));

const youtubeReadDeniedMessage =
  'O YouTube não liberou esta pregação para transcrição. O vídeo está público, mas a leitura automática dele foi recusada.';

const readSermonArchive = async (env, request, videoId) => {
  try {
    return await supabaseRpc(env, 'weekly_quiz_sermon_archive', { p_video_id: videoId }, request);
  } catch (error) {
    const wrapped = new Error(error?.message || 'Não foi possível ler a pregação arquivada.');
    wrapped.status = Number(error?.status) || 400;
    throw wrapped;
  }
};

const handlePost = async (request, env) => {
  const sessionToken = request.headers.get('x-session-token')?.trim() || '';

  if (!sessionToken) {
    return jsonResponse({ error: 'Sessão inválida. Saia e entre novamente no aplicativo.' }, 401);
  }

  const body = await readJsonBody(request);
  const action = String(body?.action ?? '').trim();
  const requestedVideoId = String(body?.videoId ?? '').trim();

  if (action === 'generate') {
    return jsonResponse({ error: 'Atualize a página e busque a pregação de novo.' }, 409);
  }

  if (action === 'recompose') {
    if (!requestedVideoId) {
      return jsonResponse({ error: 'Informe a pregação para refazer as perguntas.' }, 400);
    }

    const geminiApiKey = await resolveGeminiApiKey(env, request);

    if (!geminiApiKey) {
      return jsonResponse(
        { error: 'Chave Gemini não configurada. Cadastre em Engrenagem → Chave Gemini.' },
        503
      );
    }

    let archive;

    try {
      archive = await readSermonArchive(env, request, requestedVideoId);
    } catch (error) {
      return jsonResponse({ error: error.message }, Number(error.status) || 400);
    }

    const transcript = String(archive?.transcript ?? '').trim();

    if (transcript.length < 400) {
      return jsonResponse(
        { error: 'Não há transcrição gravada desta pregação para refazer as perguntas.' },
        409
      );
    }

    try {
      const questions = await generateQuestions(
        geminiApiKey,
        transcript,
        String(archive?.title ?? '').trim() || 'Pregação'
      );
      const snapshot = await supabaseRpc(
        env,
        'weekly_quiz_refresh_questions',
        {
          p_video_id: requestedVideoId,
          p_questions: questions,
        },
        request
      );
      return jsonResponse({ snapshot });
    } catch (error) {
      const message = error?.message || 'Não foi possível refazer as perguntas.';
      const status = Number(error?.status) >= 400 ? Number(error.status) : 422;
      return jsonResponse({ error: message }, status);
    }
  }

  let prepared;

  try {
    prepared = await supabaseRpc(env, 'weekly_quiz_prepare_generation', {}, request);
  } catch (error) {
    const status = Number(error?.status) >= 400 ? Number(error.status) : 400;
    return jsonResponse({ error: error?.message || 'Não foi possível preparar o quiz.' }, status);
  }

  const used = new Set(
    (Array.isArray(prepared?.usedVideoIds) ? prepared.usedVideoIds : []).map((id) => String(id))
  );

  if (requestedVideoId && used.has(requestedVideoId)) {
    return jsonResponse(
      { error: 'Esta pregação já tem quiz. Exclua o quiz desta data antes de refazer as perguntas.' },
      409
    );
  }

  if (action === 'preview') {
    const youtubeUrl = String(prepared?.youtubeUrl ?? '').trim();
    let videos;

    try {
      const channelId = await resolveChannelId(youtubeUrl);
      videos = await listChannelVideos(channelId);
    } catch (error) {
      return jsonResponse({ error: error?.message || 'Não foi possível ler o canal do YouTube.' }, 502);
    }

    const video = videos.find((item) => !used.has(item.videoId));

    if (!video) {
      return jsonResponse(
        { error: 'As pregações recentes deste canal já viraram quiz. Busque de novo quando sair um vídeo novo.' },
        409
      );
    }

    const identity = sermonIdentity(video.title, video.published);
    const durationSeconds = await fetchVideoDurationSeconds(video.videoId);

    if (durationSeconds <= 0) {
      return jsonResponse(
        { error: 'Não foi possível ler a duração deste vídeo. Tente de novo antes de transcrever.' },
        502
      );
    }

    let coveredSeconds = 0;

    try {
      const archive = await readSermonArchive(env, request, video.videoId);
      coveredSeconds = Math.min(durationSeconds, Math.max(0, Number(archive?.offsetSeconds) || 0));
    } catch {
      coveredSeconds = 0;
    }

    return jsonResponse({
      videoId: video.videoId,
      title: video.title,
      theme: identity.theme,
      preacher: identity.preacher,
      celebrationDate: identity.celebrationDate,
      durationSeconds,
      coveredSeconds,
    });
  }

  const geminiApiKey = await resolveGeminiApiKey(env, request);

  if (!geminiApiKey) {
    return jsonResponse(
      { error: 'Chave Gemini não configurada. Cadastre em Engrenagem → Chave Gemini.' },
      503
    );
  }

  let queue = [];

  if (requestedVideoId) {
    let archive;

    try {
      archive = await readSermonArchive(env, request, requestedVideoId);
    } catch (error) {
      return jsonResponse({ error: error.message }, Number(error.status) || 400);
    }

    const publishedAt = new Date(archive?.sermonPublishedAt);

    if (archive?.sermonPublishedAt && !Number.isNaN(publishedAt.getTime())) {
      queue = [{
        videoId: requestedVideoId,
        title: String(archive?.title ?? '').trim() || 'Pregação',
        publishedAt: publishedAt.toISOString(),
        transcript: String(archive?.transcript ?? '').trim(),
        transcriptComplete: archive?.transcriptComplete === true,
        offsetSeconds: Number(archive?.offsetSeconds) || 0,
      }];
    } else if (action === 'transcribe') {
      const youtubeUrl = String(prepared?.youtubeUrl ?? '').trim();
      let videos;

      try {
        const channelId = await resolveChannelId(youtubeUrl);
        videos = await listChannelVideos(channelId);
      } catch (error) {
        return jsonResponse({ error: error?.message || 'Não foi possível ler o canal do YouTube.' }, 502);
      }

      const video = videos.find((item) => item.videoId === requestedVideoId);

      if (!video) {
        return jsonResponse({ error: 'Este vídeo não está entre as pregações recentes do canal.' }, 404);
      }

      const videoPublishedAt = new Date(video.published);

      if (Number.isNaN(videoPublishedAt.getTime())) {
        return jsonResponse({ error: 'A data de publicação desta pregação não pôde ser lida.' }, 502);
      }

      queue = [{
        videoId: video.videoId,
        title: video.title,
        publishedAt: videoPublishedAt.toISOString(),
        transcript: '',
        transcriptComplete: false,
        offsetSeconds: 0,
      }];
    } else {
      return jsonResponse(
        { error: 'Esta data não tem pregação arquivada para refazer as perguntas.' },
        404
      );
    }
  } else {
    const youtubeUrl = String(prepared?.youtubeUrl ?? '').trim();
    let videos;

    try {
      const channelId = await resolveChannelId(youtubeUrl);
      videos = await listChannelVideos(channelId);
    } catch (error) {
      return jsonResponse({ error: error?.message || 'Não foi possível ler o canal do YouTube.' }, 502);
    }

    const pending = videos.filter((item) => !used.has(item.videoId)).slice(0, 5);

    if (!pending.length) {
      return jsonResponse(
        { error: 'As pregações recentes deste canal já viraram quiz. Busque de novo quando sair um vídeo novo.' },
        409
      );
    }

    for (const video of pending) {
      const publishedAt = new Date(video.published);

      if (Number.isNaN(publishedAt.getTime())) {
        continue;
      }

      const sermon = {
        videoId: video.videoId,
        title: video.title,
        publishedAt: publishedAt.toISOString(),
        transcript: '',
        transcriptComplete: false,
        offsetSeconds: 0,
      };

      try {
        const archive = await readSermonArchive(env, request, sermon.videoId);
        sermon.transcript = String(archive?.transcript ?? '').trim();
        sermon.transcriptComplete = archive?.transcriptComplete === true;
        sermon.offsetSeconds = Number(archive?.offsetSeconds) || 0;
      } catch {
        sermon.transcript = '';
      }

      queue.push(sermon);
    }

    if (!queue.length) {
      return jsonResponse({ error: 'A data de publicação desta pregação não pôde ser lida.' }, 502);
    }
  }

  const sermon = queue[0];

  if (action === 'compose') {
    if (!sermon.transcriptComplete || sermon.transcript.length < 400) {
      return jsonResponse(
        { error: 'A transcrição da pregação ainda está incompleta. Toque de novo para continuar.' },
        409
      );
    }

    try {
      const summary = await generateSermonSummary(geminiApiKey, sermon.transcript, sermon.title);
      const questions = await generateQuestions(geminiApiKey, sermon.transcript, sermon.title);
      const snapshot = await storeQuizDraft(env, request, sermon, sermon.transcript, summary, questions);
      return jsonResponse({ snapshot });
    } catch (error) {
      const message = error?.message || 'Não foi possível gravar a prévia do quiz.';
      const status = Number(error?.status) >= 400 ? Number(error.status) : 422;
      return jsonResponse({ error: message }, status);
    }
  }

  let deniedCount = 0;

  for (const item of queue) {
    if (item.transcriptComplete && item.transcript.length >= 400) {
      const duration = await fetchVideoDurationSeconds(item.videoId);
      const covered = duration || Number(item.offsetSeconds) || 0;
      return jsonResponse({
        videoId: item.videoId,
        done: true,
        chars: item.transcript.length,
        coveredSeconds: covered,
        durationSeconds: duration || covered,
        coveredUntil: clockLabel(covered),
      });
    }

    const prior = cleanupTranscript(item.transcript);
    const storedOffset = Number(item.offsetSeconds) || 0;
    const startSeconds = storedOffset > 0
      ? storedOffset
      : (prior.length >= 400 ? Math.floor(prior.length / 14) : 0);

    try {
      const duration = await fetchVideoDurationSeconds(item.videoId);

      if (startSeconds === 0) {
        const captions = await fetchCaptionTranscript(item.videoId);
        const captionsCoverVideo = duration > 0 && captions.length >= Math.min(duration * 6, 20000) && captions.length >= 8000;

        if (captions.length >= 20000 || captionsCoverVideo) {
          await saveTranscript(env, request, item, captions, true, duration || startSeconds);
          return jsonResponse({
            videoId: item.videoId,
            done: true,
            chars: captions.length,
            coveredSeconds: duration || startSeconds,
            durationSeconds: duration || startSeconds,
            coveredUntil: clockLabel(duration || startSeconds),
          });
        }
      }

      if (duration > 0 && startSeconds >= duration - 2 && prior.length >= 400) {
        await saveTranscript(env, request, item, prior, true, duration);
        return jsonResponse({
          videoId: item.videoId,
          done: true,
          chars: prior.length,
          coveredSeconds: duration,
          durationSeconds: duration,
          coveredUntil: clockLabel(duration),
        });
      }

      const endSeconds = duration > 0
        ? Math.min(startSeconds + TRANSCRIPT_WINDOW_SECONDS, duration)
        : startSeconds + TRANSCRIPT_WINDOW_SECONDS;
      const part = await transcribeNextPart(geminiApiKey, item.videoId, item.title, startSeconds, endSeconds);
      const addition = cleanupTranscript(part.text);
      const transcript = cleanupTranscript(
        startSeconds > 0 && prior
          ? (addition ? `${prior}\n\n${addition}` : prior)
          : addition
      );
      const reachedVideoEnd = duration > 0 && endSeconds >= duration - 2;
      const sermonEnded = part.finished && transcript.length >= 400 && (startSeconds >= 600 || reachedVideoEnd);
      const done = sermonEnded || reachedVideoEnd || transcript.length >= 140000;

      if (done && transcript.length < 400) {
        return jsonResponse(
          { error: 'A transcrição da pregação ficou curta demais para gerar o quiz.' },
          422
        );
      }

      await saveTranscript(env, request, item, transcript, done, endSeconds);
      return jsonResponse({
        videoId: item.videoId,
        done,
        chars: transcript.length,
        coveredSeconds: endSeconds,
        durationSeconds: duration,
        coveredUntil: clockLabel(endSeconds),
      });
    } catch (error) {
      if (!requestedVideoId && youtubeReadDenied(error)) {
        deniedCount += 1;
        continue;
      }

      const message = youtubeReadDenied(error)
        ? youtubeReadDeniedMessage
        : error?.message || 'Não foi possível transcrever esta pregação do início ao fim.';
      const status = Number(error?.status) >= 400 ? Number(error.status) : 422;
      return jsonResponse({ error: message }, status);
    }
  }

  if (deniedCount > 0) {
    return jsonResponse({ error: youtubeReadDeniedMessage }, 403);
  }

  return jsonResponse({ error: 'Não foi possível transcrever esta pregação do início ao fim.' }, 422);
};

export const onRequestOptions = async () => new Response('ok', { headers: CORS_HEADERS });

export const onRequestPost = async (context) => {
  try {
    return await handlePost(context.request, context.env);
  } catch (error) {
    console.error('weekly-quiz handler error', error);
    return jsonResponse({ error: 'Erro interno ao montar o quiz.' }, 500);
  }
};
