import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { profileClassStyles } from '@/lib/manageProfile/profileClassStyles';
import {
  deleteMyProfileService,
  fetchMyProfileService,
  saveMyProfileService,
  SERVICE_CATEGORIA_LABEL,
  SERVICE_CATEGORIES,
  type ServiceCategoria,
} from '@/lib/profileServicesApi';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

const CATEGORY_OPTIONS = SERVICE_CATEGORIES.map((item) => ({
  value: item.value,
  label: item.label,
}));

/** Cadastro do serviço oferecido — Perfil → Ofereço meus Serviços. */
export function ProfileServiceForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<ServiceCategoria>('outros');
  const [statusAtivo, setStatusAtivo] = useState(false);
  const [telefone, setTelefone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const service = await fetchMyProfileService();
      setServiceId(service?.id ?? null);
      setTitulo(service?.tituloServico ?? '');
      setDescricao(service?.descricaoServico ?? '');
      setCategoria(service?.categoria ?? 'outros');
      setStatusAtivo(service?.statusAtivo ?? false);
      setTelefone(formatBrazilPhoneInput(service?.telefoneContato ?? ''));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ofereço meus Serviços',
        text2: error instanceof Error ? error.message : 'Não foi possível carregar o serviço.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const result = await saveMyProfileService({
        tituloServico: titulo,
        descricaoServico: descricao,
        categoria,
        statusAtivo,
        telefoneContato: telefone,
      });

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Ofereço meus Serviços',
        text2: result.message,
      });

      if (result.success) {
        await load();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ofereço meus Serviços',
        text2: error instanceof Error ? error.message : 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog(
      'Excluir oferta?',
      'A oferta deixa de aparecer no Apoio Mútuo desta igreja.',
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const result = await deleteMyProfileService();
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Ofereço meus Serviços',
        text2: result.message,
      });

      if (result.success) {
        setServiceId(null);
        setTitulo('');
        setDescricao('');
        setCategoria('outros');
        setStatusAtivo(false);
        await load();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Ofereço meus Serviços',
        text2: error instanceof Error ? error.message : 'Não foi possível excluir.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <View style={profileClassStyles.sectionCard}>
        <View style={profileClassStyles.sectionHeader}>
          <View>
            <Text style={profileClassStyles.sectionTitle}>Ofereço meus Serviços</Text>
            <Text style={profileClassStyles.sectionMeta}>
              Cartão de visitas no Apoio Mútuo desta igreja
              {statusAtivo ? ` · ${SERVICE_CATEGORIA_LABEL[categoria]}` : ' · inativo'}
            </Text>
          </View>
          <MaterialIcons name="miscellaneous-services" size={22} color={MINIMAL_UI.blueDark} />
        </View>

        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.blueDark} style={{ marginVertical: 16 }} />
        ) : (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View>
              <Text style={profileClassStyles.vehicleFormLabel}>Título do serviço</Text>
              <TextInput
                style={profileClassStyles.input}
                placeholder="Ex.: Manicure, aulas de violão"
                placeholderTextColor={MINIMAL_UI.textMuted}
                value={titulo}
                onChangeText={setTitulo}
                maxLength={80}
              />
            </View>

            <View>
              <Text style={profileClassStyles.vehicleFormLabel}>Descrição</Text>
              <TextInput
                style={[profileClassStyles.input, { minHeight: 88, textAlignVertical: 'top' }]}
                placeholder="O que você oferece nesta igreja"
                placeholderTextColor={MINIMAL_UI.textMuted}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                maxLength={280}
              />
            </View>

            <View>
              <Text style={profileClassStyles.vehicleFormLabel}>Categoria</Text>
              <DropdownSelect
                options={CATEGORY_OPTIONS}
                selectedValue={categoria}
                onValueChange={(value) => setCategoria(value as ServiceCategoria)}
                modalTitle="Categoria do serviço"
                searchable
                variant="minimal"
              />
            </View>

            <View>
              <Text style={profileClassStyles.vehicleFormLabel}>WhatsApp de contato</Text>
              <TextInput
                style={profileClassStyles.input}
                placeholder="(11) 99999-9999"
                placeholderTextColor={MINIMAL_UI.textMuted}
                value={telefone}
                onChangeText={(value) => setTelefone(formatBrazilPhoneInput(value))}
                keyboardType="phone-pad"
                inputMode="tel"
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={profileClassStyles.vehicleFormLabel}>Publicar no Apoio Mútuo</Text>
                <Text style={profileClassStyles.sectionMeta}>
                  Só aparece para quem está nesta igreja
                </Text>
              </View>
              <Switch
                value={statusAtivo}
                onValueChange={setStatusAtivo}
                trackColor={{ false: MINIMAL_UI.divider, true: MINIMAL_UI.accent }}
                thumbColor={MINIMAL_UI.background}
              />
            </View>

            <TouchableOpacity
              style={[profileClassStyles.saveButton, busy && profileClassStyles.disabledButton]}
              onPress={() => void handleSave()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Salvar serviço"
            >
              {saving ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
              ) : (
                <Text style={profileClassStyles.saveButtonText}>Salvar serviço</Text>
              )}
            </TouchableOpacity>

            {serviceId ? (
              <TouchableOpacity
                style={[
                  profileClassStyles.cancelButton,
                  { borderColor: '#DC2626' },
                  busy && profileClassStyles.disabledButton,
                ]}
                onPress={() => void handleDelete()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Excluir oferta"
              >
                {deleting ? (
                  <ActivityIndicator color="#DC2626" size="small" />
                ) : (
                  <Text style={[profileClassStyles.cancelButtonText, { color: '#DC2626' }]}>
                    Excluir oferta
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
