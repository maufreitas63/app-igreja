import { DropdownSelect } from '@/components/ui/DropdownSelect';
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

  const applyBundle = useCallback(
    (next: PixAccountsBundle) => {
      setBundle(next);
      const nextDrafts: Record<string, PixAccount> = {};
      for (const account of next.accounts) {
        nextDrafts[account.id] = { ...account };
      }
      setDrafts(nextDrafts);
      onBundleChange?.(next);
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

  const handleSave = async (account: PixAccount, isNew = false) => {
    setSavingId(isNew ? 'new' : account.id);

    try {
      applyBundle(
        await upsertBankAccountAdmin({
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
        })
      );
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
      `Excluir ${account.label || 'esta conta'}? Campanhas que a usam passam a usar a conta padrão.`,
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

  if (loading) {
    return <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#1E3A5F'} />;
  }

  const canEdit = showEditor && bundle?.canManage === true;
  const visibleAccounts = compact
    ? (bundle?.accounts ?? []).filter((item) => item.id === visibleSlot)
    : bundle?.accounts ?? [];

  const renderEditor = (account: PixAccount, isNew: boolean) => {
    const key = isNew ? 'new' : account.id;
    const busy = savingId === key;

    return (
      <View key={key} style={styles.card}>
        <Text style={[styles.label, minimal && styles.labelMinimal]}>
          {isNew ? 'Nova conta' : account.label || 'Conta'}
        </Text>
        <TextInput
          style={maintenancePanelStyles.input}
          value={account.label}
          onChangeText={(value) =>
            isNew
              ? setCreateDraft((prev) => ({ ...prev, label: value, institution: value }))
              : setDrafts((prev) => ({ ...prev, [account.id]: { ...account, label: value } }))
          }
          placeholder="Nome do banco / instituição"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <TextInput
          style={maintenancePanelStyles.input}
          value={account.pixKey ?? ''}
          onChangeText={(value) =>
            isNew
              ? setCreateDraft((prev) => ({ ...prev, pixKey: value }))
              : setDrafts((prev) => ({ ...prev, [account.id]: { ...account, pixKey: value } }))
          }
          placeholder="Chave Pix"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          editable={canEdit}
        />
        <TextInput
          style={maintenancePanelStyles.input}
          value={account.holderName ?? ''}
          onChangeText={(value) =>
            isNew
              ? setCreateDraft((prev) => ({ ...prev, holderName: value }))
              : setDrafts((prev) => ({ ...prev, [account.id]: { ...account, holderName: value } }))
          }
          placeholder="Titular (opcional)"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <TextInput
          style={maintenancePanelStyles.input}
          value={account.document ?? ''}
          onChangeText={(value) =>
            isNew
              ? setCreateDraft((prev) => ({ ...prev, document: value }))
              : setDrafts((prev) => ({ ...prev, [account.id]: { ...account, document: value } }))
          }
          placeholder="CNPJ/CPF da conta (opcional)"
          placeholderTextColor="#94A3B8"
          editable={canEdit}
        />
        <View style={styles.row}>
          <TextInput
            style={[maintenancePanelStyles.input, styles.flex]}
            value={account.agency ?? ''}
            onChangeText={(value) =>
              isNew
                ? setCreateDraft((prev) => ({ ...prev, agency: value }))
                : setDrafts((prev) => ({ ...prev, [account.id]: { ...account, agency: value } }))
            }
            placeholder="Agência"
            placeholderTextColor="#94A3B8"
            editable={canEdit}
          />
          <TextInput
            style={[maintenancePanelStyles.input, styles.flex]}
            value={account.accountNumber ?? ''}
            onChangeText={(value) =>
              isNew
                ? setCreateDraft((prev) => ({ ...prev, accountNumber: value }))
                : setDrafts((prev) => ({
                    ...prev,
                    [account.id]: { ...account, accountNumber: value },
                  }))
            }
            placeholder="Conta"
            placeholderTextColor="#94A3B8"
            editable={canEdit}
          />
        </View>
        <DropdownSelect
          options={ACCOUNT_TYPE_OPTIONS}
          selectedValue={account.accountType ?? ''}
          onValueChange={(value) => {
            const nextType = (BANK_ACCOUNT_TYPES as readonly string[]).includes(value)
              ? (value as PixAccount['accountType'])
              : null;
            if (isNew) {
              setCreateDraft((prev) => ({ ...prev, accountType: nextType }));
            } else {
              setDrafts((prev) => ({ ...prev, [account.id]: { ...account, accountType: nextType } }));
            }
          }}
          modalTitle="Tipo de conta"
          variant={minimal ? 'minimal' : 'default'}
          disabled={!canEdit}
        />
        {canEdit && !compact ? (
          <TouchableOpacity
            style={styles.defaultToggle}
            onPress={() =>
              isNew
                ? setCreateDraft((prev) => ({ ...prev, isDefaultOfferings: !prev.isDefaultOfferings }))
                : setDrafts((prev) => ({
                    ...prev,
                    [account.id]: { ...account, isDefaultOfferings: !account.isDefaultOfferings },
                  }))
            }
          >
            <Text style={[styles.defaultText, account.isDefaultOfferings && styles.defaultTextOn]}>
              {account.isDefaultOfferings
                ? 'Padrão de dízimos e ofertas'
                : 'Usar como padrão de dízimos e ofertas'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {canEdit ? (
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
            {!isNew ? (
              <TouchableOpacity
                style={styles.delete}
                onPress={() => void handleDelete(account)}
                disabled={busy}
              >
                <Text style={styles.deleteText}>Excluir</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.delete}
                onPress={() => {
                  setCreating(false);
                  setCreateDraft(emptyDraft());
                }}
              >
                <Text style={styles.deleteText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {compact ? null : (
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          Cadastre quantas contas precisar. Dízimos e ofertas usam a conta marcada como padrão.
          Cada campanha escolhe a própria conta.
        </Text>
      )}

      {compact && !visibleSlot ? (
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          Selecione o banco da campanha para ver e editar os dados dessa conta.
        </Text>
      ) : null}

      {visibleAccounts.map((account) => renderEditor(drafts[account.id] ?? account, false))}

      {!compact && canEdit && creating ? renderEditor(createDraft, true) : null}

      {!compact && canEdit && !creating ? (
        <TouchableOpacity style={styles.add} onPress={() => setCreating(true)}>
          <Text style={styles.addText}>Adicionar conta bancária</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  hintMinimal: {
    color: MINIMAL_UI.muted,
  },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  label: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
  },
  labelMinimal: {
    color: MINIMAL_UI.accent,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
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
  deleteText: {
    color: '#B91C1C',
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
