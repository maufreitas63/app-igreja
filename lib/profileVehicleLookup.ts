import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';

export type ProfileVehicleRow = {
  id: string;
  phone: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  celular: string | null;
};

export type VehicleOwnerInfo = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export type VehicleLookupResult = {
  vehicle: ProfileVehicleRow;
  owner: VehicleOwnerInfo | null;
  /** Telefone usado para WhatsApp (referência do veículo ou contato). */
  contactPhone: string | null;
};

export const normalizeVehiclePlaca = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Formatos possíveis da placa no banco (com ou sem hífen). */
export const buildPlateDbQueryVariants = (normalizedPlaca: string): string[] => {
  const plate = normalizedPlaca.trim().toUpperCase();
  const variants = new Set<string>([plate]);

  if (plate.length === 7) {
    variants.add(`${plate.slice(0, 3)}-${plate.slice(3)}`);
    variants.add(`${plate.slice(0, 4)}-${plate.slice(4)}`);
  }

  return [...variants];
};

const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

const pickVehicleByPlaca = (
  rows: ProfileVehicleRow[] | null | undefined,
  normalizedPlaca: string
) =>
  (rows ?? []).find((entry) => normalizeVehiclePlaca(entry.placa ?? '') === normalizedPlaca) ?? null;

async function fetchVehicleRowsByPlaca(normalizedPlaca: string): Promise<ProfileVehicleRow[]> {
  const plateVariants = buildPlateDbQueryVariants(normalizedPlaca);

  const { data: exactRows, error: exactError } = await supabase
    .from('profile_vehicles')
    .select('id, phone, placa, marca, modelo, cor, celular')
    .in('placa', plateVariants)
    .limit(10);

  if (exactError) {
    throw exactError;
  }

  const exactMatch = pickVehicleByPlaca(exactRows as ProfileVehicleRow[], normalizedPlaca);
  if (exactMatch) {
    return [exactMatch];
  }

  if (normalizedPlaca.length < 5) {
    return [];
  }

  const { data: likeRows, error: likeError } = await supabase
    .from('profile_vehicles')
    .select('id, phone, placa, marca, modelo, cor, celular')
    .ilike('placa', `%${normalizedPlaca}%`)
    .limit(25);

  if (likeError) {
    throw likeError;
  }

  const matched = pickVehicleByPlaca(likeRows as ProfileVehicleRow[], normalizedPlaca);
  return matched ? [matched] : [];
}

async function resolveOwnerByPhone(vehiclePhone: string): Promise<VehicleOwnerInfo | null> {
  const trimmedPhone = vehiclePhone.trim();
  if (!trimmedPhone) {
    return null;
  }

  const phoneVariants = buildPhoneDbQueryVariants(trimmedPhone);
  const normalizedVehiclePhone = normalizePhoneDigits(trimmedPhone);

  const { data: exactOwner, error: exactOwnerError } = await supabase
    .from('profiles')
    .select('full_name, phone, email')
    .eq('phone', trimmedPhone)
    .maybeSingle();

  if (exactOwnerError) {
    throw exactOwnerError;
  }

  if (exactOwner) {
    return {
      full_name: exactOwner.full_name ?? null,
      phone: exactOwner.phone ?? null,
      email: exactOwner.email ?? null,
    };
  }

  if (phoneVariants.length) {
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .in('phone', phoneVariants)
      .limit(30);

    if (profilesError) {
      throw profilesError;
    }

    const matchedProfile = (profileRows ?? []).find(
      (entry) => normalizePhoneDigits(entry.phone) === normalizedVehiclePhone
    );

    if (matchedProfile) {
      return {
        full_name: matchedProfile.full_name ?? null,
        phone: matchedProfile.phone ?? null,
        email: matchedProfile.email ?? null,
      };
    }

    const { data: memberRows, error: membersError } = await supabase
      .from('members')
      .select('full_name, phone')
      .in('phone', phoneVariants)
      .limit(30);

    if (membersError) {
      throw membersError;
    }

    const matchedMember = (memberRows ?? []).find(
      (entry) => normalizePhoneDigits(entry.phone) === normalizedVehiclePhone
    );

    if (matchedMember) {
      return {
        full_name: matchedMember.full_name ?? null,
        phone: matchedMember.phone ?? null,
        email: null,
      };
    }
  }

  return null;
}

export const resolveVehicleContactPhone = (result: VehicleLookupResult) => {
  const referencePhone = result.vehicle.phone?.trim();
  if (referencePhone) {
    return referencePhone;
  }

  const extraPhone = result.vehicle.celular?.trim();
  if (extraPhone) {
    return extraPhone;
  }

  return result.owner?.phone?.trim() || null;
};

export const formatVehicleFieldValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
};

/** Busca veículo em `profile_vehicles` pela placa e resolve proprietário em `profiles` / `members`. */
export async function lookupVehicleByPlaca(rawPlaca: string): Promise<VehicleLookupResult> {
  const normalizedPlaca = normalizeVehiclePlaca(rawPlaca);

  if (!normalizedPlaca) {
    throw new Error('Informe a placa do veículo.');
  }

  if (normalizedPlaca.length < 7) {
    throw new Error('Informe a placa completa do veículo.');
  }

  const rows = await fetchVehicleRowsByPlaca(normalizedPlaca);
  const vehicle = rows[0] ?? null;

  if (!vehicle) {
    throw new Error('Nenhum veículo encontrado para esta placa.');
  }

  const vehiclePhone = vehicle.phone?.trim() ?? '';
  const owner = vehiclePhone ? await resolveOwnerByPhone(vehiclePhone) : null;

  const contactPhone =
    vehiclePhone || vehicle.celular?.trim() || owner?.phone?.trim() || null;

  return {
    vehicle: {
      id: vehicle.id,
      phone: vehiclePhone,
      placa: vehicle.placa,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      cor: vehicle.cor,
      celular: vehicle.celular,
    },
    owner,
    contactPhone,
  };
}
