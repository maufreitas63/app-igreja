import { MINIMAL_SWITCH_THUMB, MINIMAL_SWITCH_TRACK } from '@/lib/minimalUiTheme';
import React from 'react';
import { Switch, type SwitchProps } from 'react-native';

/** Switch do aplicativo: ligado azul `#1D4ED8`, desligado cinza, botão branco. */
export function AppSwitch(props: SwitchProps) {
  return (
    <Switch
      {...props}
      trackColor={MINIMAL_SWITCH_TRACK}
      thumbColor={MINIMAL_SWITCH_THUMB}
      ios_backgroundColor={props.ios_backgroundColor ?? MINIMAL_SWITCH_TRACK.false}
    />
  );
}
