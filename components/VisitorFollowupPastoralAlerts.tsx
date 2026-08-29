import { usePastorVisitorFollowup } from '@/hooks/useVisitorFollowup';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  formatVisitorFollowupDate,
  hasVisitorFollowupPhone,
  type VisitorFollowupTask,
} from '@/lib/visitorFollowupApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  minimal?: boolean;
};

export function VisitorFollowupPastoralAlerts({ isActive = true, minimal = false }: Props) {
  const { alerts, loading, error, completingId, completeTask } = usePastorVisitorFollowup(isActive);

  if (!isActive) {
    return null;
  }

  if (loading && !alerts.length && !error) {
    return null;
  }

  if (!alerts.length && !error) {
    return null;
  }

  const handleContact = (alert: VisitorFollowupTask) => {
    if (!alert.phone) {
      Toast.show({
        type: 'error',
        text1: 'Telefone indisponível',
        text2: 'Este visitante não tem telefone cadastrado.',
      });
      return;
    }

    const message = `Olá, ${formatShortName(alert.visitorName).split(' ')[0]}! Aqui é da equipe pastoral. Gostaríamos de saber como você está e se podemos ajudar em algo.`;
    const opened = openWhatsAppLikeBirthdaysWithText(alert.phone, message);

    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o contato.',
      });
    }
  };

  const handleComplete = async (alert: VisitorFollowupTask) => {
    const confirmed = await confirmDialog(
      'Encerrar alerta',
      `Registrar a ligação a ${formatShortName(alert.visitorName)} e encerrar a régua?`,
      'Encerrar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    const result = await completeTask(alert.id);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Acolhimento pastoral',
      text2: result.success ? 'Alerta encerrado.' : result.message,
    });
  };

  return (
    <View style={[styles.wrap, minimal && styles.wrapMinimal]}>
      <Text style={[styles.title, minimal && styles.titleMinimal]}>
        Visitantes sem retorno
      </Text>
      {error ? (
        <Text style={[styles.error, minimal && styles.errorMinimal]}>{error}</Text>
      ) : null}
      {alerts.map((alert) => {
        const busy = completingId === alert.id;
        const canWhatsApp = hasVisitorFollowupPhone(alert.phone);

        return (
          <View key={alert.id} style={[styles.card, minimal && styles.cardMinimal]}>
            <View style={styles.cardHeader}>
              <Text
                style={[styles.name, minimal && styles.nameMinimal]}
                numberOfLines={1}
              >
                {formatShortName(alert.visitorName)}
              </Text>
              <Text style={[styles.date, minimal && styles.dateMinimal]}>
                Aprovado em {formatVisitorFollowupDate(alert.dataAprovacao)}
              </Text>
            </View>
            <Text style={[styles.desc, minimal && styles.descMinimal]}>{alert.descricao}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.contactBtn, !canWhatsApp && styles.contactBtnDisabled]}
                onPress={() => handleContact(alert)}
                disabled={!canWhatsApp}
                activeOpacity={0.85}
                accessibilityLabel={canWhatsApp ? 'Contatar visitante' : 'Telefone indisponível'}
              >
                <FontAwesome
                  name="whatsapp"
                  size={16}
                  color={canWhatsApp ? (minimal ? '#16A34A' : '#4ADE80') : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.contactLabel,
                    minimal && styles.contactLabelMinimal,
                    !canWhatsApp && styles.contactLabelDisabled,
                  ]}
                >
                  Contatar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, minimal && styles.doneBtnMinimal]}
                onPress={() => void handleComplete(alert)}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.blueDark : '#FFF'} />
                ) : (
                  <Text style={[styles.doneLabel, minimal && styles.doneLabelMinimal]}>
                    Ligação feita
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 10,
  },
  wrapMinimal: {
    backgroundColor: MINIMAL_UI.background,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FBBF24',
    textAlign: 'center',
  },
  titleMinimal: {
    color: '#B45309',
  },
  error: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  errorMinimal: {
    color: '#DC2626',
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(120, 53, 15, 0.18)',
  },
  cardMinimal: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '800',
  },
  nameMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  date: {
    color: 'rgba(253, 230, 138, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  dateMinimal: {
    color: '#B45309',
  },
  desc: {
    color: '#FEF3C7',
    fontSize: 12,
    lineHeight: 17,
  },
  descMinimal: {
    color: MINIMAL_UI.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  contactLabel: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '700',
  },
  contactLabelMinimal: {
    color: '#15803D',
  },
  contactBtnDisabled: {
    opacity: 0.45,
  },
  contactLabelDisabled: {
    color: '#94A3B8',
  },
  doneBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    minWidth: 108,
    alignItems: 'center',
  },
  doneBtnMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  doneLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  doneLabelMinimal: {
    color: MINIMAL_UI.blueDark,
  },
});
