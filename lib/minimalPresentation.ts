import { BIRTHDAYS_UI, VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/** Remove aparência de card (bordas, sombra, fundo escuro) no modo minimalista. */
export const MINIMAL_FLAT_PANEL: ViewStyle = {
  width: '100%',
  flex: 1,
  alignSelf: 'stretch',
  backgroundColor: MINIMAL_UI.background,
  borderWidth: 0,
  borderRadius: 0,
  shadowOpacity: 0,
  elevation: 0,
  paddingHorizontal: 8,
  paddingVertical: 4,
  alignItems: 'stretch',
  overflow: 'visible',
  minHeight: undefined,
  maxHeight: undefined,
};

export const MINIMAL_PAGE: ViewStyle = {
  width: '100%',
  flex: 1,
  backgroundColor: MINIMAL_UI.background,
};

/** Estilos de texto e superfície para painéis do dashboard em modo minimalista. */
export const MINIMAL_DASHBOARD_STYLES = StyleSheet.create({
  panelTitle: {
    color: MINIMAL_UI.text,
    textAlign: 'left',
  } satisfies TextStyle,
  sectionLabel: {
    color: MINIMAL_UI.textMuted,
  } satisfies TextStyle,
  summaryText: {
    color: MINIMAL_UI.textMuted,
  } satisfies TextStyle,
  listBox: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    shadowOpacity: 0,
    elevation: 0,
  } satisfies ViewStyle,
  emptyText: {
    color: MINIMAL_UI.textMuted,
  } satisfies TextStyle,
  headerCell: {
    color: MINIMAL_UI.textMuted,
  } satisfies TextStyle,
  nameText: {
    color: BIRTHDAYS_UI.nameText,
  } satisfies TextStyle,
  birthdayBadge: {
    backgroundColor: BIRTHDAYS_UI.dateBadgeBackground,
    borderColor: BIRTHDAYS_UI.border,
  } satisfies ViewStyle,
  birthdayBadgeText: {
    color: BIRTHDAYS_UI.dateText,
  } satisfies TextStyle,
  outlineButton: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  } satisfies ViewStyle,
  outlineButtonText: {
    color: MINIMAL_UI.text,
  } satisfies TextStyle,
  searchInput: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
  } satisfies TextStyle,
  radioRow: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  } satisfies ViewStyle,
  radioLabel: {
    color: MINIMAL_UI.text,
  } satisfies TextStyle,
  vigilanceScaleSectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
  } satisfies TextStyle,
  vigilanceScaleRadioRow: {
    backgroundColor: VIGILANCE_SCALES_UI.surface,
    borderColor: VIGILANCE_SCALES_UI.borderMuted,
  } satisfies ViewStyle,
  vigilanceScaleRadioRowSelected: {
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
    borderColor: VIGILANCE_SCALES_UI.border,
  } satisfies ViewStyle,
  vigilanceScaleRadioLabel: {
    color: VIGILANCE_SCALES_UI.accent,
  } satisfies TextStyle,
  filterLabel: {
    color: BIRTHDAYS_UI.accent,
  } satisfies TextStyle,
  birthdayMonthDropdown: {
    color: '#FFFFFF',
    backgroundColor: BIRTHDAYS_UI.monthDropdownBackground,
  } satisfies ViewStyle,
  birthdayMonthDropdownText: {
    color: BIRTHDAYS_UI.monthDropdownText,
    textAlign: 'center',
  } satisfies TextStyle,
});
