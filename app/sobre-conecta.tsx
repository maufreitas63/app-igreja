import { ConectaPrivacyDeclarationModal } from '@/components/ConectaPrivacyDeclarationModal';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { loadConectaAboutInfo } from '@/lib/conectaAbout';
import { CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL } from '@/lib/conectaPrivacyDeclaration';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SobreConectaScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('—');
  const [revision, setRevision] = useState('—');
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const info = await loadConectaAboutInfo();
      setVersion(info.version);
      setRevision(info.revision);
    } catch (error) {
      console.error(error);
      setVersion('—');
      setRevision('—');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>Sobre o Conecta+</Text>
        <View style={styles.body}>
          <Text style={styles.paragraph}>
            O Conecta+ é a plataforma digital que integra a rotina, o cuidado e a administração da
            sua igreja em um só lugar. Com uma interface amigável e segura, o aplicativo oferece
            total autonomia no celular para você gerenciar seus dados familiares, realizar check-in
            automático nos cultos, acompanhar sua célula por proximidade geográfica, consultar
            prestações de contas e interagir com frentes de voluntariado.
          </Text>
          <Text style={styles.paragraph}>
            Um canal direto que elimina burocracias, protege suas informações sob rigorosos padrões
            de segurança jurídica (LGPD) e fortalece a nossa comunhão e transparência no dia a dia.
          </Text>
          <TouchableOpacity
            style={styles.privacyButton}
            onPress={() => setPrivacyVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL}
          >
            <Text style={styles.privacyButtonText}>{CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL}</Text>
          </TouchableOpacity>
          <Text style={styles.brand}>Conecta+</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
          ) : (
            <Text style={styles.meta}>
              Versão {version} (Revisão: {revision})
            </Text>
          )}
        </View>
      </ScrollView>

      <ConectaPrivacyDeclarationModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
      />
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  loader: {
    marginTop: 24,
  },
  body: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  paragraph: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    lineHeight: 22,
  },
  privacyButton: {
    marginTop: 4,
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  privacyButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  brand: {
    marginTop: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
});
