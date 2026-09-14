import { submitAliancaPartnerLead } from '@/lib/alianca/aliancaApi';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredActiveIgrejaBranding } from '@/lib/tenantSession';
import { normalizePhoneForWhatsApp, openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

function buildIndicationWhatsAppMessage(input: {
  indicatedName: string;
  referrerName: string;
  churchName: string;
}) {
  const indicated = input.indicatedName.trim() || 'olá';
  const referrer = input.referrerName.trim() || 'um líder';
  const church = input.churchName.trim() || 'nossa igreja';
  return (
    `Olá, ${indicated}! ` +
    `Você está sendo indicado(a) por ${referrer} (${church}) para conhecer o aplicativo Conecta+, ` +
    `uma plataforma para a gestão e a comunhão da igreja. ` +
    `Um representante da Conecta+ entrará em contato em breve.`
  );
}

export function AliancaIndicatePartnerSection() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [referrerName, setReferrerName] = useState('um líder');
  const [churchName, setChurchName] = useState('nossa igreja');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [profile, branding] = await Promise.all([
        loadEffectiveSessionProfile(),
        getStoredActiveIgrejaBranding(),
      ]);
      if (cancelled) return;
      const fullName = profile?.full_name?.trim();
      if (fullName) setReferrerName(fullName);
      const church = [branding?.name, branding?.code].filter(Boolean).join(' · ');
      if (church) setChurchName(church);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = () => {
    const indicatedName = name.trim();
    const indicatedRole = role.trim();
    const digits = phone.replace(/\D/g, '');

    if (indicatedName.length < 2) {
      Toast.show({ type: 'error', text1: 'Indicação', text2: 'Informe o nome do indicado.' });
      return;
    }
    if (indicatedRole.length < 2) {
      Toast.show({ type: 'error', text1: 'Indicação', text2: 'Informe a posição do indicado.' });
      return;
    }
    if (!normalizePhoneForWhatsApp(digits)) {
      Toast.show({
        type: 'error',
        text1: 'Indicação',
        text2: 'Informe um celular válido com DDD.',
      });
      return;
    }

    const message = buildIndicationWhatsAppMessage({
      indicatedName,
      referrerName,
      churchName,
    });
    const opened = openWhatsAppLikeBirthdaysWithText(digits, message);
    if (!opened) {
      Toast.show({
        type: 'error',
        text1: 'WhatsApp',
        text2: 'Não foi possível abrir o WhatsApp do indicado.',
      });
      return;
    }

    setBusy(true);
    void submitAliancaPartnerLead({
      indicatedName,
      indicatedRole,
      indicatedPhone: digits,
    })
      .then((result) => {
        Toast.show({
          type: result.success ? 'success' : 'error',
          text1: result.success ? 'Indicação enviada' : 'Indicação',
          text2: result.success
            ? 'O WhatsApp do indicado foi aberto com a mensagem.'
            : result.message,
        });
        if (result.success) {
          setName('');
          setRole('');
          setPhone('');
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Indique uma igreja parceira</Text>
      <Text style={styles.hint}>
        Informe o contato de quem pode conhecer o Conecta+. Ao enviar, o WhatsApp do indicado abre
        com a mensagem de apresentação.
      </Text>

      <Text style={styles.label}>Nome do indicado</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nome completo"
        placeholderTextColor={MINIMAL_UI.textMuted}
        autoCapitalize="words"
        editable={!busy}
      />

      <Text style={styles.label}>Posição do indicado</Text>
      <TextInput
        style={styles.input}
        value={role}
        onChangeText={setRole}
        placeholder="Pastor, presidente, líder..."
        placeholderTextColor={MINIMAL_UI.textMuted}
        autoCapitalize="sentences"
        editable={!busy}
      />

      <Text style={styles.label}>Celular do indicado</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={(value) => setPhone(formatBrazilPhoneInput(value))}
        placeholder="(00) 00000-0000"
        placeholderTextColor={MINIMAL_UI.textMuted}
        keyboardType="phone-pad"
        inputMode="tel"
        editable={!busy}
      />

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={busy}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Enviar indicação pelo WhatsApp"
      >
        {busy ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} />
        ) : (
          <Text style={styles.buttonText}>Enviar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.border,
    gap: 8,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    fontSize: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: MINIMAL_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '800',
  },
});
