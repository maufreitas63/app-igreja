import { appAlert } from '@/lib/appAlert';
import { buildBirthdayGreetingMessage } from '@/lib/birthdayGreetingAccess';
import { boxShadowStyle } from '@/lib/boxShadow';
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
  const [copied, setCopied] = useState(false);
  const lastToggleAt = useRef(0);
  const names = aniversariantes.map((item) => item.full_name.trim()).filter(Boolean);

  if (names.length === 0) {
    return null;
  }

  const message = buildBirthdayGreetingMessage(names);

  const toggleOpen = () => {
    const now = Date.now();
    if (now - lastToggleAt.current < 400) {
      return;
    }
    lastToggleAt.current = now;
    setOpen((current) => !current);
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
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
            contentContainerStyle={styles.panelScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.panelScroll}
          >
            {names.map((name, index) => (
              <Text key={`${name}-${index}`} style={styles.name}>
                {name}
              </Text>
            ))}
            <Text style={styles.message}>{message}</Text>
            <View style={styles.actions}>
              {canCopy ? (
                <Pressable
                  accessibilityLabel="Copiar mensagem dos aniversariantes"
                  accessibilityRole="button"
                  onPress={() => void handleCopy()}
                  style={styles.actionButton}
                >
                  <FontAwesome
                    color={MINIMAL_UI.accent}
                    name={copied ? 'check' : 'copy'}
                    size={14}
                  />
                  <Text style={styles.actionLabel}>{copied ? 'Copiado' : 'Copiar'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel="Fechar aniversariantes"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.actionButton}
              >
                <FontAwesome color={MINIMAL_UI.accent} name="times" size={14} />
                <Text style={styles.actionLabel}>Fechar</Text>
              </Pressable>
            </View>
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
    ...boxShadowStyle({
      color: '#0F172A',
      offsetY: 4,
      blurRadius: 10,
      opacity: 0.16,
      elevation: 12,
    }),
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
  panelScrollContent: {
    gap: 6,
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
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    minWidth: 73,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  actionLabel: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
