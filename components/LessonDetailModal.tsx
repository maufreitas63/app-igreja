import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { ClassLessonDetail, RoomType } from '@/types/class-lesson';
import { lessonCategoryInfo } from '@/types/class-lesson';
import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  lesson: ClassLessonDetail | null;
  roomLabel: string;
  onClose: () => void;
};

const formatClassDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const roomFallback = (roomType: RoomType) => (roomType === 'jovens' ? 'Sala Jovens' : 'Sala Infantil');

export function LessonDetailModal({ lesson, roomLabel, onClose }: Props) {
  const category = lesson ? lessonCategoryInfo(lesson.category) : null;

  return (
    <Modal visible={lesson !== null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {lesson ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>{roomLabel || roomFallback(lesson.roomType)}</Text>
              <Text style={styles.title}>{lesson.title}</Text>
              <Text style={styles.date}>{formatClassDate(lesson.classDate)}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              {category ? (
                <View style={styles.categoryBox}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryText}>{category.description}</Text>
                </View>
              ) : null}
              <Detail label="Passagem bíblica principal" value={lesson.biblePassage} />
              <Detail label="Objetivo principal" value={lesson.mainObjective} />
              {lesson.resourcesNotes ? (
                <Detail label="Recursos ou dinâmicas" value={lesson.resourcesNotes} />
              ) : null}
              <View style={styles.familyBox}>
                <Text style={styles.familyTitle}>Conversa em família</Text>
                <Text style={styles.familyText}>
                  {lesson.familyExtension?.trim() ||
                    'Ainda não há uma pergunta ou desafio para continuar em casa.'}
                </Text>
              </View>
              <Text style={styles.serversTitle}>Servidores participantes</Text>
              {lesson.servers.length ? (
                lesson.servers.map((server) => (
                  <View key={server.id} style={styles.serverRow}>
                    {server.selfieUrl ? (
                      <Image source={{ uri: server.selfieUrl }} style={styles.selfie} />
                    ) : (
                      <View style={styles.selfieFallback} />
                    )}
                    <Text style={styles.serverName}>{server.fullName}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyServers}>Nenhum servidor escalado nesta data.</Text>
              )}
            </ScrollView>
          </>
        ) : null}
        <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar detalhes da aula" />
      </SafeAreaView>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  date: {
    fontSize: 14,
    fontWeight: '700',
    color: MINIMAL_UI.accent,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  detail: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 21,
    color: MINIMAL_UI.text,
  },
  familyBox: {
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    padding: 14,
    gap: 6,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  familyText: {
    fontSize: 15,
    lineHeight: 21,
    color: MINIMAL_UI.text,
  },
  categoryBox: {
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    padding: 14,
    gap: 6,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  categoryText: {
    fontSize: 15,
    lineHeight: 21,
    color: MINIMAL_UI.text,
  },
  serversTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selfie: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  selfieFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MINIMAL_UI.divider,
  },
  serverName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  emptyServers: {
    fontSize: 14,
    color: MINIMAL_UI.textMuted,
  },
});
