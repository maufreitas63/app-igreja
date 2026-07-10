import {
  MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  MINIMAL_TYPO,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import { resolveTenantChromeLogo } from '@/lib/tenantBranding';
import {
  getStoredActiveIgrejaBranding,
  resolveActiveIgrejaBranding,
} from '@/lib/tenantSession';
import { Image, type ImageSource } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Logo da instância — posicionado à direita do chrome, fora da faixa de saudação. */
export function MinimalTopChurchLogo() {
  const [logoSource, setLogoSource] = useState<ImageSource | null>(null);
  const [logoLabel, setLogoLabel] = useState('Logo da igreja');
  const [logoText, setLogoText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = await getStoredActiveIgrejaBranding();
      if (active && stored) {
        const cached = resolveTenantChromeLogo(stored);
        setLogoLabel(cached.label);
        if (cached.kind === 'image') {
          setLogoSource(cached.source);
          setLogoText(null);
        } else {
          setLogoSource(null);
          setLogoText(cached.name);
        }
      }

      const branding = await resolveActiveIgrejaBranding();
      if (!active) {
        return;
      }

      const resolved = resolveTenantChromeLogo(branding);
      setLogoLabel(resolved.label);
      if (resolved.kind === 'image') {
        setLogoSource(resolved.source);
        setLogoText(null);
      } else {
        setLogoSource(null);
        setLogoText(resolved.name);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.slot} pointerEvents="none">
      {logoSource ? (
        <Image
          source={logoSource}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={logoLabel}
        />
      ) : (
        <Text style={styles.fallback} numberOfLines={2} accessibilityLabel={logoLabel}>
          {logoText || 'Igreja'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    maxWidth: '48%',
  },
  logo: {
    width: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT * 2.4,
    height: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  },
  fallback: {
    ...MINIMAL_TYPO.greeting,
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 180,
  },
});
