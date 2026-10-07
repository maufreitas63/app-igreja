import { InstanceQrCode } from '@/components/InstanceQrCode';
import {
  buildAliancaIndicationInviteMessage,
  buildAliancaIndicationUrl,
} from '@/lib/alianca/indicationForm';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredActiveIgrejaBranding, getStoredTenantId } from '@/lib/tenantSession';
import { normalizePhoneForWhatsApp, openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

export function AliancaIndicationQrSection() {
  const [tenantId, setTenantId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [churchName, setChurchName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [profile, branding, storedTenant] = await Promise.all([
        loadEffectiveSessionProfile(),
        getStoredActiveIgrejaBranding(),
        getStoredTenantId(),
      ]);
      if (cancelled) return;
      if (storedTenant) setTenantId(storedTenant);
      if (profile?.id) setProfileId(profile.id);
      const church = branding?.name?.trim() || branding?.code?.trim() || '';
      if (church) setChurchName(church);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formUrl = useMemo(() => {
    if (!tenantId || !profileId) return '';
    return buildAliancaIndicationUrl(tenantId, profileId);
  }, [profileId, tenantId]);

  const handleClearInvite = () => {
    setInviteName('');
    setInvitePhone('');
  };

  const handleShareInvite = () => {
    const guestName = inviteName.trim();
    if (guestName.length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Convite WhatsApp',
        text2: 'Informe o nome de quem vai receber o convite.',
      });
      return;
    }

    const whatsappPhone = normalizePhoneForWhatsApp(invitePhone);
    if (!whatsappPhone || whatsappPhone.length < 12) {
      Toast.show({
        type: 'error',
        text1: 'Convite WhatsApp',
        text2: 'Informe o celular com DDD (ex.: (11) 98765-4321).',
      });
      return;
    }

    if (!tenantId || !profileId) {
      Toast.show({
        type: 'error',
        text1: 'Convite WhatsApp',
        text2: 'Abra esta tela dentro da igreja que indica para montar o link.',
      });
      return;
    }

    const pageUrl = buildAliancaIndicationUrl(tenantId, profileId, {
      guestName,
      phone: invitePhone,
    });
    const message = buildAliancaIndicationInviteMessage(pageUrl, churchName, guestName);
    const opened = openWhatsAppLikeBirthdaysWithText(invitePhone, message);
    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o WhatsApp.',
      });
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Indicar uma igreja</Text>
      <Text style={styles.hint}>
        Mostre este QR Code à pessoa da igreja indicada. Ao ler, ela abre o formulário, preenche e
        envia. A indicação entra no funil de Indicados.
      </Text>
      {formUrl ? (
        <InstanceQrCode
          url={formUrl}
          title={churchName || null}
          caption="Escaneie para preencher o formulário da Aliança"
          size={168}
          compact
        />
      ) : (
        <Text style={styles.hint}>Abra esta tela dentro da igreja que indica para gerar o QR Code.</Text>
      )}

      <Text style={styles.inviteHint}>
        Se preferir enviar o link, informe o nome e o celular com DDD. O WhatsApp abre a conversa
        com o texto e o formulário.
      </Text>
      <View style={styles.inviteFields}>
        <TextInput
          value={inviteName}
          onChangeText={setInviteName}
          placeholder="Nome de quem recebe"
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          style={[styles.inviteInput, styles.inviteNameInput]}
        />
        <TextInput
          value={invitePhone}
          onChangeText={(value) => setInvitePhone(formatBrazilPhoneInput(value))}
          placeholder="(11) 98765-4321"
          placeholderTextColor={MINIMAL_UI.textMuted}
          keyboardType="phone-pad"
          inputMode="tel"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          style={[styles.inviteInput, styles.invitePhoneInput]}
        />
        <TouchableOpacity
          onPress={handleClearInvite}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Limpar nome e celular"
          style={styles.inviteClearButton}
        >
          <MaterialIcons name="close" size={18} color={MINIMAL_UI.icon} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.whatsappButton}
        onPress={handleShareInvite}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="WhatsApp — convite"
      >
        <MaterialIcons name="chat" size={18} color={MINIMAL_UI.icon} />
        <Text style={styles.whatsappButtonText}>WhatsApp — convite</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    paddingHorizontal: 0,
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  inviteHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  inviteFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  inviteInput: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 140,
  },
  inviteNameInput: {
    flexGrow: 1,
    flexShrink: 1,
  },
  invitePhoneInput: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 180,
  },
  inviteClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  whatsappButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
