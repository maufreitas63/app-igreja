import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  BANK_ACCOUNT_TYPES,
  deleteBankAccountAdmin,
  fetchSessionPixAccounts,
  upsertBankAccountAdmin,
  type PixAccount,
  type PixAccountsBundle,
} from '@/lib/pixAccountsApi';
import { confirmDialog } from '@/lib/confirmDialog';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  minimal?: boolean;
  showEditor?: boolean;
  compact?: boolean;
  visibleSlot?: string | null;
  onBundleChange?: (bundle: PixAccountsBundle) => void;
};

type PanelMode = 'view' | 'edit';

const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'Tipo de conta (opcional)' },
  { value: 'corrente', label: 'Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'salario', label: 'Salário' },
  { value: 'outro', label: 'Outro' },
];

const emptyDraft = (): PixAccount => ({
  id: '',
  slot: '',
  label: '',
  pixKey: '',
  institution: '',
  holderName: '',
  document: '',
  agency: '',
  accountNumber: '',
  accountType: null,
  isActive: true,
  isDefaultOfferings: false,
  sortOrder: 0,
});

function accountTitle(account: PixAccount) {
  return account.label || account.institution || 'Conta Pix';
}

function typeLabel(value: PixAccount['accountType']) {
  return ACCOUNT_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? null;
}

