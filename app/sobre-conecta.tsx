import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { loadConectaAboutInfo } from '@/lib/conectaAbout';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function SobreConectaScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('—');
  const [revision, setRevision] = useState('—');

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
    <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
      <Text style={styles.title}>Sobre o Conecta+</Text>

      {loading ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : (
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
          <Text style={styles.brand}>Conecta+</Text>
          <Text style={styles.meta}>
            Versão {version} (Revisão: {revision})
          </Text>
        </View>
      )}
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
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
