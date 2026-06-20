const FULL_NAME_CONNECTORS = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);

const capitalizeNamePart = (part: string) => {
  if (!part) {
    return part;
  }

  const chars = Array.from(part);
  const [first, ...rest] = chars;
  return `${first.toLocaleUpperCase('pt-BR')}${rest.join('')}`;
};

const formatNameWord = (word: string) => {
  const lower = word.toLocaleLowerCase('pt-BR');

  if (FULL_NAME_CONNECTORS.has(lower)) {
    return lower;
  }

  return lower
    .split(/([-'\u2019])/)
    .map((part) => (part === '-' || part === '\'' || part === '\u2019' ? part : capitalizeNamePart(part)))
    .join('');
};

export function formatFullName(value: string | null | undefined) {
  const normalizedWhitespace = (value ?? '').trim().replace(/\s+/g, ' ');

  if (!normalizedWhitespace) {
    return '';
  }

  return normalizedWhitespace.split(' ').map(formatNameWord).join(' ');
}

export function formatFullNameOrNull(value: string | null | undefined) {
  return formatFullName(value) || null;
}

export function normalizeFullNameKey(value: string | null | undefined) {
  return formatFullName(value)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
