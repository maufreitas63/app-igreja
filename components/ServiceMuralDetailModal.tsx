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
import { buildServiceVCard, downloadServiceVCard } from '@/lib/serviceVCard';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { openWhatsAppLikeBirthdays } from '@/lib/whatsapp';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';

const WHATSAPP_GREEN = '#25D366';

type Props = {
  visible: boolean;
  card: ProfileServiceCard | null;
  photoUrl?: string | null;
  onClose: () => void;
};

export function ServiceMuralDetailModal({ visible, card, photoUrl, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const vcard = useMemo(() => {
    if (!card) {
      return '';
    }

    return buildServiceVCard(serviceVCardInputFromCard(card));
  }, [card]);

  if (!card) {
    return null;
  }

  const initials = serviceCardInitials(card.fullName);
  const phone = formatServicePhoneDisplay(card.telefoneContato);
  const email = card.email?.trim() ?? '';
  const website = formatServiceWebsiteDisplay(card.paginaWeb);
  const instagram = formatServiceInstagramHandle(card.instagram);
  const instagramUrl = instagramProfileUrl(card.instagram);

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
              <Text style={styles.sectionTitle}>Informações do trabalho</Text>
              <Text style={styles.metaLabel}>Atividade</Text>
              <Text style={styles.metaValue}>{card.tituloServico}</Text>
              <Text style={styles.metaLabel}>Categoria</Text>
              <Text style={styles.metaValue}>{SERVICE_CATEGORIA_LABEL[card.categoria]}</Text>
            </View>

            <View style={styles.meta}>
              <Text style={styles.sectionTitle}>Informações de contato</Text>
              <Text style={styles.metaLabel}>Telefone</Text>
              {phone ? (
                <Pressable
                  onPress={() => openWhatsAppLikeBirthdays(card.telefoneContato)}
                  style={styles.contactRow}
                  accessibilityRole="link"
                  accessibilityLabel={`WhatsApp ${phone}`}
                >
                  <FontAwesome name="whatsapp" size={16} color={WHATSAPP_GREEN} />
                  <Text style={styles.linkValue}>{phone}</Text>
                </Pressable>
              ) : (
                <Text style={styles.metaValue}>Não informado</Text>
              )}
              <Text style={styles.metaLabel}>E-mail</Text>
              {email ? (
                <Pressable
                  onPress={() => void Linking.openURL(`mailto:${email}`)}
                  style={styles.contactRow}
                  accessibilityRole="link"
                  accessibilityLabel={`Enviar e-mail para ${email}`}
                >
                  <FontAwesome name="envelope" size={14} color={MINIMAL_UI.blue} />
                  <Text style={styles.linkValue}>{email}</Text>
                </Pressable>
              ) : (
                <Text style={styles.metaValue}>Não informado</Text>
              )}
              <Text style={styles.metaLabel}>Página WEB</Text>
              {website ? (
                <Pressable
                  onPress={() => void Linking.openURL(website)}
                  accessibilityRole="link"
                  accessibilityLabel="Abrir página web"
                >
                  <Text style={styles.linkValue}>{website.replace(/^https?:\/\//i, '')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.metaValue}>Não informado</Text>
              )}
              <Text style={styles.metaLabel}>Instagram</Text>
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
                  <Text style={styles.linkValue}>@{instagram}</Text>
                </Pressable>
              ) : (
                <Text style={styles.metaValue}>Não informado</Text>
              )}
            </View>

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
                Aponte a câmera do celular para salvar este contato na agenda, com a atividade nas
                informações do trabalho.
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => openWhatsAppLikeBirthdays(card.telefoneContato)}
                disabled={!phone}
                style={({ pressed }) => [
                  styles.whatsapp,
                  !phone && styles.actionDisabled,
                  pressed && phone && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`WhatsApp ${phone || card.fullName}`}
              >
                <FontAwesome name="whatsapp" size={16} color="#FFFFFF" />
                <Text style={styles.whatsappText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                onPress={() => {
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
                        text2:
                          error instanceof Error
                            ? error.message
                            : 'Não foi possível baixar o vCard.',
                      });
                    })
                    .finally(() => setDownloading(false));
                }}
                style={({ pressed }) => [styles.vcard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Baixar vCard"
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={MINIMAL_UI.blueDark} />
                ) : (
                  <FontAwesome name="download" size={14} color={MINIMAL_UI.blueDark} />
                )}
                <Text style={styles.vcardText}>Salvar contato</Text>
              </Pressable>
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
  sectionTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkValue: {
    flex: 1,
    minWidth: 0,
    color: MINIMAL_UI.blue,
    fontSize: 14,
    fontWeight: '700',
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
