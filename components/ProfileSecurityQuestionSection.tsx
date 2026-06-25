import { saveProfileSecurityQuestion } from '@/lib/passwordRecovery';
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
  initialSecurityQuestion?: string | null;
};

export function ProfileSecurityQuestionSection({
  expanded,
  onToggle,
  initialSecurityQuestion,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    const trimmed = initialSecurityQuestion?.trim() ?? '';
    setConfigured(trimmed.length > 0);
    setQuestion(trimmed);
  }, [initialSecurityQuestion]);

  const handleSave = useCallback(async () => {
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
      const result = await saveProfileSecurityQuestion(question, answer);

      if (!result.ok) {
        Alert.alert('Não foi possível salvar', result.message);
        return;
      }

      setConfigured(true);
      setQuestion(result.securityQuestion);
      setAnswer('');
      Alert.alert(
        'Pergunta salva',
        'Use esta pergunta e resposta na recuperação de senha, se esquecer o PIN.'
      );
    } finally {
      setSaving(false);
    }
  }, [answer, question]);

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
            A resposta não é exibida depois de salva. Maiúsculas e acentos são ignorados na
            validação.
          </Text>

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
});
