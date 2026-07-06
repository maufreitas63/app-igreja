import {
  MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
  MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  MINIMAL_TYPO,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const LOGO_SOURCE = require('@/images/IBNORTE - LOGO MARCA 9.png');

function resolveGreetingName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();

  if (!trimmed) {
    return 'usuário';
  }

  const firstName = trimmed.split(/\s+/)[0]?.trim();
  return firstName || 'usuário';
}

/** Faixa superior isolada: saudação à esquerda e logo à direita. */
export function MinimalTopIdentityBar() {
  const [greetingName, setGreetingName] = useState('usuário');

  useEffect(() => {
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
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.greetingSlot}>
        <Text style={styles.greeting} numberOfLines={1}>
          Olá, {greetingName}
        </Text>
      </View>

      <View style={styles.logoSlot}>
        <Image source={LOGO_SOURCE} style={styles.logo} contentFit="contain" accessibilityLabel="Logo IBNORTE" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
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
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  logo: {
    width: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT * 2.4,
    height: MINIMAL_TOP_IDENTITY_LOGO_HEIGHT,
  },
});
