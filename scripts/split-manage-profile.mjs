import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'app/manage-profile.tsx');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

const sharedHeader = `import { formatFullName } from '@/lib/fullName';
import { isPlaceholderVisitorName } from '@/lib/profileOnboarding';
import { formatBrazilCepInput, formatBrazilDateInput, formatBrazilPhoneInput } from '@/lib/inputMasks';
import { ACCESS_PIN_LENGTH } from '@/lib/accessPin';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';
import { fetchEffectiveSessionProfileRow } from '@/lib/effectiveProfileRpc';
import { getGhostEffectiveProfileId, isGhostModeActive } from '@/lib/ghostMode';
import { clearStoredProfileId, getStoredProfileId, getStoredUserPhone } from '@/lib/userSession';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

`;

const sharedBlock = lines.slice(86, 687).join('\n');
fs.writeFileSync(path.join(root, 'lib/manageProfile/shared.ts'), sharedHeader + sharedBlock);

const exportsBlock = `
export type {
  ProfileRecord,
  FieldKind,
  ProfileSectionKey,
  ProfileFieldRow,
  ProfileSection,
  ProfileVehicle,
};
export {
  FIELD_ORDER,
  FIELD_LABELS,
  SECTION_TITLES,
  SECTION_DISPLAY_ORDER,
  READ_ONLY_FIELDS,
  HIDDEN_PROFILE_FIELDS,
  DEFAULT_EXPANDED_SECTIONS,
  ONBOARDING_EXPANDED_SECTIONS,
  buildFieldRows,
  buildSections,
  loadProfile,
  AccessPinField,
  ACCESS_PIN_SECTION_BODY_MIN_HEIGHT,
};
`;

fs.writeFileSync(
  path.join(root, 'lib/manageProfile/index.ts'),
  `export * from './shared';\n`
);

console.log('Extracted lib/manageProfile/shared.ts');
