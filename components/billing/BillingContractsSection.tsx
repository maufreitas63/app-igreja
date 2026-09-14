import { CenteredCloseDialog } from '@/components/minimal/CenteredCloseDialog';
import { formatBillingSaasContractNumber } from '@/lib/billing/contractNumber';
import type { BillingSaasContract } from '@/lib/billing/types';
import { getEffectiveUserPhone } from '@/lib/loadSessionProfile';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  openWhatsAppLikeBirthdaysWithText,
  openWhatsAppShareText,
} from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

const WHATSAPP_TEXT_LIMIT = 3500;

function formatPtDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function eventLabel(eventType: string) {
  return eventType === 'renovacao' ? 'Renovação' : 'Contratação';
}

function contractNumberLabel(item: BillingSaasContract) {
  const stored = String(item.contractNumber ?? '').trim();
  if (stored) return stored;
  return formatBillingSaasContractNumber(item.licensedInstanceCode, item.sequenceNumber);
}

function buildWhatsAppContractCopy(item: BillingSaasContract) {
  const number = contractNumberLabel(item);
  const body = item.body.trim();
  if (body.length <= WHATSAPP_TEXT_LIMIT) {
    return body;
  }

  return (
    `${body.slice(0, WHATSAPP_TEXT_LIMIT).trim()}\n\n` +
    `[Trecho do contrato nº ${number}] O texto integral foi copiado. Cole nesta conversa para guardar a cópia completa.`
  );
}

function ContractParagraph({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const isTitle = trimmed.startsWith('CONTRATO DE LICENCIAMENTO');
  const isClause = trimmed.startsWith('CLÁUSULA ');
  const isMeta = trimmed.startsWith('Contrato nº') || trimmed.startsWith('Data da aceitação');

  return (
    <Text
      style={[
        styles.paragraph,
        isTitle && styles.contractTitle,
        isClause && styles.clauseTitle,
        isMeta && styles.metaLine,
      ]}
    >
      {trimmed}
    </Text>
  );
}

type Props = {
  contracts: BillingSaasContract[];
};

export function BillingContractsSection({ contracts }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [clickerPhone, setClickerPhone] = useState<string | null>(null);
  const selected = useMemo(
    () => contracts.find((item) => item.id === openId) ?? null,
    [contracts, openId]
  );

  useEffect(() => {
    let cancelled = false;
    void getEffectiveUserPhone().then((phone) => {
      if (!cancelled) {
        setClickerPhone(phone);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sendContractCopy = (item: BillingSaasContract) => {
    const number = contractNumberLabel(item);
    void Clipboard.setStringAsync(item.body);
    const message = buildWhatsAppContractCopy(item);
    const opened = clickerPhone
      ? openWhatsAppLikeBirthdaysWithText(clickerPhone, message)
      : openWhatsAppShareText(message);

    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o WhatsApp com a cópia do contrato.',
      });
      return;
    }

    Toast.show({
      type: 'success',
      text1: `Contrato ${number}`,
      text2: clickerPhone
        ? 'Cópia aberta no seu WhatsApp. Se o texto vier cortado, cole o contrato completo.'
        : 'WhatsApp aberto com a cópia. Escolha o chat para enviar.',
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Gerenciamento de Contratos</Text>
      <Text style={styles.sectionHint}>
        Cada instância tem numeração própria (código da igreja + sequência). O instrumento fica
        gravado na aceitação eletrônica; envie uma cópia pelo WhatsApp quando precisar.
      </Text>

      {contracts.length === 0 ? (
        <Text style={styles.empty}>
          Ainda não há contrato finalizado. O instrumento é gravado quando a contratação ou a
          renovação trimestral é confirmada.
        </Text>
      ) : (
        <View style={styles.list}>
          {contracts.map((item) => {
            const number = contractNumberLabel(item);
            return (
              <View key={item.id} style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
                  onPress={() => setOpenId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir contrato ${number} ${item.planName}`}
                >
                  <Text style={styles.rowTitle}>
                    Contrato {number} · {eventLabel(item.eventType)}
                  </Text>
                  <Text style={styles.rowPlan}>
                    Plano {item.planName}
                    {item.planType ? ` — ${item.planType}` : ''}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Ciclo {formatPtDate(item.periodStart)} a {formatPtDate(item.periodEnd)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => sendContractCopy(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Enviar cópia do contrato ${number} no WhatsApp`}
                  hitSlop={8}
                  style={styles.rowWhatsapp}
                >
                  <FontAwesome name="whatsapp" size={22} color="#25D366" />
                </Pressable>
                <Pressable
                  onPress={() => setOpenId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir contrato ${number}`}
                  hitSlop={8}
                >
                  <Text style={styles.rowOpen}>Abrir</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <CenteredCloseDialog
        visible={selected != null}
        onClose={() => setOpenId(null)}
        title={selected ? `Contrato ${contractNumberLabel(selected)}` : 'Contrato'}
        subtitle={
          selected ? `${eventLabel(selected.eventType)} · ${selected.planName}` : null
        }
        accessibilityCloseLabel="Fechar contrato"
        footerExtra={
          selected ? (
            <Pressable
              onPress={() => sendContractCopy(selected)}
              accessibilityRole="button"
              accessibilityLabel={`Enviar cópia do contrato ${contractNumberLabel(selected)} no WhatsApp`}
              style={({ pressed }) => [styles.whatsappSend, pressed && styles.whatsappSendPressed]}
            >
              <FontAwesome name="whatsapp" size={18} color="#FFFFFF" />
              <Text style={styles.whatsappSendText}>Enviar cópia no WhatsApp</Text>
            </Pressable>
          ) : null
        }
      >
        {selected ? (
          <View style={styles.contractBody}>
            {selected.body.split(/\n+/).map((block, index) => (
              <ContractParagraph key={`${selected.id}-${index}`} text={block} />
            ))}
          </View>
        ) : null}
      </CenteredCloseDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.border,
    gap: 8,
  },
  sectionTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 8,
  },
  list: {
    gap: 8,
    marginTop: 6,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  rowPlan: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  rowMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  rowWhatsapp: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowOpen: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  whatsappSend: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  whatsappSendPressed: {
    opacity: 0.88,
  },
  whatsappSendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  contractBody: {
    gap: 10,
  },
  paragraph: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'justify',
  },
  contractTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  clauseTitle: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
    textAlign: 'left',
    marginTop: 6,
  },
  metaLine: {
    color: MINIMAL_UI.blue,
    fontWeight: '600',
    textAlign: 'left',
  },
});
