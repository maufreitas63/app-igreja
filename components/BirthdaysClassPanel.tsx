import { BirthdaysClass } from '@/components/BirthdaysClass';
import { loadBirthdaysClassData } from '@/lib/birthdaysClassData';
import type { BirthdaysClassEntry } from '@/lib/birthdaysClassTypes';
import {
  getCurrentBirthdayMonth,
  resolveBirthdayMonthLabel,
} from '@/lib/birthdaysClassUtils';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, StyleSheet, View } from 'react-native';

/** Container com dados e navegação — compõe o BirthdaysClass stateless. */
export function BirthdaysClassPanel() {
  const [entries, setEntries] = useState<BirthdaysClassEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentBirthdayMonth);

  const selectedMonthLabel = useMemo(
    () => resolveBirthdayMonthLabel(selectedMonth),
    [selectedMonth]
  );

  const entriesForSelectedMonth = useMemo(
    () => entries.filter((entry) => String(entry.month) === selectedMonth),
    [entries, selectedMonth]
  );

  const loadBirthdays = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadBirthdaysClassData();
      setEntries(loaded);
    } catch (loadError) {
      console.error('Erro ao carregar aniversariantes:', loadError);
      setEntries([]);
      setError('Nao foi possivel carregar os aniversariantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBirthdays();
  }, [loadBirthdays]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setSelectedMonth(getCurrentBirthdayMonth());
        void loadBirthdays();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadBirthdays]);

  const handleOpenWhatsapp = useCallback(async (entry: BirthdaysClassEntry) => {
    const whatsappPhone = normalizePhoneForWhatsApp(entry.phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponivel', 'Este aniversariante nao possui telefone cadastrado.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (linkError) {
      console.error('Erro ao abrir WhatsApp:', linkError);
      Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste usuario.');
    }
  }, []);

  return (
    <View style={styles.root}>
      <BirthdaysClass
        loading={loading}
        error={error}
        onRetry={() => void loadBirthdays()}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedMonthLabel={selectedMonthLabel}
        entries={entriesForSelectedMonth}
        onOpenWhatsapp={(entry) => void handleOpenWhatsapp(entry)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
});
