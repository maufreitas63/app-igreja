import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { ghostPassScreenAccess } from '@/lib/ghostNavigation';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { effectiveProfileHasMemberRole } from '@/lib/memberRoleAccess';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  formatOfficialDocumentDate,
  listOfficialDocuments,
  OFFICIAL_DOCUMENT_KIND_LABEL,
  type OfficialDocument,
} from '@/lib/officialDocuments';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DENIED_MESSAGE = 'Apenas membros podem ver os documentos oficiais da igreja.';

function useMemberDocumentsAccess(): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (ghostPassScreenAccess()) {
          if (active) setStatus('allowed');
          return;
        }

        const allowed = await effectiveProfileHasMemberRole();

        if (!active) {
          return;
        }

        if (!allowed) {
          setStatus('denied');
          denyScreenAccessAndRedirect(router, MEMBER_HOME_PATH, 'Acesso negado', DENIED_MESSAGE);
          return;
        }

        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [router])
  );

  return status;
}

export default function DocumentosOficiaisScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useMemberDocumentsAccess();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<OfficialDocument[]>([]);

  const load = useCallback(async () => {
    if (accessStatus !== 'allowed') {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setDocuments(await listOfficialDocuments());
    } catch (loadError) {
      setDocuments([]);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }, [accessStatus]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <KnowledgeSectionTitle
          title="Documentos oficiais"
          routeKey={KNOWLEDGE_ROUTE.documentosOficiais}
          titleStyle={styles.title}
        />
        <Text style={styles.hint}>Atas de assembleia e demais documentos oficiais desta igreja.</Text>

        {loading ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : documents.length === 0 ? (
          <Text style={styles.empty}>Nenhum documento oficial publicado nesta igreja.</Text>
        ) : (
          <View style={styles.list}>
            {documents.map((document) => {
              const dateLabel = formatOfficialDocumentDate(document.assemblyDate);
              const kindLabel = OFFICIAL_DOCUMENT_KIND_LABEL[document.documentKind];
              const meta = [kindLabel, dateLabel].filter(Boolean).join(' · ');

              return (
                <TouchableOpacity
                  key={document.id}
                  style={styles.row}
                  disabled={!document.fileUrl}
                  onPress={() => {
                    if (document.fileUrl) {
                      void Linking.openURL(document.fileUrl);
                    }
                  }}
                  accessibilityRole={document.fileUrl ? 'link' : 'text'}
                  accessibilityLabel={document.title}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{document.title}</Text>
                    {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
                    {document.summary ? <Text style={styles.rowSummary}>{document.summary}</Text> : null}
                  </View>
                  {document.fileUrl ? (
                    <FontAwesome name="external-link" size={14} color={MINIMAL_UI.icon} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  title: MINIMAL_SECTION_TITLE,
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: MINIMAL_UI.background,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  rowSummary: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
