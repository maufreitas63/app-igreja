const BOLL_API = 'https://bolls.life/get-text';

const VERSION_MAP = {
  ARA: {
    code: 'ARA',
    sigla: 'ARA',
    nome: 'Almeida Revista e Atualizada - ARA',
  },
  RA: {
    code: 'ARA',
    sigla: 'ARA',
    nome: 'Almeida Revista e Atualizada - ARA',
  },
  ARC: {
    code: 'ARC09',
    sigla: 'ARC',
    nome: 'Almeida Revista e Corrigida - ARC',
  },
  ARC09: {
    code: 'ARC09',
    sigla: 'ARC',
    nome: 'Almeida Revista e Corrigida - ARC',
  },
  ACF: {
    code: 'ACF11',
    sigla: 'ACF',
    nome: 'Almeida Corrigida Fiel - ACF',
  },
  ACF11: {
    code: 'ACF11',
    sigla: 'ACF',
    nome: 'Almeida Corrigida Fiel - ACF',
  },
  NVI: {
    code: 'NVIPT',
    sigla: 'NVI',
    nome: 'Nova Versão Internacional - NVI',
  },
  NVIPT: {
    code: 'NVIPT',
    sigla: 'NVI',
    nome: 'Nova Versão Internacional - NVI',
  },
  NTLH: {
    code: 'NTLH',
    sigla: 'NTLH',
    nome: 'Nova Tradução na Linguagem de Hoje - NTLH',
  },
  NAA: {
    code: 'NAA',
    sigla: 'NAA',
    nome: 'Nova Almeida Atualizada - NAA',
  },
};

const BOOKS = [
  [1, ['genesis', 'gn', 'gen']],
  [2, ['exodo', 'ex', 'exo']],
  [3, ['levitico', 'lv', 'lev']],
  [4, ['numeros', 'nm', 'num']],
  [5, ['deuteronomio', 'dt', 'deu', 'deut']],
  [6, ['josue', 'js', 'jos']],
  [7, ['juizes', 'jz', 'juiz']],
  [8, ['rute', 'rt', 'rut']],
  [9, ['1 samuel', '1samuel', 'i samuel', '1sm', '1 sam']],
  [10, ['2 samuel', '2samuel', 'ii samuel', '2sm', '2 sam']],
  [11, ['1 reis', '1reis', 'i reis', '1rs', '1 re']],
  [12, ['2 reis', '2reis', 'ii reis', '2rs', '2 re']],
  [13, ['1 cronicas', '1cronicas', 'i cronicas', '1cr', '1 cr']],
  [14, ['2 cronicas', '2cronicas', 'ii cronicas', '2cr', '2 cr']],
  [15, ['esdras', 'ed', 'esd']],
  [16, ['neemias', 'ne', 'nee']],
  [17, ['ester', 'et', 'est']],
  [18, ['job']],
  [19, ['salmos', 'sl', 'salmo', 'ps', 'psalmos']],
  [20, ['proverbios', 'pv', 'prov']],
  [21, ['eclesiastes', 'ec', 'ecl']],
  [22, ['canticos', 'ct', 'cantico', 'cantares']],
  [23, ['isaias', 'is', 'isa']],
  [24, ['jeremias', 'jr', 'jer']],
  [25, ['lamentacoes', 'lm', 'lam']],
  [26, ['ezequiel', 'ez', 'eze']],
  [27, ['daniel', 'dn', 'dan']],
  [28, ['oseias', 'os', 'ose']],
  [29, ['joel', 'jl']],
  [30, ['amos', 'am']],
  [31, ['obadias', 'ob', 'obd']],
  [32, ['jonas', 'jn']],
  [33, ['miqueias', 'mq', 'miq']],
  [34, ['naum', 'na']],
  [35, ['habacuque', 'hc', 'hab']],
  [36, ['sofonias', 'sf', 'sof']],
  [37, ['ageu', 'ag', 'age']],
  [38, ['zacarias', 'zc', 'zac']],
  [39, ['malaquias', 'ml', 'mal']],
  [40, ['mateus', 'mt', 'mat']],
  [41, ['marcos', 'mc', 'mr', 'marc']],
  [42, ['lucas', 'lc', 'luc']],
  [43, ['joao', 'jo', 'john', 'evangelho de joao']],
  [44, ['atos', 'at', 'act']],
  [45, ['romanos', 'rm', 'rom']],
  [46, ['1 corintios', '1corintios', 'i corintios', '1co', '1 cor']],
  [47, ['2 corintios', '2corintios', 'ii corintios', '2co', '2 cor']],
  [48, ['galatas', 'gl', 'gal']],
  [49, ['efesios', 'ef', 'efe']],
  [50, ['filipenses', 'fp', 'fil']],
  [51, ['colossenses', 'cl', 'col']],
  [52, ['1 tessalonicenses', '1tessalonicenses', 'i tessalonicenses', '1ts', '1 tes']],
  [53, ['2 tessalonicenses', '2tessalonicenses', 'ii tessalonicenses', '2ts', '2 tes']],
  [54, ['1 timoteo', '1timoteo', 'i timoteo', '1tm', '1 tim']],
  [55, ['2 timoteo', '2timoteo', 'ii timoteo', '2tm', '2 tim']],
  [56, ['tito', 'tt']],
  [57, ['filemom', 'fm', 'flm']],
  [58, ['hebreus', 'hb', 'heb']],
  [59, ['tiago', 'tg', 'tig']],
  [60, ['1 pedro', '1pedro', 'i pedro', '1pe', '1 ped']],
  [61, ['2 pedro', '2pedro', 'ii pedro', '2pe', '2 ped']],
  [62, ['1 joao', '1joao', 'i joao', '1jo', '1 jn']],
  [63, ['2 joao', '2joao', 'ii joao', '2jo', '2 jn']],
  [64, ['3 joao', '3joao', 'iii joao', '3jo', '3 jn']],
  [65, ['judas', 'jd']],
  [66, ['apocalipse', 'ap', 'apo', 'revelacao']],
];

