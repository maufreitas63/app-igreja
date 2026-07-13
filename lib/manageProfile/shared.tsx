import { formatFullName } from '@/lib/fullName';
import { isPlaceholderVisitorName } from '@/lib/profileOnboarding';
import { formatBrazilCepInput, formatBrazilDateInput, formatBrazilPhoneInput } from '@/lib/inputMasks';
import { ACCESS_PIN_LENGTH } from '@/lib/accessPin';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { supabase } from '@/lib/supabase';
import { fetchEffectiveSessionProfileRow } from '@/lib/effectiveProfileRpc';
import { getGhostEffectiveProfileId, isGhostModeActive } from '@/lib/ghostMode';
import { clearStoredProfileId, getStoredProfileId, getStoredUserPhone } from '@/lib/userSession';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type ProfileRecord = {
  id: string;
  [key: string]: unknown;
};

export type FieldKind = 'text' | 'phone' | 'date' | 'boolean' | 'url';
export type ProfileSectionKey = 'personal' | 'contact' | 'privacy' | 'technical' | 'vehicles'; // | 'family_link';

export type ProfileFieldRow = {
  key: string;
  kind: FieldKind;
  label: string;
  value: string;
  readOnly?: boolean;
};

export type ProfileSection = {
  key: ProfileSectionKey;
  title: string;
  fields: ProfileFieldRow[];
};

export type ProfileVehicle = {
  id: string;
  phone: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
};

export const FIELD_ORDER = [
  'id',
  'full_name',
  'phone',
  'birth_date',
  'family_id',
  'codigo_membro',
  'auth_user_id',
  'lgpd_accepted',
  'is_active',
  'selfie_url',
  'created_at',
  'updated_at',
] as const;

export const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  auth_user_id: 'ID do Usuário de Autenticação',
  codigo_membro: 'Código do Membro',
  role: 'Perfil',
  full_name: 'Nome Completo',
  cpf: 'CPF',
  email: 'E-mail',
  phone: 'Telefone',
  birth_date: 'Nascimento',
  membership_date: 'Data de Filiação',
  church_function: 'Função na Igreja',
  cep: 'CEP',
  address_street: 'Rua',
  address_number: 'Número',
  address_complement: 'Complemento',
  address_neighborhood: 'Bairro',
  address_city: 'Cidade',
  address_state: 'Estado',
  family_group_id: 'Grupo Familiar',
  family_id: 'Família',
  selfie_url: 'URL da Selfie',
  lgpd_accepted: 'LGPD Aceito',
  lgpd_accepted_at: 'Data do Aceite LGPD',
  lgpd_status: 'Status LGPD',
  lgpd_status_date: 'Data do Status LGPD',
  is_active: 'Perfil Ativo',
  medical_food_alerts: 'Alertas Alimentares',
  first_visit_date: 'Data da Primeira Visita',
  invited_by: 'Convidado Por',
  follow_up_status: 'Status de Acompanhamento',
  created_at: 'Criado Em',
  updated_at: 'Atualizado Em',
};

export const SECTION_TITLES: Record<ProfileSectionKey, string> = {
  personal: 'Dados Pessoais',
  contact: 'Contato',
  privacy: 'Privacidade / Status',
  technical: 'Endereço',
  vehicles: 'Veículos cadastrados',
  // family_link: 'Vincular a Familia',
};

/** Ordem de exibição das seções de dados do perfil (sem privacidade/status). */
export const SECTION_DISPLAY_ORDER: ProfileSectionKey[] = ['personal', 'contact', 'technical'];

export const READ_ONLY_FIELDS = new Set(['id', 'auth_user_id', 'created_at', 'updated_at', 'selfie_url']);
export const HIDDEN_PROFILE_FIELDS = new Set([
  'codigo_membro',
  'family_group_id',
  'family_id',
  'role',
  'is_active',
  'lgpd_accepted_at',
  'lgpd_status',
  'lgpd_status_date',
  'id',
  'auth_user_id',
  'created_at',
  'updated_at',
  'membership_date',
  'church_function',
  'first_visit_date',
  'follow_up_status',
  'invited_by',
  'selfie_url',
  'access_pin',
]);
export const DEFAULT_EXPANDED_SECTIONS: Record<ProfileSectionKey, boolean> = {
  personal: false,
  contact: false,
  privacy: false,
  technical: false,
  vehicles: false,
  // family_link: false,
};

