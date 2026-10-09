import { listAliancaIndicationInvites, type AliancaIndicationInvite } from '@/lib/alianca/aliancaApi';
import { formatPhoneDisplay } from '@/lib/familyRegistration';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

function formatSentAt(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AliancaPendingInvites() {
  const [invites, setInvites] = useState<AliancaIndicationInvite[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listAliancaIndicationInvites();
    setInvites(result.invites);
    setMessage(result.success ? null : result.message || 'Não foi possível carregar os convites.');
  }, []);

  useEffect(() => {
    void load();
    return subscribeActiveTenantChange(() => {
      void load();
    });
  }, [load]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Convites aguardando formulário</Text>
      <Text style={styles.hint}>
        Cada WhatsApp enviado fica aqui como possível lead. Quando a pessoa envia o formulário, o
        convite sai desta lista e entra no funil.
      </Text>
      {message ? <Text style={styles.empty}>{message}</Text> : null}
      {!message && invites.length === 0 ? (
        <Text style={styles.empty}>Nenhum convite pendente.</Text>
      ) : null}
      {invites.length > 0 ? (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {invites.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.name}>{item.recipientName}</Text>
              <Text style={styles.meta}>{formatPhoneDisplay(item.recipientPhone)}</Text>
              <Text style={styles.meta}>
                {[item.instanceCode, item.instanceName].filter(Boolean).join(' · ') || 'Igreja'}
                {' · '}
                {item.senderName}
                {' · '}
                {formatSentAt(item.sentAt)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
    maxHeight: 220,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  list: {
    maxHeight: 120,
  },
  row: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.border,
    gap: 2,
  },
  name: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
});
