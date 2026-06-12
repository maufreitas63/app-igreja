export type ProfileSearchRow = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
};

export const mapProfileSearchRow = (row: Record<string, unknown>): ProfileSearchRow | null => {
  const id = String(row.id ?? '').trim();
  const fullName = String(row.full_name ?? row.fullName ?? '').trim();

  if (!id || !fullName) {
    return null;
  }

  return {
    id,
    fullName,
    phone: row.phone != null ? String(row.phone).trim() || null : null,
    memberCode:
      row.codigo_membro != null
        ? String(row.codigo_membro).trim() || null
        : row.memberCode != null
          ? String(row.memberCode).trim() || null
          : null,
  };
};

export const mapProfileSearchRows = (data: unknown): ProfileSearchRow[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => mapProfileSearchRow(row as Record<string, unknown>))
    .filter((row): row is ProfileSearchRow => row !== null);
};