export function PixAccountsSettings({
  isActive = true,
  minimal = false,
  showEditor = true,
  compact = false,
  visibleSlot = null,
  onBundleChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<PixAccountsBundle | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PixAccount>>({});
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<PixAccount>(emptyDraft());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mode, setMode] = useState<PanelMode>('view');

  const applyBundle = useCallback(
    (next: PixAccountsBundle, preferId?: string | null) => {
      setBundle(next);
      const nextDrafts: Record<string, PixAccount> = {};
      for (const account of next.accounts) {
        nextDrafts[account.id] = { ...account };
      }
      setDrafts(nextDrafts);
      onBundleChange?.(next);

      if (preferId && next.accounts.some((item) => item.id === preferId)) {
        setExpandedId(preferId);
        setMode('view');
      }
    },
    [onBundleChange]
  );

  const load = useCallback(async () => {
    try {
      applyBundle(await fetchSessionPixAccounts());
    } catch (error) {
      setBundle(null);
      Toast.show({
        type: 'error',
        text1: 'Contas bancárias',
        text2: error instanceof Error ? error.message : 'Falha ao carregar.',
      });
    } finally {
      setLoading(false);
    }
  }, [applyBundle]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
  }, [isActive, load]);

  useEffect(() => {
    if (!compact) {
      return;
    }

    setExpandedId(visibleSlot);
    setMode('view');
    setCreating(false);
  }, [compact, visibleSlot]);

  const handleSave = async (account: PixAccount, isNew = false) => {
    const previousIds = new Set((bundle?.accounts ?? []).map((item) => item.id));
    setSavingId(isNew ? 'new' : account.id);

    try {
      const next = await upsertBankAccountAdmin({
        id: isNew ? null : account.id,
        label: account.label || account.institution || 'Conta Pix',
        institution: account.institution || account.label,
        holderName: account.holderName,
        document: account.document,
        agency: account.agency,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        pixKey: account.pixKey,
        isDefaultOfferings: account.isDefaultOfferings,
        isActive: account.isActive,
      });
      const created = next.accounts.find((item) => !previousIds.has(item.id));
      applyBundle(next, isNew ? created?.id ?? null : account.id);
      if (isNew) {
        setCreating(false);
        setCreateDraft(emptyDraft());
      }
      Toast.show({ type: 'success', text1: 'Contas bancárias', text2: 'Conta salva.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Contas bancárias',
        text2: error instanceof Error ? error.message : 'Falha ao salvar.',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (account: PixAccount) => {
    const ok = await confirmDialog(
      'Excluir conta',
      `Excluir ${accountTitle(account)}? Campanhas que a usam passam a usar a conta padrão.`,
      'Excluir',
      'Não',
      { destructive: true }
    );
    if (!ok) {
      return;
    }

    setSavingId(account.id);
    try {
      applyBundle(await deleteBankAccountAdmin(account.id));
      if (expandedId === account.id) {
        setExpandedId(null);
        setMode('view');
      }
      Toast.show({ type: 'success', text1: 'Contas bancárias', text2: 'Conta excluída.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Contas bancárias',
        text2: error instanceof Error ? error.message : 'Falha ao excluir.',
      });
    } finally {
      setSavingId(null);
    }
  };

  const revertDraft = (account: PixAccount) => {
    const original = bundle?.accounts.find((item) => item.id === account.id);
    if (original) {
      setDrafts((prev) => ({ ...prev, [account.id]: { ...original } }));
    }
    setMode('view');
  };

  if (loading) {
    return <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#1E3A5F'} />;
  }

  const canEdit = showEditor && bundle?.canManage === true;
  const visibleAccounts = compact
    ? (bundle?.accounts ?? []).filter((item) => item.id === visibleSlot)
    : bundle?.accounts ?? [];

  const updateDraft = (account: PixAccount, isNew: boolean, patch: Partial<PixAccount>) => {
    if (isNew) {
      setCreateDraft((prev) => ({ ...prev, ...patch }));
      return;
    }

    setDrafts((prev) => ({ ...prev, [account.id]: { ...account, ...patch } }));
  };

  const renderSaveActions = (account: PixAccount, isNew: boolean, busy: boolean) => {
    if (!canEdit) {
      return null;
    }

    return (
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.save}
          onPress={() => void handleSave(account, isNew)}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>{isNew ? 'Cadastrar conta' : 'Salvar conta'}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.delete}
          onPress={() => {
            if (isNew) {
              setCreating(false);
              setCreateDraft(emptyDraft());
              return;
            }
            revertDraft(account);
          }}
          disabled={busy}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEditor = (account: PixAccount, isNew: boolean) => {
    const key = isNew ? 'new' : account.id;
    const busy = savingId === key;

    return (
      <View style={styles.editor}>
        {renderSaveActions(account, isNew, busy)}
        <TextInput
          style={[maintenancePanelStyles.input, styles.field]}
          value={account.label}
          onChangeText={(value) => updateDraft(account, isNew, { label: value, institution: value })}
          placeholder="Nome do banco / instituição"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <TextInput
          style={[maintenancePanelStyles.input, styles.field]}
          value={account.pixKey ?? ''}
          onChangeText={(value) => updateDraft(account, isNew, { pixKey: value })}
          placeholder="Chave Pix"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          editable={canEdit}
        />
        <TextInput
          style={[maintenancePanelStyles.input, styles.field]}
          value={account.holderName ?? ''}
          onChangeText={(value) => updateDraft(account, isNew, { holderName: value })}
          placeholder="Titular (opcional)"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <TextInput
          style={[maintenancePanelStyles.input, styles.field]}
          value={account.document ?? ''}
          onChangeText={(value) => updateDraft(account, isNew, { document: value })}
          placeholder="CNPJ/CPF da conta (opcional)"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <View style={styles.row}>
          <View style={styles.fieldCell}>
            <TextInput
              style={[maintenancePanelStyles.input, styles.field]}
              value={account.agency ?? ''}
              onChangeText={(value) => updateDraft(account, isNew, { agency: value })}
              placeholder="Agência"
              placeholderTextColor="#94A3B8"
              editable={canEdit}
            />
          </View>
          <View style={styles.fieldCell}>
            <TextInput
              style={[maintenancePanelStyles.input, styles.field]}
              value={account.accountNumber ?? ''}
              onChangeText={(value) => updateDraft(account, isNew, { accountNumber: value })}
              placeholder="Conta"
              placeholderTextColor="#94A3B8"
              editable={canEdit}
            />
          </View>
        </View>
        <Text style={[styles.typeCaption, minimal && styles.typeCaptionMinimal]}>Tipo de conta</Text>
        <View style={styles.typeRow}>
          {ACCOUNT_TYPE_OPTIONS.map((option) => {
            const selected = (account.accountType ?? '') === option.value;
            return (
              <TouchableOpacity
                key={option.value || 'none'}
                style={[styles.typeChip, selected && styles.typeChipOn]}
                onPress={() =>
                  updateDraft(account, isNew, {
                    accountType: (BANK_ACCOUNT_TYPES as readonly string[]).includes(option.value)
                      ? (option.value as PixAccount['accountType'])
                      : null,
                  })
                }
                disabled={!canEdit}
              >
                <Text style={[styles.typeChipText, selected && styles.typeChipTextOn]} numberOfLines={1}>
                  {option.value ? option.label : 'Sem tipo'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {canEdit && !compact ? (
          <TouchableOpacity
            style={styles.defaultToggle}
            onPress={() =>
              updateDraft(account, isNew, { isDefaultOfferings: !account.isDefaultOfferings })
            }
          >
            <Text style={[styles.defaultText, account.isDefaultOfferings && styles.defaultTextOn]}>
              {account.isDefaultOfferings
                ? 'Padrão de dízimos e ofertas'
                : 'Usar como padrão de dízimos e ofertas'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {renderSaveActions(account, isNew, busy)}
      </View>
    );
  };

  const renderView = (account: PixAccount) => {
    const details: { label: string; value: string }[] = [
      { label: 'Instituição', value: account.institution || accountTitle(account) },
      { label: 'Chave Pix', value: account.pixKey || '—' },
      { label: 'Titular', value: account.holderName || '—' },
      { label: 'CNPJ/CPF', value: account.document || '—' },
      { label: 'Agência', value: account.agency || '—' },
      { label: 'Conta', value: account.accountNumber || '—' },
      { label: 'Tipo', value: typeLabel(account.accountType) || '—' },
    ];

    return (
      <View style={styles.viewBox}>
        {details.map((row) => (
          <View key={row.label} style={styles.viewRow}>
            <Text style={[styles.viewLabel, minimal && styles.viewLabelMinimal]}>{row.label}</Text>
            <Text style={[styles.viewValue, minimal && styles.viewValueMinimal]}>{row.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderAccount = (account: PixAccount) => {
    const draft = drafts[account.id] ?? account;
    const expanded = expandedId === account.id;
    const busy = savingId === account.id;

    return (
      <View key={account.id} style={[styles.card, expanded && styles.cardExpanded]}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => {
            setCreating(false);
            setExpandedId((prev) => (prev === account.id ? null : account.id));
            setMode('view');
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={accountTitle(account)}
        >
          <View style={styles.headerText}>
            <Text style={[styles.label, minimal && styles.labelMinimal]} numberOfLines={1}>
              {accountTitle(account)}
            </Text>
            {account.isDefaultOfferings ? (
              <Text style={[styles.badge, minimal && styles.badgeMinimal]}>Padrão</Text>
            ) : null}
          </View>
          <FontAwesome
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={minimal ? MINIMAL_UI.icon : '#1E3A5F'}
          />
        </TouchableOpacity>

        {expanded ? (
          <View style={styles.body}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, mode === 'view' && styles.actionChipOn]}
                onPress={() => {
                  revertDraft(account);
                  setMode('view');
                }}
              >
                <Text style={[styles.actionChipText, mode === 'view' && styles.actionChipTextOn]}>
                  Ver
                </Text>
              </TouchableOpacity>
              {canEdit ? (
                <TouchableOpacity
                  style={[styles.actionChip, mode === 'edit' && styles.actionChipOn]}
                  onPress={() => {
                    setCreating(false);
                    setMode('edit');
                  }}
                >
                  <Text style={[styles.actionChipText, mode === 'edit' && styles.actionChipTextOn]}>
                    Editar
                  </Text>
                </TouchableOpacity>
              ) : null}
              {canEdit ? (
                <TouchableOpacity
                  style={[styles.actionChip, styles.actionChipDanger]}
                  onPress={() => void handleDelete(account)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#B91C1C" />
                  ) : (
                    <Text style={styles.actionChipDangerText}>Excluir</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
            {mode === 'edit' && canEdit ? renderEditor(draft, false) : renderView(account)}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {compact ? null : (
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          {visibleAccounts.length
            ? `${visibleAccounts.length} conta${visibleAccounts.length === 1 ? '' : 's'} cadastrada${
                visibleAccounts.length === 1 ? '' : 's'
              }. Toque no nome para ver, editar ou excluir.`
            : 'Nenhuma conta cadastrada ainda. Cadastre a primeira abaixo.'}
        </Text>
      )}

      {compact && !visibleSlot ? (
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          Selecione o banco da campanha para ver e editar os dados dessa conta.
        </Text>
      ) : null}

      {visibleAccounts.map(renderAccount)}

      {!compact && canEdit && creating ? (
        <View style={[styles.card, styles.cardExpanded]}>
          <Text style={[styles.label, minimal && styles.labelMinimal]}>Nova conta</Text>
          {renderEditor(createDraft, true)}
        </View>
      ) : null}

      {!compact && canEdit && !creating ? (
        <TouchableOpacity
          style={styles.add}
          onPress={() => {
            setCreating(true);
            setExpandedId(null);
            setMode('view');
          }}
        >
          <Text style={styles.addText}>Adicionar conta bancária</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  hintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  cardExpanded: {
    gap: 8,
    paddingBottom: 10,
  },
  header: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    paddingHorizontal: 10,
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
    color: '#1E3A5F',
    fontSize: 13,
    fontWeight: '800',
  },
  labelMinimal: {
    color: MINIMAL_UI.accent,
  },
  badge: {
    color: '#1E3A5F',
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeMinimal: {
    color: MINIMAL_UI.accent,
    borderColor: MINIMAL_UI.accent,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipOn: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  actionChipDanger: {
    borderColor: '#FECACA',
  },
  actionChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  actionChipTextOn: {
    color: '#FFFFFF',
  },
  actionChipDangerText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  viewBox: {
    gap: 4,
  },
  viewRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  viewLabel: {
    width: 84,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  viewLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  viewValue: {
    flex: 1,
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '600',
  },
  viewValueMinimal: {
    color: MINIMAL_UI.accent,
  },
  editor: {
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  field: {
    minHeight: 44,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  fieldCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  typeCaption: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  typeCaptionMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  typeChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipOn: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  typeChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextOn: {
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  flex: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  defaultToggle: {
    minHeight: 36,
    justifyContent: 'center',
  },
  defaultText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  defaultTextOn: {
    color: '#1E3A5F',
  },
  actions: {
    gap: 8,
  },
  save: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  delete: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '700',
  },
  add: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: '#1E3A5F',
    fontWeight: '800',
  },
});
