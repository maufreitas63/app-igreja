import {
  MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
  MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  MINIMAL_TYPO,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { resolveTenantChromeLogo } from '@/lib/tenantBranding';
import {
  getStoredActiveIgrejaBranding,
  resolveActiveIgrejaBranding,
} from '@/lib/tenantSession';
import { getStoredUserPhone } from '@/lib/userSession';
import { Image, type ImageSource } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function resolveGreetingName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();

  if (!trimmed) {
    return 'usuário';
  }

  const firstName = trimmed.split(/\s+/)[0]?.trim();
  return firstName || 'usuário';
}

/** Faixa superior isolada: saudação à esquerda e logo da instância à direita. */
export function MinimalTopIdentityBar({ showGreeting = false }: { showGreeting?: boolean }) {
  const [greetingName, setGreetingName] = useState('usuário');
  const [logoSource, setLogoSource] = useState<ImageSource | null>(null);
  const [logoLabel, setLogoLabel] = useState('Logo da igreja');
  const [logoText, setLogoText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      // Pinta do cache local primeiro; depois atualiza via RPC
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

  useEffect(() => {
    if (!showGreeting) {
      return undefined;
    }

    let active = true;

    void (async () => {
      const phone = await getStoredUserPhone();

      if (!phone?.trim() || !active) {
        return;
      }

      const profile = await loadEffectiveSessionProfile(phone);

      if (!active) {
        return;
      }

      setGreetingName(resolveGreetingName(profile?.full_name));
    })();

    return () => {
      active = false;
    };
  }, [showGreeting]);

  return (
    <View style={[styles.row, !showGreeting && styles.rowLogoOnly]}>
      {showGreeting ? (
        <View style={styles.greetingSlot}>
          <Text style={styles.greeting} numberOfLines={1}>
            Olá, {greetingName}
          </Text>
        </View>
      ) : null}

      <View style={styles.logoSlot}>
        {logoSource ? (
          <Image
            source={logoSource}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={logoLabel}
          />
        ) : (
          <Text style={styles.logoFallback} numberOfLines={1} accessibilityLabel={logoLabel}>
            {logoText || 'Igreja'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
    width: '50%',
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.background,
  },
  rowLogoOnly: {
    justifyContent: 'flex-start',
  },
  greetingSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 12,
  },
  greeting: {
    ...MINIMAL_TYPO.greeting,
    textAlign: 'left',
  },
  logoSlot: {
    flexShrink: 0,
    maxWidth: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT * 2.4,
    height: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  },
  logoFallback: {
    ...MINIMAL_TYPO.greeting,
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
    textAlign: 'left',
  },
});