const BOOK_LABELS = {
  1: 'Gênesis',
  2: 'Êxodo',
  3: 'Levítico',
  4: 'Números',
  5: 'Deuteronômio',
  6: 'Josué',
  7: 'Juízes',
  8: 'Rute',
  9: '1 Samuel',
  10: '2 Samuel',
  11: '1 Reis',
  12: '2 Reis',
  13: '1 Crônicas',
  14: '2 Crônicas',
  15: 'Esdras',
  16: 'Neemias',
  17: 'Ester',
  18: 'Jó',
  19: 'Salmos',
  20: 'Provérbios',
  21: 'Eclesiastes',
  22: 'Cânticos',
  23: 'Isaías',
  24: 'Jeremias',
  25: 'Lamentações',
  26: 'Ezequiel',
  27: 'Daniel',
  28: 'Oseias',
  29: 'Joel',
  30: 'Amós',
  31: 'Obadias',
  32: 'Jonas',
  33: 'Miqueias',
  34: 'Naum',
  35: 'Habacuque',
  36: 'Sofonias',
  37: 'Ageu',
  38: 'Zacarias',
  39: 'Malaquias',
  40: 'Mateus',
  41: 'Marcos',
  42: 'Lucas',
  43: 'João',
  44: 'Atos',
  45: 'Romanos',
  46: '1 Coríntios',
  47: '2 Coríntios',
  48: 'Gálatas',
  49: 'Efésios',
  50: 'Filipenses',
  51: 'Colossenses',
  52: '1 Tessalonicenses',
  53: '2 Tessalonicenses',
  54: '1 Timóteo',
  55: '2 Timóteo',
  56: 'Tito',
  57: 'Filemom',
  58: 'Hebreus',
  59: 'Tiago',
  60: '1 Pedro',
  61: '2 Pedro',
  62: '1 João',
  63: '2 João',
  64: '3 João',
  65: 'Judas',
  66: 'Apocalipse',
};

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const toInt = (value) => {
  const digits = String(value ?? '').trim();
  if (!/^[0-9]{1,3}$/.test(digits)) {
    return null;
  }
  return Number(digits);
};

const resolveVersion = (value) => {
  const key = normalize(value).replace(/\s+/g, '').toUpperCase();
  if (!key) {
    return VERSION_MAP.ARA;
  }
  return VERSION_MAP[key] || null;
};

