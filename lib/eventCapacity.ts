export const UNLIMITED_EVENT_CAPACITY = 999;

export const UNLIMITED_EVENT_CAPACITY_LABEL = 'Vagas ilimitadas';

export const parseEventCapacityValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isUnlimitedEventCapacity = (value: number | string | null | undefined) =>
  parseEventCapacityValue(value) === UNLIMITED_EVENT_CAPACITY;

export const formatEventCapacityLabel = (value: number | string | null | undefined) => {
  if (isUnlimitedEventCapacity(value)) {
    return UNLIMITED_EVENT_CAPACITY_LABEL;
  }

  const capacity = parseEventCapacityValue(value);
  if (capacity === null) {
    return 'Sem limite';
  }

  return `${capacity} vagas`;
};
