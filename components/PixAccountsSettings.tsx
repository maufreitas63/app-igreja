import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchSessionPixAccounts,
  pixAccountDropdownOptions,
  savePixAccountsAdmin,
  type PixAccountSlot,
  type PixAccountsBundle,
} from '@/lib/pixAccountsApi';
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
  /** Em campanha: mostra só a conta escolhida, depois da seleção. */
  visibleSlot?: PixAccountSlot | null;
  onBundleChange?: (bundle: PixAccountsBundle) => void;
};

export function PixAccountsSettings({
  isActive = true,
  minimal = false,
  showEditor = true,
  compact = false,
  visibleSlot = null,
  onBundleChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bundle, setBundle] = useState<PixAccountsBundle | null>(null);
  const [nome1, setNome1] = useState('Conta principal');
  const [chave1, setChave1] = useState('');
  const [nome2, setNome2] = useState('Conta secundária');
  const [chave2, setChave2] = useState('');
  const [padrao, setPadrao] = useState<PixAccountSlot>('1');

  const applyBundle = useCallback(
    (next: PixAccountsBundle) => {
      setBundle(next);
      setNome1(next.accounts[0]?.label || 'Conta principal');
      setChave1(next.accounts[0]?.pixKey || '');
      setNome2(next.accounts[1]?.label || 'Conta secundária');
      setChave2(next.accounts[1]?.pixKey || '');
      setPadrao(next.defaultSlot);
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
        text1: 'Contas Pix',
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

  const handleSave = async () => {
    setSaving(true);

    try {
      applyBundle(
        await savePixAccountsAdmin({
          nomeConta1: nome1,
          chavePix1: chave1,
          nomeConta2: nome2,
          chavePix2: chave2,
          padraoOfertas: padrao,
        })
      );
      Toast.show({ type: 'success', text1: 'Contas Pix', text2: 'Configuração salva.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Contas Pix',
        text2: error instanceof Error ? error.message : 'Falha ao salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#1E3A5F'} />;
  }

  const canEdit = showEditor && bundle?.canManage === true;
  const options = pixAccountDropdownOptions(bundle);
  const showAccount1 = compact ? visibleSlot === '1' : canEdit;
  const showAccount2 = compact ? visibleSlot === '2' : canEdit;
  const showSave = canEdit && (showAccount1 || showAccount2);

  return (
    <View style={styles.root}>
      {compact ? null : (
        <>
          <Text style={[styles.hint, minimal && styles.hintMinimal]}>
            Dízimos e ofertas gerais usam a conta padrão. Cada campanha pode escolher a própria
            conta.
          </Text>

          <Text style={[styles.label, minimal && styles.labelMinimal]}>
            Chave Pix padrão (dízimos e ofertas)
          </Text>
          <DropdownSelect
            options={options}
            selectedValue={padrao}
            onValueChange={(value) => {
              const next = value === '2' ? '2' : '1';
              setPadrao(next);

              if (!canEdit) {
                return;
              }

              void savePixAccountsAdmin({
                nomeConta1: nome1,
                chavePix1: chave1,
                nomeConta2: nome2,
                chavePix2: chave2,
                padraoOfertas: next,
              })
                .then((saved) => {
                  applyBundle(saved);
                  Toast.show({
                    type: 'success',
                    text1: 'Contas Pix',
                    text2: 'Chave padrão de dízimos e ofertas atualizada.',
                  });
                })
                .catch((error) => {
                  Toast.show({
                    type: 'error',
                    text1: 'Contas Pix',
                    text2: error instanceof Error ? error.message : 'Falha ao salvar.',
                  });
                });
            }}
            modalTitle="Conta Pix padrão"
            variant={minimal ? 'minimal' : 'default'}
            disabled={!canEdit}
          />
        </>
      )}

      {compact && !visibleSlot ? (
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          Selecione o banco da campanha para ver e editar os dados dessa conta.
        </Text>
      ) : null}

      {showAccount1 ? (
        <>
          <Text style={[styles.label, minimal && styles.labelMinimal]}>Conta 1</Text>
          <TextInput
            style={maintenancePanelStyles.input}
            value={nome1}
            onChangeText={setNome1}
            placeholder="Nome da conta 1"
            placeholderTextColor="#94A3B8"
            editable={canEdit}
          />
          <TextInput
            style={maintenancePanelStyles.input}
            value={chave1}
            onChangeText={setChave1}
            placeholder="Chave Pix principal"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            editable={canEdit}
          />
        </>
      ) : null}

      {showAccount2 ? (
        <>
          <Text style={[styles.label, minimal && styles.labelMinimal]}>Conta 2</Text>
          <TextInput
            style={maintenancePanelStyles.input}
            value={nome2}
            onChangeText={setNome2}
            placeholder="Nome da conta 2"
            placeholderTextColor="#94A3B8"
            editable={canEdit}
          />
          <TextInput
            style={maintenancePanelStyles.input}
            value={chave2}
            onChangeText={setChave2}
            placeholder="Chave Pix secundária"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            editable={canEdit}
          />
        </>
      ) : null}

      {showSave ? (
        <TouchableOpacity style={styles.save} onPress={() => void handleSave()} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Salvar contas Pix</Text>
          )}
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
  label: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
  },
  labelMinimal: {
    color: MINIMAL_UI.accent,
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
});
