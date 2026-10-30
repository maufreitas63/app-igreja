import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

type PlatformChoice = 'igreja' | 'ingles';

const NAVY = '#1E3A8A';
const CONTINUE = '#2F6FED';

export default function EscolhaPlataformaScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [selected, setSelected] = useState<PlatformChoice | null>(null);
  const [courseNotice, setCourseNotice] = useState<string | null>(null);

  const choose = (choice: PlatformChoice) => {
    setSelected(choice);
    setCourseNotice(null);
  };

  const continueWithSelection = () => {
    if (selected === 'igreja') {
      setCourseNotice(null);
      router.push({ pathname: '/', params: { portal: '1' } });
      return;
    }

    if (selected === 'ingles') {
      setCourseNotice('Abrir Curso');
    }
  };

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Bem-vindo ao seu novo portal</Text>
        <Text style={styles.subtitle}>Escolha sua plataforma</Text>

        <Pressable
          style={[styles.card, selected === 'igreja' ? styles.cardSelected : styles.cardIdle]}
          onPress={() => choose('igreja')}
          accessibilityRole="button"
          accessibilityLabel="Aplicativo da Igreja. Acesse sua comunidade local"
        >
          <Image
            source={require('../images/captura.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Conecta+"
          />
          <Text style={styles.cardTitle}>Aplicativo da Igreja</Text>
          <Text style={styles.cardSubtitle}>Acesse sua comunidade local</Text>
        </Pressable>

        <Pressable
          style={[styles.card, selected === 'ingles' ? styles.cardSelected : styles.cardIdle]}
          onPress={() => choose('ingles')}
          accessibilityRole="button"
          accessibilityLabel="Curso de Ingles atraves das Escrituras. Aprenda Inglês de Gênesis ao Apocalipse"
        >
          <Image
            source={require('../images/ingles-escrituras.png')}
            style={styles.courseIcon}
            contentFit="contain"
            accessibilityLabel="Curso de Ingles atraves das Escrituras"
          />
          <Text style={styles.cardTitle}>Curso de Ingles atraves das Escrituras</Text>
          <Text style={styles.cardSubtitle}>Aprenda Inglês de Gênesis ao Apocalipse</Text>
        </Pressable>

        <Pressable
          style={styles.continueButton}
          onPress={continueWithSelection}
          accessibilityRole="button"
          accessibilityLabel="Selecionar e continuar"
        >
          <Text style={styles.continueLabel}>Selecionar & Continuar</Text>
        </Pressable>

        {courseNotice ? <Text style={styles.notice}>{courseNotice}</Text> : null}

        <Text style={styles.footnote}>Suas credenciais serão gerenciadas centralmente</Text>
      </ScrollView>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    color: NAVY,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
  },
  subtitle: {
    color: '#3B4F93',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  cardIdle: {
    backgroundColor: '#F7F6EF',
    borderColor: '#E4DECF',
  },
  cardSelected: {
    backgroundColor: '#D6E6F8',
    borderColor: '#8FB4E0',
  },
  logo: {
    width: 148,
    height: 92,
    marginBottom: 8,
  },
  courseIcon: {
    width: 108,
    height: 108,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#24315C',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardSubtitle: {
    color: '#4B5568',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: CONTINUE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  continueLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  notice: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  footnote: {
    color: '#8B93A7',
    fontSize: 13,
    textAlign: 'center',
  },
});
