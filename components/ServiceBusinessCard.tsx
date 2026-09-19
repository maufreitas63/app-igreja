import { boxShadowStyle } from '@/lib/boxShadow';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  formatServiceInstagramHandle,
  formatServicePhoneDisplay,
  formatServiceWebsiteDisplay,
  instagramProfileUrl,
  SERVICE_CATEGORIA_LABEL,
  serviceCardInitials,
  serviceVCardInputFromCard,
  type ProfileServiceCard,
} from '@/lib/profileServicesApi';
import { downloadServiceVCard } from '@/lib/serviceVCard';
import { openWhatsAppLikeBirthdaysWithText } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

const WHATSAPP_GREEN = '#25D366';

type Props = {
  card: ProfileServiceCard;
  photoUrl?: string | null;
  onOpenDetail: () => void;
};

export function ServiceBusinessCard({ card, photoUrl, onOpenDetail }: Props) {
  const [downloading, setDownloading] = useState(false);
  const initials = serviceCardInitials(card.fullName);
  const phone = formatServicePhoneDisplay(card.telefoneContato);
  const website = formatServiceWebsiteDisplay(card.paginaWeb);
  const instagram = formatServiceInstagramHandle(card.instagram);
  const instagramUrl = instagramProfileUrl(card.instagram);
  const firstName = card.fullName.trim().split(/\s+/)[0] || card.fullName;

  const handleWhatsApp = () => {
    const opened = openWhatsAppLikeBirthdaysWithText(
      card.telefoneContato,
      `Olá, ${firstName}! Vi seu serviço no Apoio Mútuo.`
    );

    if (!opened) {
      Toast.show({
        type: 'info',
        text1: 'WhatsApp',
        text2: 'Este membro ainda não informou um telefone de contato.',
      });
    }
  };

  const handleDownloadVCard = () => {
    if (downloading) {
      return;
    }

    setDownloading(true);
    void downloadServiceVCard(serviceVCardInputFromCard(card))
      .then(() => {
        Toast.show({
          type: 'success',
          text1: 'Contato',
          text2: 'vCard gerado. Salve na agenda ou compartilhe.',
        });
      })
      .catch((error) => {
        Toast.show({
          type: 'error',
          text1: 'Contato',
          text2: error instanceof Error ? error.message : 'Não foi possível baixar o vCard.',
        });
      })
      .finally(() => setDownloading(false));
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [styles.identityPress, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${card.fullName}, ${card.tituloServico}`}
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

        {phone || website || instagram ? (
          <View style={styles.contacts}>
            {phone ? <Text style={styles.contactText}>WhatsApp {phone}</Text> : null}
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
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={handleWhatsApp}
          disabled={!phone}
          style={({ pressed }) => [
            styles.whatsapp,
            !phone && styles.actionDisabled,
            pressed && phone && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Conversar no WhatsApp com ${card.fullName}`}
        >
          <FontAwesome name="whatsapp" size={15} color="#FFFFFF" />
          <Text style={styles.whatsappText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          onPress={handleDownloadVCard}
          disabled={downloading}
          style={({ pressed }) => [styles.vcard, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Baixar vCard de ${card.fullName}`}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
          ) : (
            <FontAwesome name="download" size={14} color={MINIMAL_UI.blueDark} />
          )}
          <Text style={styles.vcardText}>Salvar contato</Text>
        </Pressable>
      </View>
    </View>
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
  identityPress: {
    gap: 10,
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
    gap: 4,
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
  contacts: {
    gap: 4,
  },
  contactText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  whatsapp: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: WHATSAPP_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  vcard: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vcardText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionPressed: {
    opacity: 0.88,
  },
});
