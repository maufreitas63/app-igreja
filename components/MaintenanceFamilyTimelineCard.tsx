import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useFamilyTimeline } from '@/hooks/useFamilyTimeline';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import { formatFamilyTimelineWhen } from '@/lib/familyTimelineApi';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import Toast from 'react-native-toast-message';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

export function MaintenanceFamilyTimelineCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const {
    query,
    setQuery,
    searching,
    hits,
    selectedId,
    timeline,
    loadingTimeline,
    error,
    enabled,
    canToggle,
    toggling,
    selectFamily,
    toggleFeature,
    clearSearch,
  } = useFamilyTimeline(isActive);

  const handleToggle = async () => {
    const hiding = enabled;
    const confirmed = await confirmDialog(
      hiding ? 'Ocultar linha do tempo' : 'Reativar linha do tempo',
      hiding
        ? 'A tela some do menu desta igreja. Cadastros não são apagados. Você pode reativar depois ou pedir para reverter o commit.'
        : 'A linha do tempo volta a aparecer para quem tem permissão nesta igreja.',
      hiding ? 'Ocultar nesta igreja' : 'Reativar',
      'Cancelar'
    );
    if (!confirmed) return;
    const result = await toggleFeature(!enabled);
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Linha do tempo da família',
      text2: result.message,
    });
  };

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <KnowledgeSectionTitle
        title="Linha do tempo da família"
        routeKey={KNOWLEDGE_ROUTE.familyTimeline}
        titleStyle={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}
      />
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      <Text style={[styles.hint, minimal && styles.hintMinimal]}>
        Onde a família parou nesta igreja: recepção, régua, app, culto, célula e trilha.
      </Text>

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {!enabled ? (
        <Text style={[styles.warnText, minimal && styles.warnTextMinimal]}>
          Recurso oculto nesta igreja. O Super Administrador pode reativar.
        </Text>
      ) : null}

      {enabled || canToggle ? (
        <>
          <View style={[styles.searchRow, minimal && styles.searchRowMinimal]}>
            <FontAwesome name="search" size={16} color={minimal ? MINIMAL_UI.icon : '#64748B'} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nome, celular ou código da família"
              placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
              style={[styles.searchInput, minimal && styles.searchInputMinimal]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar família na linha do tempo"
            />
            <TouchableOpacity
              style={[
                styles.searchClearButton,
                query.length === 0 && !timeline && hits.length === 0 && styles.searchClearButtonDisabled,
              ]}
              onPress={clearSearch}
              disabled={query.length === 0 && !timeline && hits.length === 0}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca e dados da família"
            >
              <MaterialIcons
                name="close"
                size={20}
                color={minimal ? MINIMAL_UI.icon : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>

          {searching ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}

          {query.trim().length >= 2 && !searching ? (
            <View style={styles.hitList}>
              {hits.length === 0 ? (
                <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                  Nenhuma família visível para esta busca.
                </Text>
              ) : (
                hits.map((hit) => {
                  const selected = hit.familyId === selectedId;
                  return (
                    <TouchableOpacity
                      key={hit.familyId}
                      style={[
                        styles.hitRow,
                        minimal && styles.hitRowMinimal,
                        selected && styles.hitRowSelected,
                      ]}
                      onPress={() => void selectFamily(hit.familyId)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.hitTitle, minimal && styles.hitTitleMinimal]}>
                        {formatShortName(hit.name)} · {hit.familyId}
                      </Text>
                      <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                        {hit.memberCount} pessoa(s)
                        {hit.roles ? ` · ${hit.roles}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : null}

          {loadingTimeline ? <CardLoadingState lines={4} compact minimal={minimal} /> : null}

          {timeline && !loadingTimeline ? (
            <ScrollView
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {timeline.nextHint ? (
                <Text style={[styles.nextHint, minimal && styles.nextHintMinimal]}>
                  {timeline.nextHint}
                </Text>
              ) : null}

              <View style={styles.memberWrap}>
                {timeline.members.map((member) => (
                  <Text key={member.id} style={[styles.memberChip, minimal && styles.memberChipMinimal]}>
                    {formatShortName(member.name, { profileId: member.id })} · {member.role}
                    {member.lgpd ? ' · LGPD' : ''}
                    {member.hasSelfie ? ' · selfie' : ''}
                  </Text>
                ))}
              </View>

              {timeline.events.length === 0 ? (
                <Text style={[styles.meta, minimal && styles.metaMinimal]}>
                  Ainda não há passos registrados para esta família.
                </Text>
              ) : (
                timeline.events.map((event, index) => (
                  <View key={`${event.kind}-${event.at}-${index}`} style={styles.eventRow}>
                    <View style={[styles.dot, minimal && styles.dotMinimal]} />
                    <View style={styles.eventBody}>
                      <Text style={[styles.eventWhen, minimal && styles.eventWhenMinimal]}>
                        {formatFamilyTimelineWhen(event.at)}
                      </Text>
                      <Text style={[styles.eventTitle, minimal && styles.eventTitleMinimal]}>
                        {event.title}
                      </Text>
                      {event.detail ? (
                        <Text style={[styles.meta, minimal && styles.metaMinimal]}>{event.detail}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      {canToggle ? (
        <TouchableOpacity
          style={[styles.toggleButton, minimal && styles.toggleButtonMinimal]}
          onPress={() => void handleToggle()}
          disabled={toggling}
          accessibilityRole="button"
        >
          <Text style={[styles.toggleText, minimal && styles.toggleTextMinimal]}>
            {enabled ? 'Ocultar nesta igreja' : 'Reativar nesta igreja'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: 10,
  },
  panelMinimal: {
    gap: 8,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  hintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  errorTextMinimal: {
    color: '#B91C1C',
  },
  warnText: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 18,
  },
  warnTextMinimal: {
    color: '#B45309',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 42,
    backgroundColor: '#FFFFFF',
  },
  searchRowMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    paddingVertical: 8,
  },
  searchInputMinimal: {
    color: MINIMAL_UI.text,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearButtonDisabled: {
    opacity: 0.35,
  },
  hitList: {
    gap: 6,
    maxHeight: 140,
  },
  hitRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  hitRowMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  hitRowSelected: {
    borderColor: '#3A96DD',
    backgroundColor: '#F8FAFC',
  },
  hitTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  hitTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  metaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  nextHint: {
    color: '#1D4ED8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  nextHintMinimal: {
    color: MINIMAL_UI.accent,
  },
  memberWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    color: '#334155',
    fontSize: 12,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  memberChipMinimal: {
    color: MINIMAL_UI.blue,
    backgroundColor: '#EFF6FF',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    gap: 10,
    paddingBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3A96DD',
    marginTop: 5,
  },
  dotMinimal: {
    backgroundColor: MINIMAL_UI.accent,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
  eventWhen: {
    color: '#64748B',
    fontSize: 11,
  },
  eventWhenMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  eventTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  eventTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  toggleButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  toggleButtonMinimal: {
    paddingVertical: 6,
  },
  toggleText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleTextMinimal: {
    color: '#B45309',
  },
});