export const ONBOARDING_EXPANDED_SECTIONS: Record<ProfileSectionKey, boolean> = {
  personal: true,
  contact: true,
  privacy: false,
  technical: true,
  vehicles: false,
  // family_link: false,
};

export const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

export const formatPhone = formatBrazilPhoneInput;

export const formatCep = formatBrazilCepInput;

export const formatDate = formatBrazilDateInput;

export const normalizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);

export const toIsoDate = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return null;
  }

  return `${cleaned.slice(4, 8)}-${cleaned.slice(2, 4)}-${cleaned.slice(0, 2)}`;
};

export const formatDisplayDateLike = (value: string | null | undefined) => {
  if (!value) return '';

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) {
    return value;
  }

  const [, year, month, day, hours, minutes] = match;
  if (hours && minutes) {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  return `${day}/${month}/${year}`;
};

export const formatBooleanValue = (value: boolean | null | undefined) => {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return 'Sem valor';
};

export const humanizeFieldKey = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const inferFieldKind = (key: string, value: unknown): FieldKind => {
  if (typeof value === 'boolean' || key.startsWith('is_') || key.endsWith('_accepted')) {
    return 'boolean';
  }

  if (key.includes('phone')) {
    return 'phone';
  }

  if (key.includes('birth_date') || key.endsWith('_date') || key.endsWith('_at')) {
    return 'date';
  }

  if (key.includes('url')) {
    return 'url';
  }

  return 'text';
};

/** Campos exibidos na seção Endereço, nesta ordem. */
export const ADDRESS_FIELD_ORDER = [
  'cep',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
] as const;

export const ADDRESS_FIELD_ORDER_SET = new Set<string>(ADDRESS_FIELD_ORDER);

export const inferSectionKey = (field: ProfileFieldRow): ProfileSectionKey => {
  if (
    field.key === 'full_name' ||
    field.key === 'birth_date' ||
    field.key.includes('name')
  ) {
    return 'personal';
  }

  if (field.key === 'medical_food_alerts') {
    return 'personal';
  }

  if (
    field.kind === 'phone' ||
    field.key.includes('email') ||
    field.key.includes('contact')
  ) {
    return 'contact';
  }

  if (
    field.key.includes('lgpd') ||
    field.key.includes('active') ||
    field.key.includes('accepted')
  ) {
    return 'privacy';
  }

  if (ADDRESS_FIELD_ORDER_SET.has(field.key)) {
    return 'technical';
  }

  return 'technical';
};

export const parseBooleanInput = (value: string) => {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) {
    return null;
  }

  if (['sim', 's', 'true', '1'].includes(normalized)) {
    return true;
  }

  if (['nao', 'n', 'false', '0'].includes(normalized)) {
    return false;
  }

  throw new Error('Use Sim ou Não para este campo.');
};

export function pickBestProfileRow(rows: ProfileRecord[]): ProfileRecord | null {
  if (!rows.length) {
    return null;
  }

  const withRealName = rows.find((row) => {
    const name = row.full_name;
    return (
      typeof name === 'string'
      && name.trim().length > 0
      && !isPlaceholderVisitorName(name)
    );
  });

  if (withRealName) {
    return withRealName;
  }

  const withAnyName = rows.find((row) => {
    const name = row.full_name;
    return typeof name === 'string' && name.trim().length > 0;
  });

  return withAnyName ?? rows[0];
}