const resolveBook = (value) => {
  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  let found = null;
  let foundLength = -1;

  for (const [id, names] of BOOKS) {
    for (const name of names) {
      const alias = normalize(name);
      if (alias === normalized && alias.length > foundLength) {
        found = id;
        foundLength = alias.length;
      }
    }
  }

  return found;
};

const parseReferencia = (raw) => {
  const text = String(raw || '').trim();
  if (!text) {
    return {};
  }

  const match = text.match(
    /^(?:(ara|arc|acf|nvi|ntlh|naa|ra)\s+)?(.+?)\s+(\d+)\s*(?:[:.,]\s*(\d+))?(?:\s*[-–]\s*(\d+))?$/i
  );

  if (!match) {
    return { livro: text };
  }

  return {
    versao: match[1] || '',
    livro: match[2],
    capitulo: match[3],
    versiculo: match[4] || '',
    versiculo_fim: match[5] || '',
  };
};

const stripHtml = (value) =>
  String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const lookupBiblePassage = async (args = {}) => {
  const parsed = parseReferencia(args.referencia);
  const versaoInput = args.versao || parsed.versao;
  const livroInput = args.livro || parsed.livro;
  const capitulo = toInt(args.capitulo ?? parsed.capitulo);
  const versiculo = toInt(args.versiculo ?? parsed.versiculo);
  const versiculoFim = toInt(args.versiculo_fim ?? parsed.versiculo_fim);
  const version = resolveVersion(versaoInput || 'ARA');
  const bookId = resolveBook(livroInput);
  const faltando = [];

  if (!livroInput) {
    faltando.push('livro');
  }
  if (!capitulo) {
    faltando.push('capitulo');
  }

  if (faltando.length) {
    return {
      ok: false,
      erro: 'parametros_insuficientes',
      faltando,
      dica: 'Informe versão (ARA, ARC, ACF, NVI), livro, capítulo e, se quiser, o versículo. Ex.: ARA João 3:16 ou João 3.',
    };
  }

  if (!version) {
    return {
      ok: false,
      erro: 'versao_desconhecida',
      dica: 'Use ARA, ARC, ACF, NVI, NTLH ou NAA.',
    };
  }

  if (!bookId) {
    return {
      ok: false,
      erro: 'livro_desconhecido',
      livro: livroInput,
      dica: 'Use o nome do livro em português (ex.: João, Salmos, 1 Coríntios).',
    };
  }

  const url = `${BOLL_API}/${encodeURIComponent(version.code)}/${bookId}/${capitulo}/`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Abigail-ConectaMais/1.0' },
    });

    if (!response.ok) {
      return {
        ok: false,
        erro: 'fonte_indisponivel',
        status: response.status,
      };
    }

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : [];

    if (!rows.length) {
      return {
        ok: false,
        erro: 'passagem_nao_encontrada',
        versao: version.sigla,
        livro: BOOK_LABELS[bookId],
        capitulo,
      };
    }

    const start = versiculo;
    const end = versiculoFim && start ? Math.max(start, versiculoFim) : start;
    const selected = rows.filter((row) => {
      const n = Number(row.verse);
      if (!start) {
        return true;
      }
      return n >= start && n <= (end || start);
    });

    if (!selected.length) {
      return {
        ok: false,
        erro: 'versiculo_nao_encontrado',
        versao: version.sigla,
        livro: BOOK_LABELS[bookId],
        capitulo,
        versiculo: start,
      };
    }

    const verses = selected.map((row) => ({
      n: Number(row.verse),
      texto: stripHtml(row.text),
    }));

    const referencia =
      start && end && end !== start
        ? `${BOOK_LABELS[bookId]} ${capitulo}:${start}-${end}`
        : start
          ? `${BOOK_LABELS[bookId]} ${capitulo}:${start}`
          : `${BOOK_LABELS[bookId]} ${capitulo}`;

    return {
      ok: true,
      versao: version.sigla,
      traducao: version.nome,
      aviso_traducao: `Texto conforme a tradução ${version.nome}.`,
      referencia,
      escopo: start ? 'versiculo' : 'capitulo',
      versiculos: verses,
      texto: verses.map((item) => `${item.n} ${item.texto}`).join('\n'),
    };
  } catch (error) {
    return {
      ok: false,
      erro: 'consulta_biblica_indisponivel',
      detalhe: error instanceof Error ? error.message : String(error),
    };
  }
};
