import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
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
  style?: StyleProp<ViewStyle>;
  triggerTextStyle?: StyleProp<TextStyle>;
  triggerIconColor?: string;
  size?: 'default' | 'comfortable' | 'compact';
  disabled?: boolean;
  /** Identidade visual clara (fundo branco, textos azuis). */
  variant?: 'default' | 'vigilance';
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
  const resolvedTriggerIconColor =
    triggerIconColor ?? (isVigilance ? VIGILANCE_ICON : '#94A3B8');
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? '';

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }

    const query = normalizeSearch(searchQuery);
    if (!query) {
      return options;
    }

    return options.filter((option) => normalizeSearch(option.label).includes(query));
  }, [options, searchQuery, searchable]);

  const clearBlurTimer = () => {
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  };

  useEffect(() => () => clearBlurTimer(), []);

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
    setSearchQuery(selectedValue ? selectedLabel : '');
  };

  const scheduleCloseSearch = () => {
    clearBlurTimer();
    blurCloseTimerRef.current = setTimeout(() => {
      setOpen(false);
      setSearchQuery('');
      blurCloseTimerRef.current = null;
    }, 180);
  };

  if (searchable) {
    const inputPlaceholder = searchPlaceholder ?? placeholder;
    const inputValue = open ? searchQuery : selectedValue ? selectedLabel : '';
    const hasInputValue = inputValue.trim().length > 0;

    const handleClearInput = () => {
      clearBlurTimer();
      setSearchQuery('');

      if (selectedValue) {
        onValueChange('');
      }

      setOpen(true);
    };

    return (
      <View style={[styles.searchableRoot, style]}>
        <View
          style={[
            styles.searchableTrigger,
            isVigilance && styles.searchableTriggerVigilance,
            disabled && styles.triggerDisabled,
          ]}
        >
          <TextInput
            style={[styles.searchableInput, isVigilance && styles.searchableInputVigilance]}
            value={inputValue}
            onChangeText={(text) => {
              setSearchQuery(text);
              setOpen(true);
            }}
            onFocus={handleOpenSearch}
            onBlur={scheduleCloseSearch}
            placeholder={inputPlaceholder}
            placeholderTextColor={isVigilance ? VIGILANCE_SCALES_UI.accent : '#64748B'}
            editable={!disabled}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={modalTitle}
          />
          {hasInputValue ? (
            <TouchableOpacity
              style={styles.searchableClearButton}
              onPress={handleClearInput}
              onPressIn={clearBlurTimer}
              activeOpacity={0.85}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Limpar usuário selecionado"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome
                name="times-circle"
                size={18}
                color={isVigilance ? VIGILANCE_ICON : '#94A3B8'}
              />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (open) {
                clearBlurTimer();
                setOpen(false);
                setSearchQuery('');
                return;
              }

              handleOpenSearch();
            }}
            activeOpacity={0.85}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Fechar lista' : 'Abrir lista'}
          >
            <FontAwesome
              name={open ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={isVigilance ? VIGILANCE_ICON : '#94A3B8'}
            />
          </TouchableOpacity>
        </View>

        {open ? (
          <View style={[styles.searchablePanel, isVigilance && styles.searchablePanelVigilance]}>
            <ScrollView
              style={styles.searchableScroll}
              contentContainerStyle={styles.optionsContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {filteredOptions.length ? (
                filteredOptions.map((option) => {
                  const isSelected = option.value === selectedValue;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        isVigilance && styles.optionButtonVigilance,
                        isSelected && styles.optionButtonSelected,
                        isSelected && isVigilance && styles.optionButtonSelectedVigilance,
                      ]}
                      onPress={() => handleSelect(option.value)}
                      onPressIn={clearBlurTimer}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isVigilance && styles.optionTextVigilance,
                          isSelected && styles.optionTextSelected,
                          isSelected && isVigilance && styles.optionTextSelectedVigilance,
                        ]}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                      {isSelected ? (
                        <FontAwesome
                          name="check"
                          size={14}
                          color={isVigilance ? VIGILANCE_ICON : '#10b981'}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptySearchText, isVigilance && styles.emptySearchTextVigilance]}>
                  Nenhum resultado para a busca.
                </Text>
              )}
            </ScrollView>
          </View>
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
          style={[styles.backdrop, isVigilance && styles.backdropVigilance]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[styles.modalCard, isVigilance && styles.modalCardVigilance]}
            onPress={() => undefined}
          >
            <Text style={[styles.modalTitle, isVigilance && styles.modalTitleVigilance]}>
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
                      isSelected && styles.optionButtonSelected,
                      isSelected && isVigilance && styles.optionButtonSelectedVigilance,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isVigilance && styles.optionTextVigilance,
                        isSelected && styles.optionTextSelected,
                        isSelected && isVigilance && styles.optionTextSelectedVigilance,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <FontAwesome
                        name="check"
                        size={14}
                        color={isVigilance ? VIGILANCE_ICON : '#10b981'}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.closeButton, isVigilance && styles.closeButtonVigilance]}
              onPress={() => setOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.closeButtonText, isVigilance && styles.closeButtonTextVigilance]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  searchableRoot: {
    width: '100%',
    position: 'relative',
    zIndex: 20,
  },
  searchableTrigger: {
    width: '100%',
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
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
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
    color: VIGILANCE_SCALES_UI.accent,
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
  searchableScroll: {
    maxHeight: 240,
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
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
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
    color: VIGILANCE_SCALES_UI.accent,
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
  },
  backdropVigilance: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    padding: 16,
    gap: 12,
  },
  modalCardVigilance: {
    borderColor: VIGILANCE_SCALES_UI.accent,
    backgroundColor: VIGILANCE_SURFACE,
  },
  modalTitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  modalTitleVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
  optionsScroll: {
    maxHeight: 320,
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
  optionButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  optionButtonSelectedVigilance: {
    borderColor: VIGILANCE_ICON,
    backgroundColor: '#F0F9FF',
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
  optionTextSelected: {
    color: '#ECFDF5',
    fontWeight: '800',
  },
  optionTextSelectedVigilance: {
    color: VIGILANCE_ICON,
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
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButtonTextVigilance: {
    color: VIGILANCE_SCALES_UI.accent,
  },
});
