import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export type ScaleVolunteerSelectOption = {
  id: string;
  label: string;
};

type Props = {
  options: ScaleVolunteerSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
};

const webSelectStyle: Record<string, string | number> = {
  width: '100%',
  height: 44,
  color: '#F8FAFC',
  backgroundColor: '#0f172a',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#334155',
  borderRadius: 10,
  paddingLeft: 12,
  paddingRight: 12,
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  appearance: 'auto',
  WebkitAppearance: 'menulist',
};

export function ScaleVolunteerSelect({ options, value, onValueChange }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper}>
        {React.createElement(
          'select',
          {
            value: value || options[0]?.id || '',
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              onValueChange(event.target.value);
            },
            style: webSelectStyle,
            'aria-label': 'Selecionar servo',
          },
          options.map((option) =>
            React.createElement(
              'option',
              { key: option.id, value: option.id },
              option.label
            )
          )
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Picker
        selectedValue={value || options[0]?.id || ''}
        onValueChange={(nextValue) => onValueChange(String(nextValue))}
        dropdownIconColor="#F8FAFC"
        style={styles.picker}
        itemStyle={styles.pickerItem}
        mode="dropdown"
      >
        {options.map((option) => (
          <Picker.Item key={option.id} label={option.label} value={option.id} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  picker: {
    color: '#F8FAFC',
    height: 44,
  },
  pickerItem: {
    color: '#F8FAFC',
    fontSize: 14,
  },
});
