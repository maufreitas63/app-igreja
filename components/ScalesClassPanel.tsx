import { ParkingVehicleIdentifyPanel } from '@/components/ParkingVehicleIdentifyPanel';
import { ScalesClass } from '@/components/ScalesClass';
import { ScaleSwapInbox } from '@/components/ScaleSwapInbox';
import { ScaleSwapRequestModal } from '@/components/ScaleSwapRequestModal';
import { withActiveMembershipProfileFilter } from '@/lib/activeMemberProfile';
import {
  ACCESS_SCREEN,
  isDashboardCardContentAllowed,
  loadDashboardCardViewAccess,
  sessionHasAccess,
} from '@/lib/accessControl';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { lookupVehicleByPlaca, type VehicleLookupResult } from '@/lib/profileVehicleLookup';
import { loadScalesClassData } from '@/lib/scalesClassData';
import type {
  ProfilePhoneRow,
  ScalesClassScheduleEntry,
  ScalesClassScaleType,
  ScalesClassView,
  ScalesClassVolunteerEntry,
} from '@/lib/scalesClassTypes';
import {
  getCurrentLocalIsoDate,
  isIntercessionScale,
  isParkingWelcomeScale,
  resolveProfilePhoneForVolunteerName,
} from '@/lib/scalesClassUtils';
import { fetchVolunteersForScaleType } from '@/lib/maintenanceScaleVolunteersApi';
import { sessionCanAccessScaleType } from '@/lib/scaleAccess';
import { profileNameMatchesVolunteerName } from '@/lib/scaleVolunteerProfileMatch';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Container com dados e navegação — compõe o ScalesClass stateless. */
export function ScalesClassPanel() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
    fallbackDashboardCard: 'vigilance_scales',
  });
  const [view, setView] = useState<ScalesClassView>('picker');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scaleTypes, setScaleTypes] = useState<ScalesClassScaleType[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScalesClassScheduleEntry[]>([]);
  const [selectedScaleCode, setSelectedScaleCode] = useState('');
  const [dashboardCardAccess, setDashboardCardAccess] = useState<Record<string, boolean>>({});

  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [volunteerEntries, setVolunteerEntries] = useState<ScalesClassVolunteerEntry[]>([]);

  const [vehiclePlacaQuery, setVehiclePlacaQuery] = useState('');
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [vehicleLookupError, setVehicleLookupError] = useState<string | null>(null);
  const [vehicleLookupResult, setVehicleLookupResult] = useState<VehicleLookupResult | null>(null);
  const [sessionFullName, setSessionFullName] = useState<string | null>(null);
  const [canAllowSwap, setCanAllowSwap] = useState(false);
  const [panelTab, setPanelTab] = useState<'escalas' | 'trocas'>('escalas');
  const [swapEntry, setSwapEntry] = useState<ScalesClassScheduleEntry | null>(null);

  const selectedScaleType = useMemo(
    () => scaleTypes.find((entry) => entry.code === selectedScaleCode) ?? null,
    [scaleTypes, selectedScaleCode]
  );

  const rosterTitle = selectedScaleType?.name ?? 'Escala';

  const isSelectedScaleIntercession = useMemo(
    () =>
      selectedScaleType
        ? isIntercessionScale(selectedScaleType.name, selectedScaleType.code)
        : false,
    [selectedScaleType]
  );

  const isSelectedScaleParking = useMemo(
    () =>
      selectedScaleType
        ? isParkingWelcomeScale(selectedScaleType.name, selectedScaleType.code)
        : false,
    [selectedScaleType]
  );

  const upcomingScheduleEntries = useMemo(
    () => scheduleEntries.filter((entry) => entry.serviceDate >= getCurrentLocalIsoDate()),
    [scheduleEntries]
  );

  const scheduleEntriesForSelectedScale = useMemo(
    () => upcomingScheduleEntries.filter((entry) => entry.scaleCode === selectedScaleCode),
    [selectedScaleCode, upcomingScheduleEntries]
  );

  const nextServiceDate = scheduleEntriesForSelectedScale[0]?.serviceDate ?? null;

  const handleResetVehicleLookup = useCallback(() => {
    setVehiclePlacaQuery('');
    setVehicleLookupResult(null);
    setVehicleLookupError(null);
  }, []);

  const loadRegisteredScaleVolunteers = useCallback(async (scaleTypeId: string) => {
    setRosterLoading(true);
    setRosterError(null);

    try {
      const [volunteers, { data: profilesData, error: profilesError }] = await Promise.all([
        fetchVolunteersForScaleType(scaleTypeId),
        withActiveMembershipProfileFilter(
          supabase.from('profiles').select('full_name, phone, family_id, codigo_membro')
        ),
      ]);

      if (profilesError) {
        throw profilesError;
      }

      const profiles = (profilesData as ProfilePhoneRow[] | null) ?? [];
      const entries = volunteers
        .map((volunteer) => ({
          id: volunteer.id,
          name: volunteer.name,
          phone: resolveProfilePhoneForVolunteerName(volunteer.name, profiles),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

      setVolunteerEntries(entries);
    } catch (loadError) {
      console.error('Erro ao carregar servos da escala:', loadError);
      setVolunteerEntries([]);
      setRosterError('Nao foi possivel carregar os servos desta escala.');
    } finally {
      setRosterLoading(false);
    }
  }, []);

  const loadScales = useCallback(async (options?: { preserveSelection?: boolean }) => {
    const preserveSelection = options?.preserveSelection ?? false;
    setLoading(true);
    setError(null);

    try {
      const sessionProfile = await loadEffectiveSessionProfile();
      const profileId =
        (await resolveEffectiveProfileId())?.trim()
        ?? sessionProfile?.id?.trim()
        ?? null;
      const profileFullName = sessionProfile?.full_name?.trim() || null;
      setSessionFullName(profileFullName);

      if (profileId) {
        const cardAccess = await loadDashboardCardViewAccess(profileId);
        setDashboardCardAccess(cardAccess);
      }

      setCanAllowSwap(await sessionHasAccess('screen', ACCESS_SCREEN.scalesAllowSwap, 'view'));

      const loaded = await loadScalesClassData(profileFullName);
      setScaleTypes(loaded.scaleTypes);
      setScheduleEntries(loaded.scheduleEntries);

      if (!preserveSelection) {
        setSelectedScaleCode('');
        setView('picker');
        setVolunteerEntries([]);
        setRosterError(null);
        handleResetVehicleLookup();
      }
    } catch (loadError) {
      console.error('Erro ao carregar escalas:', loadError);
      setScaleTypes([]);
      setScheduleEntries([]);

      if (!preserveSelection) {
        setSelectedScaleCode('');
        setView('picker');
      }

      setError('Nao foi possivel carregar as escalas.');
    } finally {
      setLoading(false);
    }
  }, [handleResetVehicleLookup]);

  useEffect(() => {
    void loadScales();
  }, [loadScales]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void loadScales({ preserveSelection: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadScales]);

  useEffect(() => {
    const channel = supabase
      .channel('escalas-log-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escalas_log' },
        () => {
          void loadScales({ preserveSelection: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadScales]);

  const handleSelectScale = useCallback(
    (option: ScalesClassScaleType) => {
      void (async () => {
        const allowed = await sessionCanAccessScaleType(option.code, 'view');

        if (!allowed) {
          Alert.alert(
            'Sem permissão',
            `Você não tem permissão para acessar a escala "${option.name}".`
          );
          return;
        }

        setSelectedScaleCode(option.code);
        handleResetVehicleLookup();
        setView('roster');

        if (isIntercessionScale(option.name, option.code)) {
          void loadRegisteredScaleVolunteers(option.id);
          return;
        }

        setVolunteerEntries([]);
        setRosterError(null);
      })();
    },
    [handleResetVehicleLookup, loadRegisteredScaleVolunteers]
  );

  const handleBackToPicker = useCallback(() => {
    setSelectedScaleCode('');
    setVolunteerEntries([]);
    setRosterError(null);
    handleResetVehicleLookup();
    setView('picker');
  }, [handleResetVehicleLookup]);

  const handleOpenParking = useCallback(() => {
    if (!isDashboardCardContentAllowed('parking_vehicle_v2', dashboardCardAccess)) {
      Alert.alert(
        'Sem permissão',
        'Você não tem permissão para abrir o painel de estacionamento.'
      );
      return;
    }

    setView('parking');
  }, [dashboardCardAccess]);

  const handleBackFromParking = useCallback(() => {
    handleResetVehicleLookup();
    setView('roster');
  }, [handleResetVehicleLookup]);

  const handleOpenWhatsapp = useCallback(async (phone: string | null) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponível', 'Este servo não possui telefone cadastrado no perfil.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (linkError) {
      console.error('Erro ao abrir WhatsApp:', linkError);
      Alert.alert('Erro', 'Não foi possível abrir o Zap deste servo.');
    }
  }, []);

  const handleSearchVehicleByPlaca = useCallback(async () => {
    setVehicleLookupLoading(true);
    setVehicleLookupError(null);
    setVehicleLookupResult(null);

    try {
      setVehicleLookupResult(await lookupVehicleByPlaca(vehiclePlacaQuery));
    } catch (searchError) {
      const message =
        searchError instanceof Error ? searchError.message : 'Não foi possível localizar o veículo.';

      const expectedMessages = [
        'Informe a placa do veículo.',
        'Informe a placa completa do veículo.',
        'Nenhum veículo encontrado para esta placa.',
      ];

      if (expectedMessages.includes(message)) {
        setVehicleLookupError(message);
      } else {
        console.error('Erro ao buscar veículo por placa:', searchError);
        setVehicleLookupError('Não foi possível localizar o veículo.');
      }
    } finally {
      setVehicleLookupLoading(false);
    }
  }, [vehiclePlacaQuery]);

  const handleOpenVehicleOwnerWhatsapp = useCallback(async (phone: string | null) => {
    const whatsappPhone = normalizePhoneForWhatsApp(phone);

    if (!whatsappPhone) {
      Alert.alert('Telefone indisponivel', 'Nao ha telefone cadastrado para este proprietario.');
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${whatsappPhone}`);
    } catch (linkError) {
      console.error('Erro ao abrir WhatsApp:', linkError);
      Alert.alert('Erro', 'Nao foi possivel abrir o Zap deste proprietario.');
    }
  }, []);

  const myUpcomingEntries = useMemo(
    () =>
      upcomingScheduleEntries.filter((entry) =>
        profileNameMatchesVolunteerName(sessionFullName, entry.volunteerName)
      ),
    [sessionFullName, upcomingScheduleEntries]
  );

  const canRequestSwap = useCallback(
    (entry: ScalesClassScheduleEntry) => {
      if (!canAllowSwap) {
        return false;
      }

      if (
        isIntercessionScale(entry.scaleName, entry.scaleCode)
        || isParkingWelcomeScale(entry.scaleName, entry.scaleCode)
      ) {
        return false;
      }

      return profileNameMatchesVolunteerName(sessionFullName, entry.volunteerName);
    },
    [canAllowSwap, sessionFullName]
  );

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, panelTab === 'escalas' && styles.tabActive]}
          onPress={() => setPanelTab('escalas')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, panelTab === 'escalas' && styles.tabTextActive]}>
            Escalas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, panelTab === 'trocas' && styles.tabActive]}
          onPress={() => setPanelTab('trocas')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, panelTab === 'trocas' && styles.tabTextActive]}>
            Pedidos de troca
          </Text>
        </TouchableOpacity>
      </View>

      {panelTab === 'trocas' ? (
        <ScaleSwapInbox
          active
          onRosterChanged={() => void loadScales({ preserveSelection: true })}
        />
      ) : (
        <ScalesClass
          view={view}
          loading={loading}
          error={error}
          onRetry={() => void loadScales({ preserveSelection: true })}
          scaleTypes={scaleTypes}
          selectedScaleCode={selectedScaleCode}
          onSelectScale={handleSelectScale}
          rosterTitle={rosterTitle}
          isIntercession={isSelectedScaleIntercession}
          isParking={isSelectedScaleParking}
          scheduleEntries={scheduleEntriesForSelectedScale}
          volunteerEntries={volunteerEntries}
          nextServiceDate={nextServiceDate}
          rosterLoading={rosterLoading}
          rosterError={rosterError}
          onRosterRetry={
            selectedScaleType
              ? () => void loadRegisteredScaleVolunteers(selectedScaleType.id)
              : undefined
          }
          onBack={handleBackToPicker}
          onOpenParking={handleOpenParking}
          onOpenWhatsapp={(phone) => void handleOpenWhatsapp(phone)}
          canRequestSwap={canRequestSwap}
          onRequestSwap={setSwapEntry}
          myScheduleEntries={myUpcomingEntries}
          parkingPanel={
            <ParkingVehicleIdentifyPanel
              placaQuery={vehiclePlacaQuery}
              loading={vehicleLookupLoading}
              error={vehicleLookupError}
              result={vehicleLookupResult}
              onChangePlaca={(text) => {
                setVehiclePlacaQuery(text);
                setVehicleLookupError(null);
              }}
              onSearch={() => void handleSearchVehicleByPlaca()}
              onReset={handleResetVehicleLookup}
              onOpenWhatsapp={(phone) => void handleOpenVehicleOwnerWhatsapp(phone)}
              fillAvailableHeight
            />
          }
          onBackFromParking={handleBackFromParking}
        />
      )}

      <ScaleSwapRequestModal
        visible={swapEntry !== null}
        escalaLogId={swapEntry?.id ?? null}
        volunteerName={swapEntry?.volunteerName ?? ''}
        serviceDate={swapEntry?.serviceDate ?? ''}
        scaleName={swapEntry?.scaleName ?? rosterTitle}
        onClose={() => setSwapEntry(null)}
        onDone={() => {
          setSwapEntry(null);
          void loadScales({ preserveSelection: true });
        }}
      />
      {view === 'picker' ? <CloseFooterBar onPress={returnToCaller} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    gap: 10,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: VIGILANCE_SCALES_UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: VIGILANCE_SCALES_UI.accent,
  },
  tabText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
});
