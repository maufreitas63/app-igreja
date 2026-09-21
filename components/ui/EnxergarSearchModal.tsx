import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Variant = 'default' | 'vigilance' | 'minimal';

type Props = {
  visible: boolean;
  title: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  countLabel?: string;
  onClose: () => void;
  variant?: Variant;
  children: React.ReactNode;
};

/**
 * Padrão Enxergar: lista filtrada em modal no topo, para ver o recorte enquanto digita.
 * O critério de busca fica no pai — este componente só apresenta.
 */
export function EnxergarSearchModal({
  visible,
  title,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  countLabel,
  onClose,
  variant = 'minimal',
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const listMaxHeight = Math.max(180, Math.round(Dimensions.get('window').height * 0.58));
  const isMinimal = variant === 'minimal';
  const isVigilance = variant === 'vigilance';
  const placeholderColor = isMinimal ? MINIMAL_UI.textMuted : isVigilance ? '#FFFFFF' : '#64748B';
  const iconColor = isMinimal ? MINIMAL_UI.icon : isVigilance ? '#FFFFFF' : '#94A3B8';

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar busca"
        />
        <KeyboardAvoidingView
          style={[
            styles.shell,
            { paddingTop: insets.top + 8, paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.card,
              isVigilance && styles.cardVigilance,
              isMinimal && styles.cardMinimal,
            ]}
          >
            <Text
              style={[
                styles.title,
                isVigilance && styles.titleVigilance,
                isMinimal && styles.titleMinimal,
              ]}
            >
              {title}
            </Text>
            <View
              style={[
                styles.searchRow,
                isVigilance && styles.searchRowVigilance,
                isMinimal && styles.searchRowMinimal,
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  isVigilance && styles.inputVigilance,
                  isMinimal && styles.inputMinimal,
                ]}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel={title}
              />
              {searchQuery.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => onSearchQueryChange('')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <FontAwesome name="times-circle" size={18} color={iconColor} />
                </TouchableOpacity>
              ) : null}
            </View>
            {countLabel ? (
              <Text
                style={[
                  styles.count,
                  isVigilance && styles.countVigilance,
                  isMinimal && styles.countMinimal,
                ]}
              >
                {countLabel}
              </Text>
            ) : null}
            <ScrollView
              style={[styles.scroll, { maxHeight: listMaxHeight }]}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
        <CloseFooterBar onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: Platform.select({
    web: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999998,
    },
    default: {
      flex: 1,
    },
  }),
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    zIndex: 0,
  },
  shell: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    gap: 8,
    paddingTop: 12,
  },
  cardVigilance: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: '#FFFFFF',
  },
  cardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  titleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  titleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  searchRow: {
    marginHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
  },
  searchRowVigilance: {
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  searchRowMinimal: {
    backgroundColor: MINIMAL_UI.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, boxShadow: 'none' } as object)
      : null),
  },
  inputVigilance: {
    color: '#FFFFFF',
  },
  inputMinimal: {
    color: MINIMAL_UI.text,
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  count: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  countVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  countMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  scroll: {
    paddingHorizontal: 10,
  },
  scrollContent: {
    gap: 6,
    padding: 6,
    paddingBottom: 12,
  },
});
