import {
  PASSWORD_RECOVERY_SQL_HINT,
  saveProfileSecurityQuestion,
} from '@/lib/passwordRecovery';
import { ACCESS_PIN_LENGTH } from '@/lib/accessPin';
import { MaterialIcons } from '@expo/vector-icons';
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

type Props = {
  expanded: boolean;
  onToggle: () => void;
  profilePhone: string;
  initialSecurityQuestion?: string | null;
};

export function ProfileSecurityQuestionSection({
  expanded,
  onToggle,
  profilePhone,
  initialSecurityQuestion,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [currentPin, setCurrentPin] = useState('');

  useEffect(() => {
    const trimmed = initialSecurityQuestion?.trim() ?? '';
    setConfigured(trimmed.length > 0);
    setCurrentQuestion(trimmed);
    setQuestion(trimmed);
  }, [initialSecurityQuestion]);

  const handleSave = useCallback(async () => {
    if (!profilePhone.trim()) {
      Alert.alert('Atenção', 'Telefone do perfil não encontrado.');
      return;
    }

    if (!/^\d{4}$/.test(currentPin.trim())) {
      Alert.alert('Atenção', 'Informe sua senha atual com 4 dígitos para salvar a pergunta.');
      return;
    }

    if (!question.trim()) {
      Alert.alert('Atenção', 'Informe a pergunta de segurança.');
      return;
    }

    if (!answer.trim()) {
      Alert.alert('Atenção', 'Informe a resposta da pergunta de segurança.');
      return;
    }

    setSaving(true);

    try {
      const result = await saveProfileSecurityQuestion(
        profilePhone,
        currentPin,
        question,
        answer
      );

      if (!result.ok) {
        Alert.alert('Não foi possível salvar', result.message);
        return;
      }

      setConfigured(true);
      setCurrentQuestion(result.securityQuestion);
      setAnswer('');
      setCurrentPin('');
      Alert.alert(
        'Pergunta salva',
        'Use esta pergunta e resposta na recuperação de senha, se esquecer o PIN.'
      );
    } finally {
      setSaving(false);
    }
  }, [answer, currentPin, profilePhone, question]);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.85}>
        <View>
          <Text style={styles.sectionTitle}>Pergunta de segurança</Text>
          <Text style={styles.sectionMeta}>
            {configured
              ? 'Cadastrada para recuperação de senha'
              : 'Necessária para recuperar a senha pelo celular'}
          </Text>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color="#CBD5E1"
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          {configured && currentQuestion ? (
            <Text style={styles.currentQuestionLabel}>Pergunta atual: {currentQuestion}</Text>
          ) : null}

          <Text style={styles.label}>Senha atual (4 dígitos)</Text>
          <TextInput
            style={[styles.input, styles.pinInput]}
            value={currentPin}
            onChangeText={(text) => setCurrentPin(text.replace(/\D/g, '').slice(0, ACCESS_PIN_LENGTH))}
            placeholder="0000"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            maxLength={ACCESS_PIN_LENGTH}
            textAlign="center"
            autoComplete="off"
            textContentType="none"
          />

          <Text style={styles.label}>Pergunta</Text>
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ex.: Qual o nome do seu primeiro animal de estimação?"
            placeholderTextColor="#64748b"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Resposta</Text>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Resposta secreta"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />

          <Text style={styles.hint}>
            A resposta é validada somente no servidor. Ela não aparece depois de salva.
          </Text>
          <Text style={styles.hint}>{PASSWORD_RECOVERY_SQL_HINT}</Text>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar pergunta de segurança</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  currentQuestionLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    backgroundColor: '#0f172a',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  pinInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '700',
  },
});
