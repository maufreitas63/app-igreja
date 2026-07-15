import { PttDirectoryAdminPanel } from '@/components/PttDirectoryAdminPanel';
import { PttWalkieTalkieButton } from '@/components/PttWalkieTalkieButton';
import { canUsePttWalkie } from '@/lib/pttApi';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  canManageDirectory?: boolean;
};

export function PttWalkieSettingsPanel({
  visible,
  onClose,
  canManageDirectory = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('Voluntário');
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAdminOpen(false);
      return;
    }

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
  }, [visible]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.header}>
              <FontAwesome name="microphone" size={18} color="#0F172A" />
              <Text style={styles.title}>Walkie-Talkie</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <FontAwesome name="times" size={18} color="#0F172A" />
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#3A96DD" />
            ) : !allowed ? (
              <Text style={styles.warn}>
                Seu perfil ainda não está na lista de usuários do Walkie-Talkie.
                {canManageDirectory
                  ? ' Use «Usuários Walkie» abaixo para incluir os participantes.'
                  : ' Peça a um super admin para incluir você na lista.'}
              </Text>
            ) : (
              <>
                <Text style={styles.hint}>
                  Toque em Gravar, escolha com quem falar e envie o áudio com texto automático.
                </Text>
                <PttWalkieTalkieButton
                  fullWidth
                  senderProfileId={profileId}
                  senderName={profileName}
                  setor="Walkie-Talkie"
                />
              </>
            )}

            {canManageDirectory ? (
              <Pressable style={styles.manageBtn} onPress={() => setAdminOpen(true)}>
                <FontAwesome name="users" size={14} color="#FFFFFF" />
                <Text style={styles.manageText}>Usuários Walkie</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <PttDirectoryAdminPanel visible={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  hint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  warn: {
    color: '#9A3412',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
  },
  manageBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manageText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
