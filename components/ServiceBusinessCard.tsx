import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  formatServiceInstagramHandle,
  formatServiceWebsiteDisplay,
  instagramProfileUrl,
  SERVICE_CATEGORIA_LABEL,
  serviceCardInitials,
  type ProfileServiceCard,
} from '@/lib/profileServicesApi';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  card: ProfileServiceCard;
  photoUrl?: string | null;
  onOpenDetail: () => void;
};

export function ServiceBusinessCard({ card, photoUrl, onOpenDetail }: Props) {
  const initials = serviceCardInitials(card.fullName);
  const website = formatServiceWebsiteDisplay(card.paginaWeb);
  const instagram = formatServiceInstagramHandle(card.instagram);
  const instagramUrl = instagramProfileUrl(card.instagram);

  return (
    <Pressable
      onPress={onOpenDetail}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${card.tituloServico}, ${SERVICE_CATEGORIA_LABEL[card.categoria]}`}
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
          <Text style={styles.title} numberOfLines={2}>
            {card.tituloServico}
          </Text>
          {SERVICE_CATEGORIA_LABEL[card.categoria] ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{SERVICE_CATEGORIA_LABEL[card.categoria]}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {card.descricaoServico ? (
        <Text style={styles.description} numberOfLines={3}>
          {card.descricaoServico}
        </Text>
      ) : null}

      {website || instagram ? (
        <View style={styles.links}>
          {website ? (
            <Pressable
              onPress={() => void Linking.openURL(website)}
              accessibilityRole="link"
              accessibilityLabel="Abrir página web"
            >
              <Text style={styles.linkText} numberOfLines={1}>
                {website.replace(/^https?:\/\//i, '')}
              </Text>
            </Pressable>
          ) : null}
          {instagram ? (
            <Pressable
              onPress={() => {
                if (instagramUrl) {
                  void Linking.openURL(instagramUrl);
                }
              }}
              accessibilityRole="link"
              accessibilityLabel="Abrir Instagram"
            >
              <Text style={styles.linkText} numberOfLines={1}>
                Instagram @{instagram}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.detail, pressed && styles.detailPressed]}
        accessibilityRole="button"
        accessibilityLabel="Ver cartão e QR Code"
      >
        <FontAwesome name="qrcode" size={14} color={MINIMAL_UI.blueDark} />
        <Text style={styles.detailText}>Cartão e QR</Text>
      </Pressable>
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
    gap: 6,
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  tagText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 11,
    fontWeight: '800',
  },
  description: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  links: {
    gap: 4,
  },
  linkText: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    minHeight: 42,
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
