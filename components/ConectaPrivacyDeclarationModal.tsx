import { CloseButton } from '@/components/minimal/CloseFooterBar';
import {
  CONECTA_PRIVACY_DECLARATION,
  CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL,
} from '@/lib/conectaPrivacyDeclaration';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ITALIC_PHRASES = [
  'privacy by design',
  'matching',
  'fail-closed',
  'super admin shield',
];

function italicized(text: string) {
  const parts: { text: string; italic: boolean }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let nextIndex = -1;
    let nextPhrase = '';
    for (const phrase of ITALIC_PHRASES) {
      const index = remaining.indexOf(phrase);
      if (index >= 0 && (nextIndex < 0 || index < nextIndex)) {
        nextIndex = index;
        nextPhrase = phrase;
      }
    }

    if (nextIndex < 0 || !nextPhrase) {
      parts.push({ text: remaining, italic: false });
      break;
    }

    if (nextIndex > 0) {
      parts.push({ text: remaining.slice(0, nextIndex), italic: false });
    }
    parts.push({ text: nextPhrase, italic: true });
    remaining = remaining.slice(nextIndex + nextPhrase.length);
  }

  return parts.map((part, index) => (
    <Text key={`${part.text}-${index}`} style={part.italic ? styles.italic : undefined}>
      {part.text}
    </Text>
  ));
}

export function ConectaPrivacyDeclarationModal({ visible, onClose }: Props) {
  const declaration = CONECTA_PRIVACY_DECLARATION;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator
        >
          <Text
            style={styles.docTitle}
            accessibilityRole="header"
            accessibilityLabel={CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL}
          >
            {declaration.title}
          </Text>
          <Text style={styles.subtitle}>{declaration.subtitle}</Text>

          {declaration.intro.map((paragraph) => (
            <Text key={paragraph.slice(0, 48)} style={styles.paragraph}>
              {italicized(paragraph)}
            </Text>
          ))}

          {declaration.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.paragraph}>{italicized(section.lead)}</Text>
              <Text style={styles.paragraph}>
                <Text style={styles.label}>A Regra do Sistema: </Text>
                {italicized(section.regra)}
              </Text>
              <Text style={styles.paragraph}>
                <Text style={styles.label}>Inviolabilidade: </Text>
                {italicized(section.inviolabilidade)}
              </Text>
            </View>
          ))}

          <Text style={styles.closing}>{italicized(declaration.closing)}</Text>
        </ScrollView>
        <View style={styles.footer}>
          <CloseButton onPress={onClose} accessibilityLabel="Fechar declaração de privacidade" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  docTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  subtitle: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  paragraph: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    lineHeight: 22,
  },
  italic: {
    fontStyle: 'italic',
  },
  section: {
    gap: 8,
    paddingTop: 8,
  },
  sectionTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  label: {
    color: MINIMAL_UI.blueDark,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  closing: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
});
