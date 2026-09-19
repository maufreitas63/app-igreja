import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  SERVICE_CATEGORIA_LABEL,
  serviceCardInitials,
  type ProfileServiceCard,
} from '@/lib/profileServicesApi';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const WHATSAPP_GREEN = '#25D366';

type Props = {
  card: ProfileServiceCard;
  photoUrl?: string | null;
  onOpenDetail: () => void;
};

export function ServiceBusinessCard({ card, photoUrl, onOpenDetail }: Props) {
  const initials = serviceCardInitials(card.fullName);
  const hasWhatsApp = Boolean(card.telefoneContato);

  const handleWhatsApp = () => {
    const opened = openWhatsAppLikeBirthdaysWithText(
      card.telefoneContato,
      `Olá, ${card.fullName.split(/\s+/)[0] ?? ''}! Vi seu cartão no mural da igreja e gostaria de falar sobre ${card.tituloServico}.`
    );

    if (!opened) {
      onOpenDetail();
    }
  };

  return (
    <Pressable
      onPress={onOpenDetail}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Cartão de ${card.fullName}, ${card.tituloServico}`}
    >
      <View style={styles.header}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {card.fullName}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {card.tituloServico}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {SERVICE_CATEGORIA_LABEL[card.categoria]}
          </Text>
        </View>
      </View>

      {card.descricaoServico ? (
        <Text style={styles.description} numberOfLines={3}>
          {card.descricaoServico}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={handleWhatsApp}
          disabled={!hasWhatsApp}
          style={({ pressed }) => [
            styles.whatsapp,
            !hasWhatsApp && styles.whatsappDisabled,
            pressed && hasWhatsApp && styles.whatsappPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Abrir WhatsApp do prestador"
        >
          <FontAwesome name="whatsapp" size={16} color="#FFFFFF" />
          <Text style={styles.whatsappText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [styles.detail, pressed && styles.detailPressed]}
          accessibilityRole="button"
          accessibilityLabel="Ver cartão e QR Code"
        >
          <FontAwesome name="qrcode" size={14} color={MINIMAL_UI.blueDark} />
          <Text style={styles.detailText}>Cartão e QR</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
    padding: 14,
    gap: 10,
    ...boxShadowStyle({ color: '#0F172A', offsetY: 4, blurRadius: 12, opacity: 0.08, elevation: 2 }),
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  category: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  description: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  whatsapp: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: WHATSAPP_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappPressed: {
    opacity: 0.88,
  },
  whatsappDisabled: {
    backgroundColor: '#86EFAC',
  },
  whatsappText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detail: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  detailText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '800',
  },
});
