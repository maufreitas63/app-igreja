import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { usePreAuthScreenPresence } from '@/hooks/usePreAuthScreenPresence';
import { useLocalSearchParams } from 'expo-router';
import { formatCep, lookupViaCep } from '@/lib/cepUtils';
import { formatBrazilCepInput, formatBrazilPhoneInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { supabase } from '@/lib/supabase';

function oneParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export default function AliancaIndicacaoScreen() {
  usePreAuthScreenPresence();
  const params = useLocalSearchParams<{
    igreja?: string | string[];
    responsavel?: string | string[];
    nome?: string | string[];
    celular?: string | string[];
  }>();
  const tenantId = oneParam(params.igreja);
  const referrerId = oneParam(params.responsavel);
  const [churchName, setChurchName] = useState('');
  const [contextError, setContextError] = useState('');
  const [loadingContext, setLoadingContext] = useState(true);
  const [name, setName] = useState(oneParam(params.nome));
  const [phone, setPhone] = useState(formatBrazilPhoneInput(oneParam(params.celular)));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [church, setChurch] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [cepStatus, setCepStatus] = useState('');
  const [members, setMembers] = useState('');
  const [systems, setSystems] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const linkReady = useMemo(
    () => /^[0-9a-f-]{36}$/i.test(tenantId) && /^[0-9a-f-]{36}$/i.test(referrerId),
    [referrerId, tenantId]
  );

  useEffect(() => {
    if (!linkReady) {
      setLoadingContext(false);
      setContextError('Abra o link completo do QR Code ou do WhatsApp.');
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_alianca_indication_context', {
        p_tenant_id: tenantId,
      });
      if (cancelled) return;
      const row = asRecord(data);
      if (rpcError || row?.success !== true) {
        setContextError(
          (typeof row?.message === 'string' && row.message)
            || rpcError?.message
            || 'Link de indicação inválido.'
        );
      } else {
        setChurchName(typeof row.church_name === 'string' ? row.church_name : '');
      }
      setLoadingContext(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [linkReady, tenantId]);

  useEffect(() => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepStatus('');
      return;
    }

    let cancelled = false;
    setCepStatus('Buscando endereço...');
    void lookupViaCep(digits).then((viaCep) => {
      if (cancelled) return;
      if (!viaCep) {
        setCepStatus('CEP não encontrado. Confira o número.');
        return;
      }
      setStreet(viaCep.logradouro?.trim() || '');
      setNeighborhood(viaCep.bairro?.trim() || '');
      setCity(viaCep.localidade?.trim() || '');
      setUf((viaCep.uf?.trim() || '').toUpperCase().slice(0, 2));
      setCepStatus('');
    });

    return () => {
      cancelled = true;
    };
  }, [cep]);

  const handleSend = () => {
    const membersCount = Number(members.replace(/\D/g, ''));
    if (!Number.isFinite(membersCount) || membersCount < 1) {
      setError('Informe o número aproximado de membros.');
      return;
    }
    const cepDigits = cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setError('Informe o CEP da igreja com 8 números.');
      return;
    }
    if (!city.trim() || uf.trim().length !== 2) {
      setError('Aguarde o CEP completar cidade e UF, ou confira o número.');
      return;
    }
    const churchAddress = [
      formatCep(cepDigits),
      [street.trim(), addressNumber.trim()].filter(Boolean).join(', '),
      neighborhood.trim(),
    ]
      .filter(Boolean)
      .join(' — ');
    setBusy(true);
    setError('');
    void supabase
      .rpc('submit_alianca_indication_form', {
        p_tenant_id: tenantId,
        p_referrer_profile_id: referrerId,
        p_indicated_name: name.trim(),
        p_indicated_phone: phone,
        p_indicated_role: role.trim(),
        p_indicated_church_name: church.trim(),
        p_church_address: churchAddress,
        p_city: city.trim(),
        p_uf: uf.trim().toUpperCase(),
        p_estimated_members: membersCount,
        p_contact_email: email.trim(),
        p_current_systems: systems.trim(),
      })
      .then(({ data, error: rpcError }) => {
        const row = asRecord(data);
        if (rpcError || row?.success !== true) {
          setError(
            (typeof row?.message === 'string' && row.message)
              || rpcError?.message
              || 'Não foi possível enviar o formulário.'
          );
          return;
        }
        setSent(true);
      })
      .finally(() => setBusy(false));
  };

  if (loadingContext) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={MINIMAL_UI.accent} />
      </View>
    );
  }

  if (contextError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Formulário indisponível</Text>
        <Text style={styles.hint}>{contextError}</Text>
      </View>
    );
  }

  if (sent) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Formulário enviado</Text>
        <Text style={styles.hint}>
          A equipe Conecta+ recebeu os dados da sua igreja e vai dar continuidade ao contato.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>{churchName || 'Conecta+'}</Text>
      <Text style={styles.title}>Formulário da igreja indicada</Text>
      <Text style={styles.hint}>
        Preencha os dados da sua igreja e envie. As informações entram para a equipe Conecta+.
      </Text>

      <Field label="Nome completo" value={name} onChangeText={setName} placeholder="Seu nome" />
      <Field
        label="Celular"
        value={phone}
        onChangeText={(value) => setPhone(formatBrazilPhoneInput(value))}
        placeholder="(11) 98765-4321"
        keyboardType="phone-pad"
      />
      <Field
        label="E-mail para contato"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@igreja.org"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Posição ou cargo na igreja"
        value={role}
        onChangeText={setRole}
        placeholder="Pastor, presidente, líder..."
      />
      <Field label="Nome da igreja" value={church} onChangeText={setChurch} placeholder="Nome da igreja" />
      <Field
        label="CEP da igreja"
        value={cep}
        onChangeText={(value) => setCep(formatBrazilCepInput(value))}
        placeholder="00000-000"
        keyboardType="number-pad"
      />
      {cepStatus ? <Text style={styles.cepStatus}>{cepStatus}</Text> : null}
      <Field
        label="Logradouro"
        value={street}
        onChangeText={setStreet}
        placeholder="Rua, avenida..."
      />
      <Field
        label="Número"
        value={addressNumber}
        onChangeText={setAddressNumber}
        placeholder="100"
        keyboardType="number-pad"
      />
      <Field
        label="Bairro"
        value={neighborhood}
        onChangeText={setNeighborhood}
        placeholder="Bairro"
      />
      <Field label="Cidade" value={city} onChangeText={setCity} placeholder="Cidade" />
      <Field
        label="UF"
        value={uf}
        onChangeText={(value) => setUf(value.toUpperCase().slice(0, 2))}
        placeholder="SP"
        autoCapitalize="characters"
      />
      <Field
        label="Número aproximado de membros"
        value={members}
        onChangeText={(value) => setMembers(value.replace(/\D/g, ''))}
        placeholder="120"
        keyboardType="number-pad"
      />
      <Field
        label="Sistemas que a igreja usa hoje"
        value={systems}
        onChangeText={setSystems}
        placeholder="Planilha, ERP, outro aplicativo (opcional)"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Enviar formulário"
      >
        {busy ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} />
        ) : (
          <Text style={styles.buttonText}>Enviar</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MINIMAL_UI.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    gap: 10,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  eyebrow: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  field: {
    gap: 4,
  },
  label: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  cepStatus: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: -4,
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
    fontSize: 16,
    fontWeight: '800',
  },
});
