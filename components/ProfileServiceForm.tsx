import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { profileClassStyles } from '@/lib/manageProfile/profileClassStyles';
import {
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

/** Cadastro do serviço oferecido — seção de Dados Cadastrais, só desta igreja. */
export function ProfileServiceForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<ServiceCategoria>('outros');
  const [statusAtivo, setStatusAtivo] = useState(false);
  const [telefone, setTelefone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const service = await fetchMyProfileService();
      setTitulo(service?.tituloServico ?? '');
      setDescricao(service?.descricaoServico ?? '');
      setCategoria(service?.categoria ?? 'outros');
      setStatusAtivo(service?.statusAtivo ?? false);
      setTelefone(formatBrazilPhoneInput(service?.telefoneContato ?? ''));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Serviço no mural',
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
        text1: 'Serviço no mural',
        text2: result.message,
      });

      if (result.success) {
        await load();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Serviço no mural',
        text2: error instanceof Error ? error.message : 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={profileClassStyles.sectionCard}>
      <View style={profileClassStyles.sectionHeader}>
        <View>
          <Text style={profileClassStyles.sectionTitle}>Serviço no mural</Text>
          <Text style={profileClassStyles.sectionMeta}>
            Cartão de visitas desta igreja
            {statusAtivo ? ` · ${SERVICE_CATEGORIA_LABEL[categoria]}` : ' · inativo'}
          </Text>
        </View>
        <MaterialIcons name="badge" size={22} color={MINIMAL_UI.blueDark} />
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
              <Text style={profileClassStyles.vehicleFormLabel}>Publicar no mural</Text>
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
            style={[profileClassStyles.saveButton, saving && profileClassStyles.disabledButton]}
            onPress={() => void handleSave()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Salvar serviço no mural"
          >
            {saving ? (
              <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
            ) : (
              <Text style={profileClassStyles.saveButtonText}>Salvar serviço</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
