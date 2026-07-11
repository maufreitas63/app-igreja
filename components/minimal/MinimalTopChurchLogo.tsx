import {
  MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  MINIMAL_TYPO,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import { resolveTenantChromeLogo, type TenantLogoResolution } from '@/lib/tenantBranding';
import {
  getStoredActiveIgrejaBranding,
  resolveActiveIgrejaBranding,
  subscribeActiveTenantChange,
} from '@/lib/tenantSession';
import { Image, type ImageSource } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function logoSignature(resolved: TenantLogoResolution): string {
  if (resolved.kind === 'image') {
    const source = resolved.source as { uri?: string } | number;
    if (typeof source === 'number') {
      return `local:${source}`;
    }
    return `uri:${source?.uri ?? ''}`;
  }
  return `text:${resolved.name}`;
}

function applyResolvedLogo(
  resolved: TenantLogoResolution,
  setters: {
    setLogoSource: (value: ImageSource | null) => void;
    setLogoLabel: (value: string) => void;
    setLogoText: (value: string | null) => void;
  },
  lastSignature: React.MutableRefObject<string>
) {
  const signature = logoSignature(resolved);
  if (lastSignature.current === signature) {
    return;
  }
  lastSignature.current = signature;
  setters.setLogoLabel(resolved.label);
  if (resolved.kind === 'image') {
    setters.setLogoSource(resolved.source);
    setters.setLogoText(null);
  } else {
    setters.setLogoSource(null);
    setters.setLogoText(resolved.name);
  }
}

/** Logo da instância — posicionado à direita do chrome, fora da faixa de saudação. */
export function MinimalTopChurchLogo() {
  const [logoSource, setLogoSource] = useState<ImageSource | null>(null);
  const [logoLabel, setLogoLabel] = useState('Logo da igreja');
  const [logoText, setLogoText] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const lastSignature = useRef('');
  const lastTenantId = useRef<string | null>(null);

  useEffect(() => {
    return subscribeActiveTenantChange((tenantId) => {
      // Só recarrega quando a instância de fato muda.
      if (lastTenantId.current === tenantId) {
        return;
      }
      lastTenantId.current = tenantId;
      setReloadToken((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const setters = { setLogoSource, setLogoLabel, setLogoText };

    void (async () => {
      const stored = await getStoredActiveIgrejaBranding();
      if (!active) return;

      if (stored) {
        lastTenantId.current = stored.id;
        applyResolvedLogo(resolveTenantChromeLogo(stored), setters, lastSignature);
      }

      // Refresh de rede em background; persistência silenciosa (sem re-notificar).
      try {
        const branding = await resolveActiveIgrejaBranding();
        if (!active || !branding) return;
        lastTenantId.current = branding.id;
        applyResolvedLogo(resolveTenantChromeLogo(branding), setters, lastSignature);
      } catch {
        // Mantém logo local se a rede falhar.
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return (
    <View style={styles.slot} pointerEvents="none">
      {logoSource ? (
        <Image
          source={logoSource}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={logoLabel}
          transition={0}
          cachePolicy="memory-disk"
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
