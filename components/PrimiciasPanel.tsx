import { PrimiciasCollapsibleSection } from '@/components/PrimiciasCollapsibleSection';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { offerConfirmedEventToCalendar } from '@/lib/calendarIcs';
import { formatShortName } from '@/lib/formatShortName';
import {
  formatPrimiciasIsoDate,
  formatPrimiciasItemLine,
  formatPrimiciasPendingCount,
  listPrimiciasItems,
  PRIMICIAS_CATEGORIES,
  PRIMICIAS_CATEGORY_LABEL,
  remainingPrimiciasQuantity,
  togglePrimiciasPledge,
  type PrimiciasItem,
  type PrimiciasOccurrence,
} from '@/lib/primiciasApi';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  busy: boolean;
  expanded: boolean;
  draftQuantity: number;
  onPress: () => void;
  onDraftQuantity: (quantity: number) => void;
  onConfirm: () => void;
  onRemove: () => void;
};

function donorLabel(item: PrimiciasItem) {
  return item.pledges
    .map((pledge) => {
      const who = `${formatShortName(pledge.name)}${pledge.isMine ? ' (você)' : ''}`;
      return item.quantity > 1 ? `${who}: ${pledge.quantity}` : who;
    })
    .join(', ');
}

function ItemRow({
  item,
  busy,
  expanded,
  draftQuantity,
  onPress,
  onDraftQuantity,
  onConfirm,
  onRemove,
}: ItemRowProps) {
  const line = formatPrimiciasItemLine(item);
  const minePledge = item.pledges.find((pledge) => pledge.isMine);
  const mine = Boolean(minePledge);
  const remaining = remainingPrimiciasQuantity(item);
  const filled = remaining === 0;
  const splittable = item.quantity > 1;
  const donorNames = donorLabel(item);
  const maxDraft = remaining + (minePledge?.quantity ?? 0);
  const label = filled
    ? `${line}. Já doado${donorNames ? `. ${donorNames}` : ''}`
    : splittable
      ? `${line}. Saldo ${remaining} de ${item.quantity}. Toque para escolher a quantidade`
      : `${line}. Toque para doar`;

  return (
    <View style={[styles.row, mine && styles.rowMine, filled && styles.rowPledged]}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={onPress}
        disabled={busy || (filled && !mine)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.rowText}>
          <Text style={[styles.itemLine, filled && styles.itemLinePledged]}>{line}</Text>
          {donorNames ? (
            <Text style={[styles.donorName, mine && styles.donorNameMine]}>{donorNames}</Text>
          ) : null}
          {filled ? null : splittable ? (
            <Text style={styles.slotHint}>
              Saldo: {remaining} de {item.quantity} {item.unit}. Toque para escolher a quantidade
            </Text>
          ) : (
            <Text style={styles.slotHint}>Toque para se comprometer com este item</Text>
          )}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
        ) : (
          <FontAwesome
            name={filled ? 'check' : 'plus'}
            size={16}
            color={mine ? MINIMAL_UI.accent : MINIMAL_UI.textMuted}
          />
        )}
      </TouchableOpacity>
      {expanded && splittable ? (
        <View style={styles.picker}>
          <Text style={styles.pickerLabel}>Quantidade</Text>
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => onDraftQuantity(Math.max(1, draftQuantity - 1))}
              disabled={busy || draftQuantity <= 1}
              accessibilityRole="button"
              accessibilityLabel="Diminuir quantidade"
            >
              <FontAwesome name="minus" size={12} color={MINIMAL_UI.blueDark} />
            </TouchableOpacity>
            <Text style={styles.pickerValue}>{draftQuantity}</Text>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => onDraftQuantity(Math.min(maxDraft, draftQuantity + 1))}
              disabled={busy || draftQuantity >= maxDraft}
              accessibilityRole="button"
              accessibilityLabel="Aumentar quantidade"
            >
              <FontAwesome name="plus" size={12} color={MINIMAL_UI.blueDark} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              disabled={busy || draftQuantity < 1 || draftQuantity > maxDraft}
              accessibilityRole="button"
              accessibilityLabel="Confirmar quantidade"
            >
              <Text style={styles.confirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
          {mine ? (
            <TouchableOpacity
              onPress={onRemove}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remover meu compromisso"
            >
              <Text style={styles.removeText}>Remover meu compromisso</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type PrimiciasPanelHandle = {
  collapseOpenSections: () => boolean;
  closeWithCalendarOffer: () => Promise<void>;
};

export const PrimiciasPanel = forwardRef<PrimiciasPanelHandle>(function PrimiciasPanel(_props, ref) {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PrimiciasItem[]>([]);
  const [occurrence, setOccurrence] = useState<PrimiciasOccurrence | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState(1);
  const itemsRef = useRef(items);
  const occurrenceRef = useRef(occurrence);
  const pledgedThisVisitRef = useRef(false);
  const openSectionsRef = useRef(openSections);

  itemsRef.current = items;
  occurrenceRef.current = occurrence;
  openSectionsRef.current = openSections;

  const load = useCallback(async () => {
    const result = await listPrimiciasItems();
    setItems(result.items);
    setOccurrence(result.occurrence);
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

  useFocusEffect(
    useCallback(() => {
      setOpenSections({});
    }, [])
  );

  const grouped = useMemo(() => {
    return PRIMICIAS_CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    collapseOpenSections: () => {
      const anyOpen = Object.values(openSectionsRef.current).some(Boolean);
      if (!anyOpen) {
        return false;
      }

      setOpenSections({});
      return true;
    },
    closeWithCalendarOffer: async () => {
      const occ = occurrenceRef.current;
      const mineItems = itemsRef.current.filter((item) =>
        item.pledges.some((pledge) => pledge.isMine)
      );

      if (!pledgedThisVisitRef.current || mineItems.length === 0 || !occ) {
        return;
      }

      await offerConfirmedEventToCalendar({
        id: occ.eventId,
        titulo: occ.title,
        local: occ.eventLocal,
        eventDate: occ.startsAt,
        eventEndDate: occ.eventEndDate,
        descricao: `Itens: ${mineItems
          .map((item) => {
            const mineQty = item.pledges.find((pledge) => pledge.isMine)?.quantity ?? item.quantity;
            return formatPrimiciasItemLine({ ...item, quantity: mineQty });
          })
          .join('; ')}`,
      });
    },
  }));

  const commitQuantity = async (item: PrimiciasItem, quantity: number) => {
    if (busyId) {
      return;
    }

    setBusyId(item.id);

    try {
      const result = await togglePrimiciasPledge(item.id, quantity);
      if (result.pledged) {
        pledgedThisVisitRef.current = true;
      }
      setPickerItemId(null);
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

  const handleToggle = (item: PrimiciasItem) => {
    const mine = item.pledges.some((pledge) => pledge.isMine);
    const remaining = remainingPrimiciasQuantity(item);

    if (busyId || (remaining === 0 && !mine)) {
      return;
    }

    if (item.quantity > 1) {
      if (pickerItemId === item.id) {
        setPickerItemId(null);
        return;
      }

      const mineQty = item.pledges.find((pledge) => pledge.isMine)?.quantity ?? 0;
      setDraftQuantity(mineQty > 0 ? mineQty : 1);
      setPickerItemId(item.id);
      return;
    }

    void commitQuantity(item, mine ? 0 : 1);
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
      {occurrence ? (
        <Text style={styles.lead}>
          Campanha em {formatPrimiciasIsoDate(occurrence.eventDate)}. Toque no item para doar. Se a
          quantidade for maior que 1, escolha quantos você leva, até o saldo. O texto fica riscado
          quando o saldo chega a zero. Os itens voltam a ficar livres{' '}
          {formatPrimiciasIsoDate(occurrence.resetOn)}, 10 dias após a data.
        </Text>
      ) : (
        <Text style={styles.lead}>
          A liderança ainda não definiu a data da campanha. Quando a data estiver marcada, o toque no
          item cria o compromisso na agenda da família.
        </Text>
      )}

      {grouped.map((group) => (
          <PrimiciasCollapsibleSection
            key={group.category}
            title={PRIMICIAS_CATEGORY_LABEL[group.category]}
            subtitle={formatPrimiciasPendingCount(group.items)}
            open={openSections[group.category] === true}
            onOpenChange={(next) => {
              setOpenSections((current) => ({ ...current, [group.category]: next }));
            }}
          >
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                expanded={pickerItemId === item.id}
                draftQuantity={draftQuantity}
                onPress={() => handleToggle(item)}
                onDraftQuantity={setDraftQuantity}
                onConfirm={() => void commitQuantity(item, draftQuantity)}
                onRemove={() => void commitQuantity(item, 0)}
              />
            ))}
          </PrimiciasCollapsibleSection>
      ))}
    </ScrollView>
  );
});

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
  row: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  picker: {
    gap: 8,
    paddingTop: 4,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.rowHover,
  },
  pickerValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  confirmButton: {
    marginLeft: 4,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: MINIMAL_UI.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.accent,
  },
  rowMine: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  rowPledged: {
    borderStyle: 'solid',
    opacity: 0.85,
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
  itemLinePledged: {
    textDecorationLine: 'line-through',
    color: MINIMAL_UI.textMuted,
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
