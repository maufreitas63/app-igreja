import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
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
  style?: StyleProp<ViewStyle>;
};

export function DropdownSelect({
  options,
  selectedValue,
  onValueChange,
  modalTitle = 'Selecionar',
  placeholder = 'Selecionar',
  style,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? placeholder;

  const handleSelect = (value: string) => {
    onValueChange(value);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={modalTitle}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <FontAwesome name="chevron-down" size={12} color="#94A3B8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
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
                    style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.optionText, isSelected && styles.optionTextSelected]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <FontAwesome name="check" size={14} color="#10b981" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    minWidth: 0,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
  },
  triggerText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  modalTitle: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  optionsScroll: {
    maxHeight: 320,
  },
  optionsContent: {
    gap: 6,
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
  optionButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  optionText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#ECFDF5',
    fontWeight: '800',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
});
