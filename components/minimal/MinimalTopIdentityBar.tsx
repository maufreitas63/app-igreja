import {
  MINIMAL_TOP_IDENTITY_BAR_HEIGHT,
} from '@/lib/minimalUiTheme';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

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
      className="w-1/2 flex-row items-center justify-start self-start bg-minimal-bg"
      style={{ minHeight: Math.round(MINIMAL_TOP_IDENTITY_BAR_HEIGHT * 0.45) }}
      accessibilityElementsHidden={!showGreeting}
      importantForAccessibility={showGreeting ? 'yes' : 'no-hide-descendants'}
    >
      <Text
        className={cn(
          'shrink text-left text-minimal-greeting',
          !showGreeting && 'text-minimal-bg'
        )}
        numberOfLines={1}
        accessibilityRole={showGreeting ? 'text' : undefined}
      >
        Olá, {greetingName}
      </Text>
    </View>
  );
}
