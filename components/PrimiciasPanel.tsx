import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { formatShortName } from '@/lib/formatShortName';
import {
  formatPrimiciasItemLine,
  listPrimiciasItems,
  PRIMICIAS_CATEGORIES,
  PRIMICIAS_CATEGORY_LABEL,
  togglePrimiciasPledge,
  type PrimiciasItem,
} from '@/lib/primiciasApi';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ItemRowProps = {
  item: PrimiciasItem;
  donorName?: string;
  isMine: boolean;
  isAvailableSlot: boolean;
  busy: boolean;
  onPress: () => void;
};

function ItemRow({ item, donorName, isMine, isAvailableSlot, busy, onPress }: ItemRowProps) {
  const line = formatPrimiciasItemLine(item);
  const label = isAvailableSlot
    ? `${line}. Toque para doar`
    : `${line}. ${donorName ?? 'Membro'}`;

  return (
    <TouchableOpacity
      style={[styles.row, isMine && styles.rowMine, isAvailableSlot && styles.rowAvailable]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowText}>
        <Text style={styles.itemLine}>{line}</Text>
        {isAvailableSlot ? (
          <Text style={styles.slotHint}>Toque para se comprometer com este item</Text>
        ) : (
          <Text style={[styles.donorName, isMine && styles.donorNameMine]}>
            {donorName ?? 'Membro'}
            {isMine ? ' (você)' : ''}
          </Text>
        )}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
      ) : (
        <FontAwesome
          name={isAvailableSlot ? 'plus' : isMine ? 'check' : 'user'}
          size={16}
          color={isMine ? MINIMAL_UI.accent : MINIMAL_UI.textMuted}
        />
      )}
    </TouchableOpacity>
  );
}

export function PrimiciasPanel() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PrimiciasItem[]>([]);

  const load = useCallback(async () => {
    const result = await listPrimiciasItems();
    setItems(result.items);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar a campanha.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const grouped = useMemo(() => {
    return PRIMICIAS_CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const handleToggle = async (item: PrimiciasItem) => {
    if (busyId) {
      return;
    }

    setBusyId(item.id);

    try {
      const result = await togglePrimiciasPledge(item.id);
      await load();
      Toast.show({
        type: 'success',
        text1: 'Prímicias',
        text2: result.message,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Prímicias',
        text2: err instanceof Error ? err.message : 'Não foi possível atualizar o compromisso.',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <CardLoadingState />;
  }

  if (error) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Nenhum item cadastrado nesta campanha.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Prímicias</Text>
      <Text style={styles.lead}>
        Toque no item para vincular seu nome. Se mais de uma pessoa doar o mesmo produto, a linha se
        repete com cada responsável.
      </Text>

      {grouped.map((group) => (
        <View key={group.category} style={styles.section}>
          <Text style={styles.sectionTitle}>{PRIMICIAS_CATEGORY_LABEL[group.category]}</Text>
          {group.items.map((item) => {
            const mine = item.pledges.some((pledge) => pledge.isMine);

            return (
              <View key={item.id} style={styles.itemBlock}>
                {item.pledges.map((pledge) => (
                  <ItemRow
                    key={`${item.id}-${pledge.profileId}`}
                    item={item}
                    donorName={formatShortName(pledge.name)}
                    isMine={pledge.isMine}
                    isAvailableSlot={false}
                    busy={busyId === item.id}
                    onPress={() => void handleToggle(item)}
                  />
                ))}
                <ItemRow
                  item={item}
                  isMine={mine}
                  isAvailableSlot
                  busy={busyId === item.id}
                  onPress={() => void handleToggle(item)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 24,
    gap: 18,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    marginBottom: 0,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
    marginTop: -8,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
    marginBottom: 2,
  },
  itemBlock: {
    gap: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  rowMine: {
    borderColor: MINIMAL_UI.accent,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  rowAvailable: {
    borderStyle: 'dashed',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLine: {
    fontSize: 14,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  donorName: {
    fontSize: 13,
    color: MINIMAL_UI.textMuted,
  },
  donorNameMine: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
  slotHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
});
