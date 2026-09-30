import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { formatFamilyCodeShortDisplay, normalizeFamilyCode } from '@/lib/family';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/**
 * Crachá público do visitante — aberto pelo link enviado no WhatsApp.
 * Query: ?c=CODIGO_FAMILIA
 */
export default function CrachaVisitanteScreen() {
  const { prefix: entityPrefix } = useEntityPrefix();
  const params = useLocalSearchParams<{ c?: string | string[] }>();
  const raw = Array.isArray(params.c) ? params.c[0] : params.c;
  const familyId = useMemo(() => normalizeFamilyCode(String(raw ?? '').trim()), [raw]);
  const shortCode = useMemo(
    () => formatFamilyCodeShortDisplay(familyId, entityPrefix),
    [entityPrefix, familyId]
  );

  if (!familyId) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Crachá indisponível</Text>
        <Text style={styles.hint}>Abra o link completo enviado no WhatsApp.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>Espaço Infantil</Text>
      <Text style={styles.title}>Crachá digital</Text>
      <Text style={styles.hint}>Apresente este QR Code na retirada segura da criança.</Text>
      <View style={styles.qrSurface}>
        <QRCode
          value={familyId}
          size={240}
          color={MINIMAL_UI.blueDark}
          backgroundColor={MINIMAL_UI.background}
          ecl="M"
          quietZone={12}
        />
      </View>
      <Text style={styles.code}>{shortCode || familyId}</Text>
      <Text style={styles.codeHint}>Informe este número ao voluntário na sala</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: MINIMAL_UI.background,
    gap: 10,
  },
  eyebrow: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: 320,
  },
  qrSurface: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  code: {
    marginTop: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
