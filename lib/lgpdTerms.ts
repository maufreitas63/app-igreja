import { getAppParameterValue } from '@/lib/appParameters';

export const DEFAULT_LGPD_ENTITY_NAME = 'Igreja Batista Norte (IBN)';

const LGPD_TERMS_SUFFIX =
  'respeita a privacidade de seus membros e visitantes, comprometendo-se a coletar e tratar os dados estritamente necessários para gestão administrativa, controle de segurança, atividades eclesiásticas e para a divulgação de eventos e ações da igreja em mídias sociais e outros veículos oficiais de comunicação, sempre em estrita observância à Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).';

export function buildLgpdTermsText(entityName: string) {
  const normalizedEntityName = entityName.trim() || DEFAULT_LGPD_ENTITY_NAME;
  return `A ${normalizedEntityName} ${LGPD_TERMS_SUFFIX}`;
}

export async function loadLgpdEntityName() {
  try {
    const value = await getAppParameterValue('Nome_Entidade');
    return value?.trim() || DEFAULT_LGPD_ENTITY_NAME;
  } catch (error) {
    console.error('Erro ao carregar Nome_Entidade:', error);
    return DEFAULT_LGPD_ENTITY_NAME;
  }
}

export async function loadLgpdTermsText() {
  const entityName = await loadLgpdEntityName();
  return buildLgpdTermsText(entityName);
}

export function buildLgpdDeclineMessage(entityName: string) {
  const normalizedEntityName = entityName.trim() || DEFAULT_LGPD_ENTITY_NAME;
  return `Agradecemos pela resposta. A ${normalizedEntityName} respeitará a privacidade do usuário na negativa do aceite.`;
}
