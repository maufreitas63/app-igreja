const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-profile-id, x-ghost-profile-id, x-tenant-id',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];
const DEFAULT_SUPABASE_URL = 'https://hvqbetpgrwvzunmyxpwa.supabase.co';

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
  ];

  for (const raw of candidates) {
    if (isUsableSupabaseKey(raw)) {
      return String(raw).trim();
    }
  }

  return '';
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

const resolveGeminiApiKey = async (env) => {
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

const fetchTranscript = async (videoId) => {
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

  if (timed.length >= 400) {
    return timed;
  }

  throw new Error(
    'Esta pregação não tem legenda utilizável. Sem a transcrição o quiz não é gerado.'
  );
};

const extractJson = (text) => {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');

  if (start < 0 || end <= start) {
    throw new Error('A geração não devolveu as 10 perguntas.');
  }

  return JSON.parse(source.slice(start, end + 1));
};

const normalizeQuestions = (payload) => {
  const rows = Array.isArray(payload?.questions) ? payload.questions : [];

  if (rows.length !== 10) {
    throw new Error('A geração não devolveu exatamente 10 perguntas.');
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
    'Você cria um quiz de múltipla escolha somente com o que está na transcrição da pregação.',
    'Devolva JSON puro, sem markdown, neste formato:',
    '{"questions":[{"prompt":"","options":["","","",""],"correctIndex":0,"bibleBook":"","bibleChapter":1,"bibleVerse":1,"bibleReference":""}]}',
    'Regras: exatamente 10 perguntas; 4 alternativas; uma correta; correctIndex de 0 a 3.',
    'A referência bíblica precisa ser um texto citado na pregação, com livro, capítulo e versículo.',
    'Não invente versículo, história ou aplicação que não esteja na mensagem.',
    'As alternativas erradas devem ser plausíveis, mas não podem contradizer a citação usada.',
  ].join('\n');

  const userText = `Título: ${title}\n\nTranscrição:\n${transcript.slice(0, 18000)}`;
  let lastError = 'Não foi possível gerar as perguntas.';

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        lastError = payload?.error?.message || `Gemini recusou a geração (${response.status}).`;
        continue;
      }

      const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n') ?? '';
      return normalizeQuestions(extractJson(text));
    } catch (error) {
      lastError = error?.message || lastError;
    }
  }

  throw new Error(lastError);
};

const handlePost = async (request, env) => {
  const sessionToken = request.headers.get('x-session-token')?.trim() || '';

  if (!sessionToken) {
    return jsonResponse({ error: 'Sessão inválida. Saia e entre novamente no aplicativo.' }, 401);
  }

  let prepared;

  try {
    prepared = await supabaseRpc(env, 'weekly_quiz_prepare_generation', {}, request);
  } catch (error) {
    const status = Number(error?.status) >= 400 ? Number(error.status) : 400;
    return jsonResponse({ error: error?.message || 'Não foi possível preparar o quiz.' }, status);
  }

  const youtubeUrl = String(prepared?.youtubeUrl ?? '').trim();
  const used = new Set(
    (Array.isArray(prepared?.usedVideoIds) ? prepared.usedVideoIds : []).map((id) => String(id))
  );

  let channelId;
  let videos;

  try {
    channelId = await resolveChannelId(youtubeUrl);
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

  const publishedAt = new Date(video.published);

  if (Number.isNaN(publishedAt.getTime())) {
    return jsonResponse({ error: 'A data de publicação desta pregação não pôde ser lida.' }, 502);
  }

  let transcript;

  try {
    transcript = await fetchTranscript(video.videoId);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Não foi possível ler a transcrição.' }, 422);
  }

  const geminiApiKey = await resolveGeminiApiKey(env);

  if (!geminiApiKey) {
    return jsonResponse(
      { error: 'Chave Gemini não configurada. Cadastre em Engrenagem → Chave Gemini.' },
      503
    );
  }

  let questions;

  try {
    questions = await generateQuestions(geminiApiKey, transcript, video.title);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Não foi possível gerar as 10 perguntas.' }, 422);
  }

  try {
    const snapshot = await supabaseRpc(
      env,
      'weekly_quiz_store_draft',
      {
        p_video_id: video.videoId,
        p_title: video.title,
        p_sermon_published_at: publishedAt.toISOString(),
        p_transcript: transcript,
        p_questions: questions,
      },
      request
    );

    return jsonResponse({ snapshot });
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Não foi possível gravar a prévia do quiz.' }, 400);
  }
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
