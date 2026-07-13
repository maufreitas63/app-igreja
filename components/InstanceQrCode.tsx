import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type InstanceQrCodeProps = {
  /** URL pública da instância atual (ex.: https://app-igreja.pages.dev/?igreja=IBEP). */
  url: string;
  size?: number;
  caption?: string;
};

/**
 * QR Code puro da instância — recebe a URL via prop (stateless).
 * Fundo branco, módulos em azul escuro (identidade minimalista).
 */
export function InstanceQrCode({
  url,
  size = 184,
  caption = 'Escaneie para acessar o app',
}: InstanceQrCodeProps) {
  const value = url.trim();
  if (!value) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityLabel={`${caption}. ${value}`}>
      <View style={styles.qrSurface}>
        <QRCode
          value={value}
          size={size}
          color={MINIMAL_UI.blueDark}
          backgroundColor={MINIMAL_UI.background}
          ecl="M"
          quietZone={8}
        />
      </View>
      <Text style={styles.caption}>{caption}</Text>
      <Text style={styles.urlHint} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
  },
  qrSurface: {
    backgroundColor: MINIMAL_UI.background,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: 12,
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  urlHint: {
    marginTop: 6,
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
