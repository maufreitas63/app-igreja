import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useIgrejasAdminAccess } from '@/hooks/useIgrejasAdminAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
  withMinimalPresentation,
} from '@/lib/dashboardReturnNavigation';
import { pickChurchLogoFromGallery, saveChurchLogoForTenant } from '@/lib/churchLogo';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  activateSessionTenant,
  deleteIgrejaAdmin,
  getStoredTenantId,
  listAdminIgrejas,
  onboardIgrejaAdmin,
  setIgrejaActiveAdmin,
  setIgrejaOfferingsAdmin,
  setIgrejaSocialLinksAdmin,
  type SessionIgreja,
} from '@/lib/tenantSession';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type SocialDraft = { website: string; instagram: string; youtube: string };
type OfferingsDraft = { cnpj: string; pixInstitution: string; pixKey: string };

function isProtectedDefaultChurch(church: SessionIgreja) {
  return church.code.trim().toUpperCase() === 'IBN';
}

function IgrejasAdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [churches, setChurches] = useState<SessionIgreja[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createWebsite, setCreateWebsite] = useState('');
  const [createInstagram, setCreateInstagram] = useState('');
  const [createYoutube, setCreateYoutube] = useState('');
  const [createCnpj, setCreateCnpj] = useState('');
  const [createPixInstitution, setCreatePixInstitution] = useState('');
  const [createPixKey, setCreatePixKey] = useState('');
  const [socialDrafts, setSocialDrafts] = useState<Record<string, SocialDraft>>({});
  const [offeringsDrafts, setOfferingsDrafts] = useState<Record<string, OfferingsDraft>>({});
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [deleteConfirmById, setDeleteConfirmById] = useState<Record<string, string>>({});

  const syncSocialDrafts = useCallback((rows: SessionIgreja[]) => {
    const nextSocial: Record<string, SocialDraft> = {};
    const nextOfferings: Record<string, OfferingsDraft> = {};
    for (const church of rows) {
      nextSocial[church.id] = {
        website: church.website_url ?? '',
        instagram: church.instagram_url ?? '',
        youtube: church.youtube_url ?? '',
      };
      nextOfferings[church.id] = {
        cnpj: church.cnpj ?? '',
        pixInstitution: church.pix_institution ?? '',
        pixKey: church.pix_key ?? '',
      };
    }
    setSocialDrafts(nextSocial);
    setOfferingsDrafts(nextOfferings);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, storedTenantId] = await Promise.all([listAdminIgrejas(), getStoredTenantId()]);
      setChurches(rows);
      syncSocialDrafts(rows);
      setActiveTenantId(storedTenantId);
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Não foi possível listar as igrejas. Execute o script multi-tenant-24 no Supabase.';
      Toast.show({
        type: 'error',
        text1: 'Instâncias',
        text2: detail.slice(0, 160),
      });
    } finally {
      setLoading(false);
    }
  }, [syncSocialDrafts]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePickCreateLogo = async () => {
    try {
      const uri = await pickChurchLogoFromGallery();
      if (uri) {
        setLogoPreview(uri);
      }
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Logo',
        text2: error instanceof Error ? error.message : 'Não foi possível selecionar a imagem.',
      });
    }
  };

  const openEdit = (church: SessionIgreja) => {
    setEditingId(church.id);
    setEditLogoPreview(null);
    setSocialDrafts((prev) => ({
      ...prev,
      [church.id]: {
        website: church.website_url ?? '',
        instagram: church.instagram_url ?? '',
        youtube: church.youtube_url ?? '',
      },
    }));
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditLogoPreview(null);
  };

  const handlePickEditLogo = async () => {
    try {
      const uri = await pickChurchLogoFromGallery();
      if (uri) {
        setEditLogoPreview(uri);
      }
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Logo',
        text2: error instanceof Error ? error.message : 'Não foi possível selecionar a imagem.',
      });
    }
  };

  const handleSaveEdit = async (church: SessionIgreja) => {
    const draft = socialDrafts[church.id] ?? { website: '', instagram: '', youtube: '' };
    const offerings =
      offeringsDrafts[church.id] ?? { cnpj: '', pixInstitution: '', pixKey: '' };
    setEditBusy(true);
    try {
      if (editLogoPreview) {
        await saveChurchLogoForTenant(church.id, editLogoPreview);
      }

      const social = await setIgrejaSocialLinksAdmin(
        church.id,
        draft.website,
        draft.instagram,
        draft.youtube
      );
      if (!social?.success) {
        Toast.show({
          type: 'error',
          text1: 'Editar instância',
          text2: social?.message || 'Não foi possível salvar as redes sociais.',
        });
        if (editLogoPreview) {
          await load();
        }
        return;
      }

      const offeringsResult = await setIgrejaOfferingsAdmin(
        church.id,
        offerings.cnpj,
        offerings.pixInstitution,
        offerings.pixKey
      );
      if (!offeringsResult?.success) {
        Toast.show({
          type: 'error',
          text1: 'Editar instância',
          text2:
            offeringsResult?.message ||
            'Redes salvas, mas os dados de dízimos/ofertas falharam.',
        });
        await load();
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Instância atualizada',
        text2: `${church.name}: logo, redes e ofertas salvos.`,
      });
      closeEdit();
      await load();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Editar instância',
        text2: error instanceof Error ? error.message : 'Falha ao salvar.',
      });
    } finally {
      setEditBusy(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await onboardIgrejaAdmin(code, name);
      if (!result?.success) {
        Toast.show({
          type: 'error',
          text1: 'Nova instância',
          text2: result?.message || 'Não foi possível criar.',
        });
        return;
      }

      const tenantId = typeof result.tenant_id === 'string' ? result.tenant_id.trim() : '';
      if (logoPreview && tenantId) {
        try {
          await saveChurchLogoForTenant(tenantId, logoPreview);
        } catch (logoError) {
          console.error(logoError);
          Toast.show({
            type: 'error',
            text1: 'Instância criada',
            text2:
              logoError instanceof Error
                ? `Igreja ok, mas o logo falhou: ${logoError.message}`
                : 'Igreja ok, mas o logo não foi salvo. Use Editar na lista.',
          });
        }
      }

      if (tenantId && (createWebsite.trim() || createInstagram.trim() || createYoutube.trim())) {
        const social = await setIgrejaSocialLinksAdmin(
          tenantId,
          createWebsite,
          createInstagram,
          createYoutube
        );
        if (!social?.success) {
          Toast.show({
            type: 'error',
            text1: 'Instância criada',
            text2: social?.message || 'Links sociais não foram salvos. Use Editar na lista.',
          });
        }
      }

      if (
        tenantId &&
        (createCnpj.trim() || createPixInstitution.trim() || createPixKey.trim())
      ) {
        const offerings = await setIgrejaOfferingsAdmin(
          tenantId,
          createCnpj,
          createPixInstitution,
          createPixKey
        );
        if (!offerings?.success) {
          Toast.show({
            type: 'error',
            text1: 'Instância criada',
            text2:
              offerings?.message ||
              'Dados de dízimos/ofertas não foram salvos. Use Editar na lista.',
          });
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Instância criada',
        text2: result.message || `${result.code} pronta.`,
      });
      setCode('');
      setName('');
      setLogoPreview(null);
      setCreateWebsite('');
      setCreateInstagram('');
      setCreateYoutube('');
      setCreateCnpj('');
      setCreatePixInstitution('');
      setCreatePixKey('');
      await load();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? String((error as { message: string }).message)
            : 'Erro inesperado.';
      Toast.show({
        type: 'error',
        text1: 'Nova instância',
        text2: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = async (church: SessionIgreja) => {
    if (!church.is_active) {
      Toast.show({
        type: 'error',
        text1: 'Instância bloqueada',
        text2: 'Desbloqueie o acesso antes de usar esta igreja.',
      });
      return;
    }
    const result = await activateSessionTenant(church.id, church);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Trocar igreja', text2: result.message });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'Igreja ativa',
      text2: church.name,
    });
    router.replace({
      pathname: '/(tabs)',
      params: withMinimalPresentation(),
    });
  };

  const handleToggleActive = (church: SessionIgreja) => {
    if (isProtectedDefaultChurch(church)) {
      Toast.show({
        type: 'error',
        text1: 'Instância protegida',
        text2: 'A IBN não pode ser bloqueada.',
      });
      return;
    }

    const nextActive = !church.is_active;
    const title = nextActive ? 'Liberar acesso' : 'Bloquear acesso';
    const message = nextActive
      ? `Liberar o acesso dos usuários à instância ${church.name}?`
      : `Bloquear o acesso dos usuários à instância ${church.name}? Eles não poderão selecioná-la até liberar.`;

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: nextActive ? 'Liberar' : 'Bloquear',
        style: nextActive ? 'default' : 'destructive',
        onPress: () => {
          void (async () => {
            setEditBusy(true);
            try {
              const result = await setIgrejaActiveAdmin(church.id, nextActive);
              if (!result?.success) {
                Toast.show({
                  type: 'error',
                  text1: title,
                  text2: result?.message || 'Não foi possível atualizar.',
                });
                return;
              }
              Toast.show({
                type: 'success',
                text1: title,
                text2: result.message || church.name,
              });
              await load();
            } catch (error) {
              console.error(error);
              Toast.show({
                type: 'error',
                text1: title,
                text2: error instanceof Error ? error.message : 'Falha ao atualizar.',
              });
            } finally {
              setEditBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const handleDelete = (church: SessionIgreja) => {
    if (isProtectedDefaultChurch(church)) {
      Toast.show({
        type: 'error',
        text1: 'Instância protegida',
        text2: 'A IBN não pode ser excluída.',
      });
      return;
    }

    const typed = (deleteConfirmById[church.id] ?? '').trim();
    if (typed.toUpperCase() !== church.code.trim().toUpperCase()) {
      Toast.show({
        type: 'error',
        text1: 'Confirmação',
        text2: `Digite o código ${church.code} para confirmar a exclusão.`,
      });
      return;
    }

    Alert.alert(
      'Excluir instância',
      `Isto apaga ${church.name} e todos os dados dependentes (membros, eventos, parâmetros, etc.). Não tem volta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir definitivamente',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setEditBusy(true);
              try {
                const result = await deleteIgrejaAdmin(church.id, typed);
                if (!result?.success) {
                  Toast.show({
                    type: 'error',
                    text1: 'Excluir instância',
                    text2: result?.message || 'Não foi possível excluir.',
                  });
                  return;
                }
                Toast.show({
                  type: 'success',
                  text1: 'Instância excluída',
                  text2: result.message || church.code,
                });
                closeEdit();
                setDeleteConfirmById((prev) => {
                  const next = { ...prev };
                  delete next[church.id];
                  return next;
                });
                await load();
              } catch (error) {
                console.error(error);
                Toast.show({
                  type: 'error',
                  text1: 'Excluir instância',
                  text2: error instanceof Error ? error.message : 'Falha ao excluir.',
                });
              } finally {
                setEditBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Instâncias (igrejas)</Text>
      <Text style={styles.hint}>
        Super administrador: crie novas instâncias e alterne entre elas com o mesmo celular.
      </Text>

      <Text style={styles.section}>Instâncias disponíveis</Text>
      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} />
      ) : churches.length === 0 ? (
        <Text style={styles.emptyList}>
          Nenhuma instância listada. Execute no Supabase o script
          multi-tenant-24-list-igrejas-fix.sql e faça hard refresh.
        </Text>
      ) : (
        <View style={styles.list}>
          {churches.map((church) => {
            const isEditing = editingId === church.id;
            const draft = socialDrafts[church.id] ?? { website: '', instagram: '', youtube: '' };
            const offeringsDraft =
              offeringsDrafts[church.id] ?? { cnpj: '', pixInstitution: '', pixKey: '' };
            const previewUri = editLogoPreview || church.logo_url;
            const isSessionChurch = activeTenantId
              ? church.id === activeTenantId
              : church.is_primary;

            return (
              <View key={church.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <View style={styles.rowLogoBox}>
                    {church.logo_url ? (
                      <Image
                        source={{ uri: church.logo_url }}
                        style={styles.rowLogo}
                        contentFit="contain"
                      />
                    ) : (
                      <Text style={styles.rowLogoFallback}>{church.code.slice(0, 3) || '?'}</Text>
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{church.name}</Text>
                    <Text style={styles.rowCode}>{church.code}</Text>
                  </View>
                  <View style={styles.badgeColumn}>
                    {isSessionChurch ? <Text style={styles.badge}>Sessão</Text> : null}
                    {!church.is_active ? (
                      <Text style={[styles.badge, styles.badgeBlocked]}>Bloqueada</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.rowActions}>
                  {!isSessionChurch && church.is_active ? (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => void handleSwitch(church)}
                      disabled={editBusy}
                    >
                      <Text style={styles.actionButtonText}>Usar</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                    onPress={() => (isEditing ? closeEdit() : openEdit(church))}
                    disabled={editBusy}
                    accessibilityLabel={`Editar ${church.name}`}
                  >
                    <Text style={[styles.actionButtonText, styles.actionButtonPrimaryText]}>
                      {isEditing ? 'Fechar' : 'Editar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isEditing ? (
                  <View style={styles.editPanel}>
                    <Text style={styles.editTitle}>Logo, redes e dízimos/ofertas</Text>

                    <Text style={styles.socialFieldLabel}>Logo</Text>
                    <View style={styles.logoRow}>
                      <View style={styles.logoPreviewBox}>
                        {previewUri ? (
                          <Image
                            source={{ uri: previewUri }}
                            style={styles.logoPreview}
                            contentFit="contain"
                          />
                        ) : (
                          <Text style={styles.logoPlaceholder}>Sem logo</Text>
                        )}
                      </View>
                      <View style={styles.logoActions}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => void handlePickEditLogo()}
                          disabled={editBusy}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {previewUri ? 'Trocar logo' : 'Escolher logo'}
                          </Text>
                        </TouchableOpacity>
                        {editLogoPreview ? (
                          <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => setEditLogoPreview(null)}
                            disabled={editBusy}
                          >
                            <Text style={styles.linkButtonText}>Desfazer escolha</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.socialFieldLabel}>Site oficial (URL)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.website}
                      onChangeText={(value) =>
                        setSocialDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...draft, website: value },
                        }))
                      }
                      placeholder="https://www.suaigreja.org.br"
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      editable={!editBusy}
                    />
                    <Text style={styles.socialFieldLabel}>Instagram (URL)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.instagram}
                      onChangeText={(value) =>
                        setSocialDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...draft, instagram: value },
                        }))
                      }
                      placeholder="https://www.instagram.com/..."
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      editable={!editBusy}
                    />
                    <Text style={styles.socialFieldLabel}>YouTube (URL)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.youtube}
                      onChangeText={(value) =>
                        setSocialDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...draft, youtube: value },
                        }))
                      }
                      placeholder="https://www.youtube.com/..."
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      editable={!editBusy}
                    />

                    <Text style={styles.socialFieldLabel}>CNPJ (dízimos/ofertas)</Text>
                    <TextInput
                      style={styles.input}
                      value={offeringsDraft.cnpj}
                      onChangeText={(value) =>
                        setOfferingsDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...offeringsDraft, cnpj: value },
                        }))
                      }
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!editBusy}
                    />
                    <Text style={styles.socialFieldLabel}>Instituição PIX</Text>
                    <TextInput
                      style={styles.input}
                      value={offeringsDraft.pixInstitution}
                      onChangeText={(value) =>
                        setOfferingsDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...offeringsDraft, pixInstitution: value },
                        }))
                      }
                      placeholder="Nome do banco / cooperativa"
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!editBusy}
                    />
                    <Text style={styles.socialFieldLabel}>Chave PIX</Text>
                    <TextInput
                      style={styles.input}
                      value={offeringsDraft.pixKey}
                      onChangeText={(value) =>
                        setOfferingsDrafts((prev) => ({
                          ...prev,
                          [church.id]: { ...offeringsDraft, pixKey: value },
                        }))
                      }
                      placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                      placeholderTextColor={MINIMAL_UI.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!editBusy}
                    />

                    <TouchableOpacity
                      style={[styles.button, editBusy && styles.buttonDisabled]}
                      onPress={() => void handleSaveEdit(church)}
                      disabled={editBusy}
                    >
                      {editBusy ? (
                        <ActivityIndicator color={MINIMAL_UI.onDark} />
                      ) : (
                        <Text style={styles.buttonText}>Salvar alterações</Text>
                      )}
                    </TouchableOpacity>

                    {!isProtectedDefaultChurch(church) ? (
                      <View style={styles.dangerZone}>
                        <Text style={styles.dangerTitle}>Acesso e exclusão</Text>
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            !church.is_active && styles.secondaryButtonSuccess,
                            editBusy && styles.buttonDisabled,
                          ]}
                          onPress={() => handleToggleActive(church)}
                          disabled={editBusy}
                        >
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              !church.is_active && styles.secondaryButtonSuccessText,
                            ]}
                          >
                            {church.is_active ? 'Bloquear acesso' : 'Liberar acesso'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.dangerHint}>
                          Bloquear impede que usuários selecionem esta instância. Os dados
                          permanecem.
                        </Text>

                        <Text style={styles.socialFieldLabel}>
                          Excluir — digite {church.code} para confirmar
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={deleteConfirmById[church.id] ?? ''}
                          onChangeText={(value) =>
                            setDeleteConfirmById((prev) => ({
                              ...prev,
                              [church.id]: value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                            }))
                          }
                          placeholder={church.code}
                          placeholderTextColor={MINIMAL_UI.textMuted}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          editable={!editBusy}
                        />
                        <TouchableOpacity
                          style={[styles.dangerButton, editBusy && styles.buttonDisabled]}
                          onPress={() => handleDelete(church)}
                          disabled={editBusy}
                        >
                          <Text style={styles.dangerButtonText}>Excluir instância e dados</Text>
                        </TouchableOpacity>
                        <Text style={styles.dangerHint}>
                          Apaga a igreja e informações dependentes. Irreversível. A IBN não
                          pode ser excluída.
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.dangerHint}>
                        Instância padrão (IBN): não pode ser bloqueada nem excluída.
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      <Text style={[styles.section, styles.sectionCreate]}>Nova instância</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Código (ex.: IBC)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12))}
          placeholder="CODIGO"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Nome da igreja</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nome oficial"
          placeholderTextColor={MINIMAL_UI.textMuted}
        />

        <Text style={styles.label}>Logo da igreja (usado no app)</Text>
        <View style={styles.logoRow}>
          <View style={styles.logoPreviewBox}>
            {logoPreview ? (
              <Image source={{ uri: logoPreview }} style={styles.logoPreview} contentFit="contain" />
            ) : (
              <Text style={styles.logoPlaceholder}>Sem logo</Text>
            )}
          </View>
          <View style={styles.logoActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void handlePickCreateLogo()}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>
                {logoPreview ? 'Trocar imagem' : 'Escolher logo'}
              </Text>
            </TouchableOpacity>
            {logoPreview ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setLogoPreview(null)}
                disabled={saving}
              >
                <Text style={styles.linkButtonText}>Remover</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <Text style={styles.logoHint}>
          PNG ou JPG. Aparece no topo do app quando esta instância estiver ativa.
        </Text>

        <Text style={styles.label}>Site oficial (URL)</Text>
        <TextInput
          style={styles.input}
          value={createWebsite}
          onChangeText={setCreateWebsite}
          placeholder="https://www.suaigreja.org.br"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.label}>Instagram (URL)</Text>
        <TextInput
          style={styles.input}
          value={createInstagram}
          onChangeText={setCreateInstagram}
          placeholder="https://www.instagram.com/..."
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.label}>YouTube (URL)</Text>
        <TextInput
          style={styles.input}
          value={createYoutube}
          onChangeText={setCreateYoutube}
          placeholder="https://www.youtube.com/..."
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.logoHint}>
          Site e redes usados no menu Redes Sociais quando esta instância estiver ativa.
        </Text>

        <Text style={styles.label}>CNPJ (dízimos/ofertas)</Text>
        <TextInput
          style={styles.input}
          value={createCnpj}
          onChangeText={setCreateCnpj}
          placeholder="00.000.000/0000-00"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Instituição PIX</Text>
        <TextInput
          style={styles.input}
          value={createPixInstitution}
          onChangeText={setCreatePixInstitution}
          placeholder="Nome do banco / cooperativa"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Text style={styles.label}>Chave PIX</Text>
        <TextInput
          style={styles.input}
          value={createPixKey}
          onChangeText={setCreatePixKey}
          placeholder="CNPJ, e-mail, telefone ou chave aleatória"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.logoHint}>
          Dados exibidos na tela Dízimos e Ofertas desta instância.
        </Text>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={() => void handleCreate()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={MINIMAL_UI.onDark} />
          ) : (
            <Text style={styles.buttonText}>Criar instância</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

export default function IgrejasScreen() {
  const accessStatus = useIgrejasAdminAccess();
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <IgrejasAdminPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  form: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  label: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoPreviewBox: {
    width: 96,
    height: 56,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  logoActions: {
    flex: 1,
    gap: 6,
  },
  logoHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: MINIMAL_UI.text,
    fontWeight: '600',
    fontSize: 14,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  linkButtonText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionCreate: {
    marginTop: 28,
  },
  emptyList: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowLogoBox: {
    width: 48,
    height: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowLogo: {
    width: '100%',
    height: '100%',
  },
  rowLogoFallback: {
    color: MINIMAL_UI.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: MINIMAL_UI.text, fontWeight: '700', fontSize: 15 },
  rowCode: { color: MINIMAL_UI.textMuted, fontSize: 12 },
  badge: { color: MINIMAL_UI.accent, fontWeight: '700', fontSize: 12 },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badgeBlocked: {
    color: '#B42318',
  },
  rowActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: MINIMAL_UI.divider,
  },
  actionButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonPrimaryText: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  editPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    padding: 12,
    gap: 6,
  },
  editTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  socialFieldLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButtonSuccess: {
    borderColor: '#067647',
    backgroundColor: '#ECFDF3',
  },
  secondaryButtonSuccessText: {
    color: '#067647',
  },
  dangerZone: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    gap: 8,
  },
  dangerTitle: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
  },
  dangerHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#B42318',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
