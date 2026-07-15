import {
  ackPttMessage,
  listPendingPttMessages,
  markPttDelivered,
  payloadFromPttRow,
  type PttMessagePayload,
  type PttMessageRow,
} from '@/lib/pttApi';
import { subscribePttSocket } from '@/lib/pttSocket';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type InboxItem = {
  id?: string;
  payload: PttMessagePayload;
};

const fingerprintOf = (item: InboxItem) => {
  if (item.id?.trim()) {
    return `id:${item.id.trim()}`;
  }
  const p = item.payload;
  return `fp:${p.audio_url || ''}|${p.timestamp || ''}|${p.texto_transcrito || ''}|${p.remetente || ''}`;
};

export function PttInboxListener() {
  const [item, setItem] = useState<InboxItem | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<InboxItem[]>([]);
  const showingRef = useRef(false);

  const showNext = useCallback((next: InboxItem) => {
    showingRef.current = true;
    setItem(next);
    if (next.id) {
      void markPttDelivered(next.id);
    }
    Toast.show({
      type: 'info',
      text1: `PTT · ${next.payload.setor}`,
      text2: `${next.payload.remetente}: ${next.payload.texto_transcrito || 'Áudio recebido'}`,
      visibilityTime: 5000,
    });
  }, []);

  const present = useCallback(
    (next: InboxItem) => {
      const key = fingerprintOf(next);
      if (seenRef.current.has(key)) {
        return;
      }
      // Também marca o id se veio só fingerprint e depois chega o id
      if (next.id) {
        seenRef.current.add(`id:${next.id}`);
      }
      seenRef.current.add(key);

      if (showingRef.current) {
        queueRef.current.push(next);
        return;
      }

      showNext(next);
    },
    [showNext]
  );

  const drainPending = useCallback(async () => {
    const rows = await listPendingPttMessages();
    for (const row of rows) {
      present({ id: row.id, payload: payloadFromPttRow(row) });
    }
  }, [present]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unsubscribeSocket: (() => void) | null = null;

    const boot = async () => {
      const profileId = await resolveEffectiveProfileId();
      if (cancelled || !profileId) {
        return;
      }

      await drainPending();

      channel = supabase
        .channel(`ptt-inbox-${profileId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ptt_messages',
            filter: `recipient_profile_id=eq.${profileId}`,
          },
          (payload) => {
            const row = payload.new as PttMessageRow;
            if (!row?.id) {
              return;
            }
            present({ id: row.id, payload: payloadFromPttRow(row) });
          }
        )
        .subscribe();

      // Socket opcional — só aceita eventos com id (evita duplicar o Realtime sem chave).
      unsubscribeSocket = subscribePttSocket(profileId, (payload) => {
        const id = typeof (payload as { id?: string }).id === 'string' ? payload.id : undefined;
        if (!id) {
          return;
        }
        present({ id, payload });
      });
    };

    void boot();

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void drainPending();
      }
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
      unsubscribeSocket?.();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [drainPending, present]);

  const close = async () => {
    const current = item;
    setItem(null);
    if (current?.id) {
      await ackPttMessage(current.id);
    }

    const next = queueRef.current.shift();
    if (next) {
      showNext(next);
      return;
    }

    showingRef.current = false;
    void drainPending();
  };

  const playAudio = () => {
    const url = item?.payload.audio_url?.trim();
    if (!url || Platform.OS !== 'web' || typeof Audio === 'undefined') {
      return;
    }
    try {
      const audio = new Audio(url);
      void audio.play();
    } catch (error) {
      console.warn('PTT play audio', error);
    }
  };

  if (!item) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => void close()}>
      <Pressable style={styles.backdrop} onPress={() => void close()}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <FontAwesome name="bullhorn" size={18} color="#0F172A" />
            <Text style={styles.title}>Mensagem PTT</Text>
          </View>
          <Text style={styles.meta}>
            {item.payload.remetente} · {item.payload.setor}
            {item.payload.timestamp ? ` · ${item.payload.timestamp}` : ''}
          </Text>
          <Text style={styles.body}>
            {item.payload.texto_transcrito || 'Áudio recebido sem legenda.'}
          </Text>
          <View style={styles.actions}>
            {item.payload.audio_url ? (
              <Pressable style={styles.secondaryBtn} onPress={playAudio}>
                <Text style={styles.secondaryText}>Ouvir áudio</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primaryBtn} onPress={() => void close()}>
              <Text style={styles.primaryText}>Ok</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  meta: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    color: '#0F172A',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  secondaryText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#3A96DD',
  },
  primaryText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
