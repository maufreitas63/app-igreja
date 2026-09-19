import { formatServicePhoneDisplay, SERVICE_CATEGORIA_LABEL, serviceCardInitials, type ProfileServiceCard } from '@/lib/profileServicesApi';
import { buildServiceVCard } from '@/lib/serviceVCard';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const WHATSAPP_GREEN = '#25D366';

type Props = {
  visible: boolean;
  card: ProfileServiceCard | null;
  photoUrl?: string | null;
  onClose: () => void;
};

export function ServiceMuralDetailModal({ visible, card, photoUrl, onClose }: Props) {
  const vcard = useMemo(() => {
    if (!card) {
      return '';
    }

    return buildServiceVCard({
      fullName: card.fullName,
      title: card.tituloServico,
      phone: card.telefoneContato,
      email: card.email,
    });
  }, [card]);

  if (!card) {
    return null;
  }

  const initials = serviceCardInitials(card.fullName);
  const phoneLabel = formatServicePhoneDisplay(card.telefoneContato) || 'Não informado';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar cartão" />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}
              <Text style={styles.name}>{card.fullName}</Text>
              <Text style={styles.title}>{card.tituloServico}</Text>
              <Text style={styles.category}>{SERVICE_CATEGORIA_LABEL[card.categoria]}</Text>
            </View>

            {card.descricaoServico ? <Text style={styles.description}>{card.descricaoServico}</Text> : null}

            <View style={styles.meta}>
              <Text style={styles.metaLabel}>WhatsApp</Text>
              <Text style={styles.metaValue}>{phoneLabel}</Text>
              <Text style={styles.metaLabel}>E-mail</Text>
              <Text style={styles.metaValue}>{card.email?.trim() || 'Não informado'}</Text>
            </View>

            <Pressable
              onPress={() =>
                openWhatsAppLikeBirthdaysWithText(
                  card.telefoneContato,
                  `Olá, ${card.fullName.split(/\s+/)[0] ?? ''}! Vi seu cartão no mural da igreja.`
                )
              }
              disabled={!card.telefoneContato}
              style={({ pressed }) => [
                styles.whatsapp,
                !card.telefoneContato && styles.whatsappDisabled,
                pressed && Boolean(card.telefoneContato) && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Falar no WhatsApp"
            >
              <FontAwesome name="whatsapp" size={18} color="#FFFFFF" />
              <Text style={styles.whatsappText}>Falar no WhatsApp</Text>
            </Pressable>

            <View style={styles.qrBlock}>
              <Text style={styles.qrCaption}>QR Code do contato</Text>
              {vcard ? (
                <View style={styles.qrSurface}>
                  <QRCode
                    value={vcard}
                    size={196}
                    color={MINIMAL_UI.blueDark}
                    backgroundColor={MINIMAL_UI.background}
                    ecl="M"
                    quietZone={10}
                  />
                </View>
              ) : null}
              <Text style={styles.qrHint}>
                Aponte a câmera do celular para salvar este contato na agenda.
              </Text>
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    gap: 14,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: MINIMAL_UI.blueDark,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    color: MINIMAL_UI.blueDark,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    color: MINIMAL_UI.blue,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  category: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  meta: {
    gap: 4,
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 12,
    padding: 12,
  },
  metaLabel: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metaValue: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
  whatsapp: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: WHATSAPP_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  whatsappDisabled: {
    backgroundColor: '#86EFAC',
  },
  whatsappText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  qrBlock: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  qrCaption: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  qrSurface: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  qrHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  close: {
    minHeight: 48,
    margin: 12,
    marginTop: 0,
    borderRadius: 14,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '800',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
  },
});