export async function loadProfile(phoneParam: string | null): Promise<ProfileRecord | null> {
  if (isGhostModeActive()) {
    const row = await fetchEffectiveSessionProfileRow();

    if (row) {
      return row as ProfileRecord;
    }

    const ghostProfileId = getGhostEffectiveProfileId();

    if (ghostProfileId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ghostProfileId)
        .maybeSingle();

      if (!error && data) {
        return data as ProfileRecord;
      }
    }

    return null;
  }

  const ghostProfileId = getGhostEffectiveProfileId();

  if (ghostProfileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', ghostProfileId)
      .maybeSingle();

    if (!error && data) {
      return data as ProfileRecord;
    }
  }

  const phoneCandidates = new Set<string>();

  if (phoneParam?.trim()) {
    for (const variant of buildPhoneDbQueryVariants(phoneParam)) {
      phoneCandidates.add(variant);
    }
  }

  const storedPhone = await getStoredUserPhone();
  if (storedPhone?.trim()) {
    for (const variant of buildPhoneDbQueryVariants(storedPhone)) {
      phoneCandidates.add(variant);
    }
  }

  const variantList = [...phoneCandidates];
  if (variantList.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('phone', variantList)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar perfil por telefone:', error);
    } else {
      const best = pickBestProfileRow((data ?? []) as ProfileRecord[]);
      if (best) {
        return best;
      }
    }
  }

  const storedProfileId = await getStoredProfileId();
  if (storedProfileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', storedProfileId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil por id da sessão:', error);
    } else if (data) {
      return data as ProfileRecord;
    } else {
      await clearStoredProfileId();
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil por auth:', error);
    return null;
  }

  return (data as ProfileRecord | null) ?? null;
}

export const buildFieldRows = (profile: ProfileRecord | null): ProfileFieldRow[] => {
  if (!profile) {
    return [];
  }

  const profileKeys = Object.keys(profile);
  const orderedKeys = [
    ...FIELD_ORDER.filter((key) => profileKeys.includes(key)),
    ...profileKeys
      .filter((key) => !FIELD_ORDER.includes(key as (typeof FIELD_ORDER)[number]))
      .sort((left, right) => left.localeCompare(right)),
  ].filter((key) => !HIDDEN_PROFILE_FIELDS.has(key));

  return orderedKeys.map((key) => {
    const rawValue = profile[key];
    const kind = inferFieldKind(key, rawValue);
    let value = '';

    if (kind === 'date') {
      value = formatDisplayDateLike(rawValue as string | null | undefined);
    } else if (kind === 'boolean') {
      value = formatBooleanValue(rawValue as boolean | null | undefined);
    } else if (key === 'full_name') {
      value = formatFullName(rawValue == null ? '' : String(rawValue)) || 'Sem valor';
    } else {
      value =
        rawValue === null || rawValue === undefined || rawValue === ''
          ? 'Sem valor'
          : String(rawValue);
    }

    return {
      key,
      kind,
      label: FIELD_LABELS[key] ?? humanizeFieldKey(key),
      value,
      readOnly: READ_ONLY_FIELDS.has(key),
    };
  });
};

export const buildSections = (fields: ProfileFieldRow[]): ProfileSection[] => {
  const groupedFields: Record<ProfileSectionKey, ProfileFieldRow[]> = {
    personal: [],
    contact: [],
    privacy: [],
    technical: [],
    vehicles: [],
    // family_link: [],
  };

  for (const field of fields) {
    groupedFields[inferSectionKey(field)].push(field);
  }

  const sortTechnicalAddressFields = (sectionFields: ProfileFieldRow[]) => {
    const byKey = new Map(sectionFields.map((field) => [field.key, field]));
    return ADDRESS_FIELD_ORDER.map((key) => byKey.get(key)).filter(
      (row): row is ProfileFieldRow => Boolean(row)
    );
  };

  return SECTION_DISPLAY_ORDER.map((sectionKey) => ({
    key: sectionKey,
    title: SECTION_TITLES[sectionKey],
    fields:
      sectionKey === 'technical'
        ? sortTechnicalAddressFields(groupedFields[sectionKey])
        : groupedFields[sectionKey].map((field) =>
            sectionKey === 'privacy' ? { ...field, readOnly: true } : field
          ),
  })).filter((section) => section.fields.length > 0);
};

