import { normalizeScaleTypeCode } from '@/lib/maintenanceScaleTypesApi';

const TSTMAX_SCALE_CODE_PREFIX = 'tstmax';
const SCALE_TYPE_RESOURCE_PREFIX = 'scale_type.';

/** Tipos de escala de teste (carga TstMax) não entram no Controle de Acesso. */
export const isTstMaxScaleTypeCode = (code: string) =>
  normalizeScaleTypeCode(code).startsWith(TSTMAX_SCALE_CODE_PREFIX);

export const isTstMaxScaleTypeResourceKey = (resourceKey: string) => {
  const trimmed = resourceKey.trim().toLowerCase();

  if (!trimmed.startsWith(SCALE_TYPE_RESOURCE_PREFIX)) {
    return false;
  }

  return isTstMaxScaleTypeCode(trimmed.slice(SCALE_TYPE_RESOURCE_PREFIX.length));
};
