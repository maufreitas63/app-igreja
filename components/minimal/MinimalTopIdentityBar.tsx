import {
  MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
  MINIMAL_TYPO,
  MINIMAL_UI,
} from '@/lib/minimalUiTheme';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
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

/**
 * Faixa superior esquerda: saudação.
 * Na home fica visível; nas demais telas mantém o espaço com texto na cor do fundo
 * para o menu não subir.
 */
export function MinimalTopIdentityBar({ showGreeting = false }: { showGreeting?: boolean }) {
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
    <View
      style={styles.row}
      accessibilityElementsHidden={!showGreeting}
      importantForAccessibility={showGreeting ? 'yes' : 'no-hide-descendants'}
    >
      <Text
        style={[styles.greeting, !showGreeting && styles.greetingSpacer]}
        numberOfLines={1}
        accessibilityRole={showGreeting ? 'text' : undefined}
      >
        Olá, {greetingName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: Math.round(MINIMAL_TOP_IDENTITY_BAR_HEIGHT * 0.45),
    width: '50%',
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.background,
  },
  greeting: {
    ...MINIMAL_TYPO.greeting,
    textAlign: 'left',
    flexShrink: 1,
  },
  /** Mesmo espaço da saudação, invisível no fundo branco. */
  greetingSpacer: {
    color: MINIMAL_UI.background,
  },
});