export const ACCESS_PIN_SECTION_BODY_MIN_HEIGHT = 404;

export type AccessPinFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  inputRef: React.RefObject<TextInput | null>;
  visible: boolean;
  onToggleVisible: () => void;
  editable: boolean;
  allowVisibilityToggle?: boolean;
  hasError?: boolean;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  returnKeyType?: 'next' | 'done';
};

export function AccessPinField({
  label,
  value,
  onChangeText,
  inputRef,
  visible,
  onToggleVisible,
  editable,
  allowVisibilityToggle = false,
  hasError = false,
  onFocus,
  onSubmitEditing,
  blurOnSubmit,
  returnKeyType,
}: AccessPinFieldProps) {
  // Olho sempre ativo para conferir o PIN (inclusive campos só leitura).
  const canToggleVisibility = true;

  // Só leitura: não usa TextInput — no web, password/remount apagava ou mascarava o PIN.
  const showReadonlyDisplay = !editable;

  const webInputProps =
    Platform.OS === 'web'
      ? ({
          // type explícito: secureTextEntry sozinho nem sempre troca password ↔ text no web.
          type: visible ? 'text' : 'password',
        } as const)
      : null;

  return (
    <View style={accessPinFieldStyles.fieldBlock}>
      <Text style={accessPinFieldStyles.label}>{label}</Text>
      <View style={accessPinFieldStyles.row}>
        {showReadonlyDisplay ? (
          <View
            style={[
              accessPinFieldStyles.input,
              visible && accessPinFieldStyles.inputVisible,
              accessPinFieldStyles.readonlyDigits,
              hasError && accessPinFieldStyles.inputError,
            ]}
          >
            <Text style={accessPinFieldStyles.readonlyDigitsText}>
              {visible
                ? value.length > 0
                  ? value
                  : '—'
                : value.length > 0
                  ? '•'.repeat(value.length)
                  : '••••'}
            </Text>
          </View>
        ) : (
          <TextInput
            ref={inputRef}
            style={[
              accessPinFieldStyles.input,
              visible && accessPinFieldStyles.inputVisible,
              hasError && accessPinFieldStyles.inputError,
              // Garante que o web não mantenha -webkit-text-security: disc após o toggle.
              Platform.OS === 'web'
                ? ({ WebkitTextSecurity: visible ? 'none' : 'disc' } as object)
                : null,
            ]}
            placeholder={visible ? '' : '••••'}
            placeholderTextColor={MINIMAL_UI.textMuted}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit}
            returnKeyType={returnKeyType}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={ACCESS_PIN_LENGTH}
            secureTextEntry={!visible}
            editable={editable}
            textAlign="center"
            scrollEnabled={false}
            autoCorrect={false}
            autoCapitalize="none"
            importantForAutofill="no"
            autoComplete="off"
            textContentType="oneTimeCode"
            {...(webInputProps ?? {})}
          />
        )}
        <TouchableOpacity
          style={accessPinFieldStyles.visibilityButton}
          onPress={onToggleVisible}
          disabled={!canToggleVisibility}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          accessibilityState={{ disabled: !canToggleVisibility, selected: visible }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialIcons
            name={visible ? 'visibility' : 'visibility-off'}
            size={22}
            color={visible ? MINIMAL_UI.blueDark : MINIMAL_UI.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const accessPinFieldStyles = StyleSheet.create({
  fieldBlock: {
    minHeight: 77,
    marginBottom: 0,
  },
  label: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    height: 18,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.blueDark,
    paddingHorizontal: 15,
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    marginBottom: 0,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 4,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
  },
  inputVisible: {
    letterSpacing: 10,
    fontWeight: '700',
  },
  readonlyDigits: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  readonlyDigitsText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  visibilityButton: {
    width: 44,
    height: 52,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
});