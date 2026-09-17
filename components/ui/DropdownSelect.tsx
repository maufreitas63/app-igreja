import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  options: readonly DropdownOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  modalTitle?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  /**
   * Padrão Enxergar: ao focar a busca, a lista filtrada abre em modal no topo
   * da tela para o usuário ver o recorte enquanto digita. Não altera o critério
   * de pesquisa (label local ou `onSearchQueryChange` remoto).
   */
  enxergar?: boolean;
  /** Dispara a cada alteração da busca (para pesquisa remota). */
  onSearchQueryChange?: (query: string) => void;
  /** Quando false, não filtra `options` no cliente — o pai já entregou o recorte. */
  filterOptionsLocally?: boolean;
  listLoading?: boolean;
  emptyListHint?: string;
  style?: StyleProp<ViewStyle>;
  triggerTextStyle?: StyleProp<TextStyle>;
  triggerIconColor?: string;
  size?: 'default' | 'comfortable' | 'compact';
  disabled?: boolean;
  /** Identidade visual clara (fundo branco, textos azuis). */
  variant?: 'default' | 'vigilance' | 'minimal';
};

const VIGILANCE_SURFACE = '#FFFFFF';
const VIGILANCE_ICON = '#1B4F8A';

const normalizeSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function DropdownSelect({
  options,
  selectedValue,
  onValueChange,
  modalTitle = 'Selecionar',
  placeholder = 'Selecionar',
  searchPlaceholder,
  searchable = false,
  enxergar = false,
  onSearchQueryChange,
  filterOptionsLocally = true,
  listLoading = false,
  emptyListHint,
  style,
  triggerTextStyle,
  triggerIconColor,
  size = 'default',
  disabled = false,
  variant = 'default',
}: DropdownSelectProps) {
  const isComfortable = size === 'comfortable';
  const isCompact = size === 'compact';
  const isVigilance = variant === 'vigilance';
  const isMinimal = variant === 'minimal';
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get('window').height;
  const enxergarListMaxHeight = Math.max(180, Math.round(windowHeight * 0.58));
  const enxergarInputRef = useRef<TextInput>(null);
  const resolvedTriggerIconColor =
    triggerIconColor
    ?? (isMinimal ? MINIMAL_UI.icon : isVigilance ? '#FFFFFF' : '#94A3B8');
  const selectedCheckColor = isMinimal
    ? MINIMAL_UI.accent
    : isVigilance
      ? VIGILANCE_ICON
      : '#10b981';
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? '';

  const filteredOptions = useMemo(() => {
    if (!searchable || !filterOptionsLocally) {
      return options;
    }

    const query = normalizeSearch(searchQuery);
    if (!query) {
      return options;
    }

    return options.filter((option) => normalizeSearch(option.label).includes(query));
  }, [filterOptionsLocally, options, searchQuery, searchable]);

  const clearBlurTimer = () => {
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  };

  useEffect(() => () => clearBlurTimer(), []);

  useEffect(() => {
    if (!enxergar || !open) {
      return;
    }

    const timer = setTimeout(() => {
      enxergarInputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [enxergar, open]);

  const handleSelect = (value: string) => {
    clearBlurTimer();
    onValueChange(value);
    setSearchQuery('');
    setOpen(false);
  };

  const handleOpenSearch = () => {
    if (disabled) {
      return;
    }

    clearBlurTimer();
    setOpen(true);
    // Não pré-filtra pelo rótulo selecionado — senão a lista some e fica “só um tipo”.
    setSearchQuery('');
  };

  const scheduleCloseSearch = () => {
    if (enxergar) {
      return;
    }

    clearBlurTimer();
    blurCloseTimerRef.current = setTimeout(() => {
      setOpen(false);
      setSearchQuery('');
      blurCloseTimerRef.current = null;
    }, 180);
  };

  if (searchable) {
    const inputPlaceholder = searchPlaceholder ?? placeholder;
    const triggerValue = selectedValue ? selectedLabel : '';
    const inputValue = open && !enxergar ? searchQuery : triggerValue;
    const hasTriggerValue = triggerValue.trim().length > 0;
    const placeholderColor = isMinimal ? MINIMAL_UI.textMuted : isVigilance ? '#FFFFFF' : '#64748B';
    const iconColor = isMinimal ? MINIMAL_UI.icon : isVigilance ? '#FFFFFF' : '#94A3B8';

    const handleClearInput = () => {
      clearBlurTimer();
      setSearchQuery('');
      onSearchQueryChange?.('');

      if (selectedValue) {
        onValueChange('');
      }

      setOpen(true);
    };

    const handleCloseSearch = () => {
      clearBlurTimer();
      setOpen(false);
      setSearchQuery('');
    };

    const renderFilteredList = () => {
      if (listLoading) {
        return (
          <View style={styles.searchableLoadingRow}>
            <ActivityIndicator size="small" color={iconColor} />
            <Text
              style={[
                styles.emptySearchText,
                isVigilance && styles.emptySearchTextVigilance,
                isMinimal && styles.emptySearchTextMinimal,
              ]}
            >
              Buscando...
            </Text>
          </View>
        );
      }

      if (!filteredOptions.length) {
        return (
          <Text
            style={[
              styles.emptySearchText,
              isVigilance && styles.emptySearchTextVigilance,
              isMinimal && styles.emptySearchTextMinimal,
            ]}
          >
            {emptyListHint ?? 'Nenhum resultado para a busca.'}
          </Text>
        );
      }

      return filteredOptions.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              isVigilance && styles.optionButtonVigilance,
              isMinimal && styles.optionButtonMinimal,
              isSelected && styles.optionButtonSelected,
              isSelected && isVigilance && styles.optionButtonSelectedVigilance,
              isSelected && isMinimal && styles.optionButtonSelectedMinimal,
            ]}
            onPress={() => handleSelect(option.value)}
            onPressIn={clearBlurTimer}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.optionText,
                isVigilance && styles.optionTextVigilance,
                isMinimal && styles.optionTextMinimal,
                isSelected && styles.optionTextSelected,
                isSelected && isVigilance && styles.optionTextSelectedVigilance,
                isSelected && isMinimal && styles.optionTextSelectedMinimal,
              ]}
              numberOfLines={2}
            >
              {option.label}
            </Text>
            {isSelected ? <FontAwesome name="check" size={14} color={selectedCheckColor} /> : null}
          </TouchableOpacity>
        );
      });
    };

    return (
      <View style={[styles.searchableRoot, style]}>
        <View
          style={[
            styles.searchableTrigger,
            isVigilance && styles.searchableTriggerVigilance,
            isMinimal && styles.searchableTriggerMinimal,
            disabled && styles.triggerDisabled,
          ]}
        >
          {enxergar ? (
            <Pressable
              style={styles.searchableEnxergarTrigger}
              onPress={handleOpenSearch}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={modalTitle}
            >
              <Text
                style={[
                  styles.searchableInput,
                  isVigilance && styles.searchableInputVigilance,
                  isMinimal && styles.searchableInputMinimal,
                  !hasTriggerValue && styles.searchablePlaceholder,
                  !hasTriggerValue && isMinimal && styles.searchablePlaceholderMinimal,
                ]}
                numberOfLines={1}
              >
                {hasTriggerValue ? triggerValue : inputPlaceholder}
              </Text>
            </Pressable>
          ) : (
            <TextInput
              style={[
                styles.searchableInput,
                isVigilance && styles.searchableInputVigilance,
                isMinimal && styles.searchableInputMinimal,
              ]}
              value={inputValue}
              onChangeText={(text) => {
                setSearchQuery(text);
                setOpen(true);
                onSearchQueryChange?.(text);
              }}
              onFocus={handleOpenSearch}
              onBlur={scheduleCloseSearch}
              placeholder={inputPlaceholder}
              placeholderTextColor={placeholderColor}
              editable={!disabled}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel={modalTitle}
            />
          )}
          {hasTriggerValue ? (
            <TouchableOpacity
              style={styles.searchableClearButton}
              onPress={handleClearInput}
              onPressIn={clearBlurTimer}
              activeOpacity={0.85}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Limpar seleção"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome name="times-circle" size={18} color={iconColor} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (open) {
                handleCloseSearch();
                return;
              }

              handleOpenSearch();
            }}
            activeOpacity={0.85}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Fechar lista' : 'Abrir lista'}
          >
            <FontAwesome name={open ? 'chevron-up' : 'chevron-down'} size={12} color={iconColor} />
          </TouchableOpacity>
        </View>

        {open && !enxergar ? (
          <View
            style={[
              styles.searchablePanel,
              isVigilance && styles.searchablePanelVigilance,
              isMinimal && styles.searchablePanelMinimal,
            ]}
          >
            <ScrollView
              style={styles.searchableScroll}
              contentContainerStyle={styles.optionsContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {renderFilteredList()}
            </ScrollView>
          </View>
        ) : null}

        {enxergar ? (
          <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={handleCloseSearch}
            statusBarTranslucent
          >
            <View style={styles.enxergarRoot}>
              <Pressable
                style={styles.enxergarBackdropFill}
                onPress={handleCloseSearch}
                accessibilityRole="button"
                accessibilityLabel="Fechar busca"
              />
              <KeyboardAvoidingView
                style={[
                  styles.enxergarShell,
                  { paddingTop: insets.top + 8, paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT },
                ]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                pointerEvents="box-none"
              >
                <View
                  style={[
                    styles.enxergarCard,
                    isVigilance && styles.modalCardVigilance,
                    isMinimal && styles.modalCardMinimal,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      isVigilance && styles.modalTitleVigilance,
                      isMinimal && styles.modalTitleMinimal,
                    ]}
                  >
                    {modalTitle}
                  </Text>
                  <View
                    style={[
                      styles.searchableTrigger,
                      styles.enxergarSearchRow,
                      isVigilance && styles.searchableTriggerVigilance,
                      isMinimal && styles.searchableTriggerMinimal,
                    ]}
                  >
                    <TextInput
                      ref={enxergarInputRef}
                      style={[
                        styles.searchableInput,
                        isVigilance && styles.searchableInputVigilance,
                        isMinimal && styles.searchableInputMinimal,
                      ]}
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        onSearchQueryChange?.(text);
                      }}
                      placeholder={inputPlaceholder}
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="words"
                      autoCorrect={false}
                      accessibilityLabel={modalTitle}
                    />
                    {searchQuery.trim().length > 0 ? (
                      <TouchableOpacity
                        style={styles.searchableClearButton}
                        onPress={() => {
                          setSearchQuery('');
                          onSearchQueryChange?.('');
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Limpar busca"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome name="times-circle" size={18} color={iconColor} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.enxergarCount,
                      isVigilance && styles.emptySearchTextVigilance,
                      isMinimal && styles.emptySearchTextMinimal,
                    ]}
                  >
                    {listLoading
                      ? 'Buscando...'
                      : `${filteredOptions.length} de ${options.length}`}
                  </Text>
                  <ScrollView
                    style={[styles.enxergarScroll, { maxHeight: enxergarListMaxHeight }]}
                    contentContainerStyle={styles.optionsContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                  >
                    {renderFilteredList()}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
              <CloseFooterBar onPress={handleCloseSearch} />
            </View>
          </Modal>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          isComfortable && styles.triggerComfortable,
          isCompact && styles.triggerCompact,
          isVigilance && styles.triggerVigilance,
          isMinimal && styles.triggerMinimal,
          disabled && styles.triggerDisabled,
          style,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={modalTitle}
        accessibilityState={{ expanded: open, disabled }}
      >
        <Text
          style={StyleSheet.flatten([
            styles.triggerText,
            isComfortable && styles.triggerTextComfortable,
            isCompact && styles.triggerTextCompact,
            isVigilance && styles.triggerTextVigilance,
            isMinimal && styles.triggerTextMinimal,
            triggerTextStyle,
          ])}
          numberOfLines={1}
        >
          {selectedLabel || placeholder}
        </Text>
        <FontAwesome name="chevron-down" size={12} color={resolvedTriggerIconColor} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[
            styles.backdrop,
            isVigilance && styles.backdropVigilance,
            isMinimal && styles.backdropMinimal,
          ]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              isVigilance && styles.modalCardVigilance,
              isMinimal && styles.modalCardMinimal,
            ]}
            onPress={() => undefined}
          >
            <Text
              style={[
                styles.modalTitle,
                isVigilance && styles.modalTitleVigilance,
                isMinimal && styles.modalTitleMinimal,
              ]}
            >
              {modalTitle}
            </Text>
            <ScrollView
              style={styles.optionsScroll}
              contentContainerStyle={styles.optionsContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => {
                const isSelected = option.value === selectedValue;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isVigilance && styles.optionButtonVigilance,
                      isMinimal && styles.optionButtonMinimal,
                      isSelected && styles.optionButtonSelected,
                      isSelected && isVigilance && styles.optionButtonSelectedVigilance,
                      isSelected && isMinimal && styles.optionButtonSelectedMinimal,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isVigilance && styles.optionTextVigilance,
                        isMinimal && styles.optionTextMinimal,
                        isSelected && styles.optionTextSelected,
                        isSelected && isVigilance && styles.optionTextSelectedVigilance,
                        isSelected && isMinimal && styles.optionTextSelectedMinimal,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <FontAwesome name="check" size={14} color={selectedCheckColor} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <CloseFooterBar onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  searchableRoot: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    position: 'relative',
    zIndex: 20,
  },
  searchableEnxergarTrigger: {
    flex: 1,
    minWidth: 0,
  },
  searchablePlaceholder: {
    color: '#64748B',
    fontWeight: '600',
  },
  searchablePlaceholderMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  searchableTrigger: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
  },
  searchableTriggerVigilance: {
    borderColor: '#1B4F8A',
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  searchableTriggerMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  searchableInput: {
    flex: 1,
    minWidth: 0,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  searchableInputVigilance: {
    color: '#FFFFFF',
  },
  searchableInputMinimal: {
    color: MINIMAL_UI.text,
  },
  searchableClearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  searchablePanel: {
    marginTop: 6,
    maxHeight: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  searchablePanelVigilance: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
  },
  searchablePanelMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  searchableScroll: {
    maxHeight: 240,
  },
  enxergarRoot: Platform.select({
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
  enxergarBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    zIndex: 0,
  },
  enxergarShell: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  enxergarCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    gap: 8,
    paddingTop: 12,
  },
  enxergarSearchRow: {
    marginHorizontal: 12,
  },
  enxergarCount: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  enxergarScroll: {
    paddingHorizontal: 10,
  },
  searchableLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  emptySearchText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  emptySearchTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  emptySearchTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerVigilance: {
    borderColor: '#1B4F8A',
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  triggerMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  triggerComfortable: {
    minHeight: 52,
    paddingVertical: 14,
  },
  triggerCompact: {
    flex: 0,
    flexGrow: 0,
    alignSelf: 'flex-start',
    minHeight: 31,
    paddingVertical: 6,
    borderRadius: 999,
    borderColor: '#CBD5E1',
    backgroundColor: '#E2E8F0',
  },
  triggerDisabled: {
    opacity: 0.55,
  },
  triggerText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  triggerTextVigilance: {
    color: '#FFFFFF',
  },
  triggerTextMinimal: {
    color: MINIMAL_UI.text,
  },
  triggerTextComfortable: {
    fontSize: 16,
    lineHeight: 22,
  },
  triggerTextCompact: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT,
  },
  backdropVigilance: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  backdropMinimal: {
    backgroundColor: 'rgba(30, 64, 175, 0.28)',
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingTop: 16,
    paddingHorizontal: 0,
    overflow: 'hidden',
    gap: 12,
  },
  modalCardVigilance: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
  },
  modalCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  modalTitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  modalTitleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  modalTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  optionsScroll: {
    maxHeight: 320,
    paddingHorizontal: 16,
  },
  optionsContent: {
    gap: 6,
    padding: 6,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionButtonVigilance: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
  },
  optionButtonMinimal: {
    borderColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  optionButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  optionButtonSelectedVigilance: {
    borderColor: VIGILANCE_ICON,
    backgroundColor: '#F0F9FF',
  },
  optionButtonSelectedMinimal: {
    borderColor: MINIMAL_UI.accent,
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  optionTextMinimal: {
    color: MINIMAL_UI.text,
  },
  optionTextSelected: {
    color: '#ECFDF5',
    fontWeight: '800',
  },
  optionTextSelectedVigilance: {
    color: VIGILANCE_ICON,
    fontWeight: '800',
  },
  optionTextSelectedMinimal: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButtonVigilance: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
  },
  closeButtonMinimal: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButtonTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  closeButtonTextMinimal: {
    color: MINIMAL_UI.accent,
  },
});
