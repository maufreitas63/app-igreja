import { appAlert } from '@/lib/appAlert';
import { buildBirthdayGreetingMessage } from '@/lib/birthdayGreetingAccess';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  aniversariantes: Array<{ full_name: string }>;
  canCopy?: boolean;
};

/** Bolo à esquerda de «Proximos Eventos»; só renderiza se houver aniversariante hoje. */
export function HomeBirthdayTag({ aniversariantes, canCopy = false }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lastToggleAt = useRef(0);
  const people = aniversariantes
    .map((item) => item.full_name.trim())
    .filter(Boolean)
    .map((name) => ({ name, message: buildBirthdayGreetingMessage(name) }));

  if (people.length === 0) {
    return null;
  }

  const toggleOpen = () => {
    const now = Date.now();
    if (now - lastToggleAt.current < 400) {
      return;
    }
    lastToggleAt.current = now;
    setOpen((current) => !current);
  };

  const handleCopy = async (key: string, message: string) => {
    try {
      await Clipboard.setStringAsync(message);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1600);
    } catch {
      await appAlert('Copiar', 'Não foi possível copiar a mensagem.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Aniversariantes de hoje"
        accessibilityRole="button"
        hitSlop={8}
        onPress={toggleOpen}
        style={styles.iconWrap}
      >
        <FontAwesome color={MINIMAL_UI.accent} name="birthday-cake" size={28} />
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Aniversariantes de hoje</Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroll}
          >
            {people.map((person, index) => {
              const key = `${person.name}-${index}`;
              return (
                <View
                  key={key}
                  style={[styles.card, index === people.length - 1 ? styles.cardLast : null]}
                >
                  <Text style={styles.name}>{person.name}</Text>
                  <Text style={styles.message}>{person.message}</Text>
                  {canCopy ? (
                    <Pressable
                      accessibilityLabel={`Copiar mensagem de ${person.name}`}
                      accessibilityRole="button"
                      onPress={() => void handleCopy(key, person.message)}
                      style={styles.copyButton}
                    >
                      <FontAwesome
                        color={MINIMAL_UI.accent}
                        name={copiedKey === key ? 'check' : 'copy'}
                        size={14}
                      />
                      <Text style={styles.copyLabel}>
                        {copiedKey === key ? 'Copiado' : 'Copiar'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 8,
    flexShrink: 0,
    overflow: 'visible',
  },
  iconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 44,
    top: 0,
    minWidth: 240,
    maxWidth: 300,
    maxHeight: 280,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    gap: 8,
    zIndex: 12,
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  panelTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  panelScroll: {
    maxHeight: 230,
  },
  card: {
    gap: 6,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  cardLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  name: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    lineHeight: 18,
  },
  copyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  copyLabel: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
