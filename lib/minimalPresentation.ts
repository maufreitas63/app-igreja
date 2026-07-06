import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ViewStyle } from 'react-native';

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
