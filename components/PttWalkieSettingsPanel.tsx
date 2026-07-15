import { PttWalkieTalkieButton } from '@/components/PttWalkieTalkieButton';
import { canUsePttWalkie, listPttDirectoryPeers, type PttDirectoryPeer } from '@/lib/pttApi';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type Props = {
  onBack: () => void;
  /** Super admin — atalho para gerenciar a lista, abaixo de Iniciar. */
  canManageUsers?: boolean;
  onOpenUsers?: () => void;
};

type Step = 'home' | 'pick' | 'talk';

/**
 * Painel minimal no drawer: uma etapa por vez.
 * home → escolher contato → gravar/enviar.
 */
export function PttWalkieSettingsPanel({
  onBack,
  canManageUsers = false,
  onOpenUsers,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('Voluntário');
  const [step, setStep] = useState<Step>('home');
  const [peers, setPeers] = useState<PttDirectoryPeer[]>([]);
  const [peer, setPeer] = useState<PttDirectoryPeer | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      try {
        const id = await resolveEffectiveProfileId();
        if (cancelled) return;
        setProfileId(id);
        if (id) {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', id)
            .maybeSingle();
          const name = String(data?.full_name ?? '').trim();
          if (name) setProfileName(name);
        }
        setAllowed(await canUsePttWalkie());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPick = useCallback(async () => {
    if (!allowed) return;
    setLoadingPeers(true);
    setStep('pick');
    try {
      const list = await listPttDirectoryPeers();
      const mine = profileId?.trim();
      const filtered = list.filter((p) => p.profile_id && p.profile_id !== mine);
      setPeers(filtered);
      if (filtered.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'Walkie-Talkie',
          text2: 'Nenhum contato disponível na lista.',
          visibilityTime: 4000,
        });
        setStep('home');
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Walkie-Talkie',
        text2: 'Não foi possível carregar os contatos.',
      });
      setStep('home');
    } finally {
      setLoadingPeers(false);
    }
  }, [allowed, profileId]);

  const title =
    step === 'pick' ? 'Contato' : step === 'talk' ? peer?.full_name || 'Walkie-Talkie' : 'Walkie-Talkie';

  const handleHeaderBack = () => {
    if (step === 'talk') {
      setPeer(null);
      setStep('home');
      return;
    }
    if (step === 'pick') {
      setStep('home');
      return;
    }
    onBack();
  };

  return (
    <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          onPress={handleHeaderBack}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={MINIMAL_UI.icon} />
        </View>
      ) : step === 'home' ? (
        <View style={styles.body}>
          {!allowed ? (
            <Text style={styles.message}>Você ainda não está na lista do Walkie.</Text>
          ) : (
            <TouchableOpacity
              style={styles.primaryRow}
              onPress={() => void openPick()}
              accessibilityRole="button"
              accessibilityLabel="Iniciar Walkie-Talkie"
            >
              <View style={styles.itemIconWrap}>
                <FontAwesome name="microphone" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
              </View>
              <Text style={styles.primaryLabel}>Iniciar</Text>
              <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
            </TouchableOpacity>
          )}
          {canManageUsers && onOpenUsers ? (
            <TouchableOpacity
              style={styles.primaryRow}
              onPress={onOpenUsers}
              accessibilityRole="button"
              accessibilityLabel="Usuários Walkie"
            >
              <View style={styles.itemIconWrap}>
                <FontAwesome name="users" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
              </View>
              <Text style={styles.primaryLabel}>Usuários Walkie</Text>
              <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : step === 'pick' ? (
        loadingPeers ? (
          <View style={styles.center}>
            <ActivityIndicator color={MINIMAL_UI.icon} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {peers.map((item) => (
              <TouchableOpacity
                key={item.profile_id}
                style={styles.row}
                onPress={() => {
                  setPeer(item);
                  setStep('talk');
                }}
                accessibilityRole="button"
                accessibilityLabel={`Falar com ${item.full_name}`}
              >
                <View style={styles.itemIconWrap}>
                  <FontAwesome name="user" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
                </View>
                <Text style={styles.rowLabel}>{item.full_name}</Text>
                <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : (
        <View style={styles.body}>
          <PttWalkieTalkieButton
            fullWidth
            lockedPeer={peer}
            senderProfileId={profileId}
            senderName={profileName}
            setor="Walkie-Talkie"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 2,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 26,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    gap: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    ...MINIMAL_TYPO.inboxPreview,
    paddingVertical: 12,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  primaryLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '600',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  rowLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '600',
    flex: 1,
  },
  itemIconWrap: {
    width: 28,
    alignItems: 'center',
  },
});
