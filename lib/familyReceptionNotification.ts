import {
  type FamilyReceptionSubmission,
  fetchSuperAdminWhatsAppPhone,
} from '@/lib/familyReceptionNotificationApi';
import { openWhatsAppPhone } from '@/lib/whatsapp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFIED_IDS_STORAGE_KEY = 'familyReceptionWhatsappNotified.v1';
const NOTIFIER_SEEDED_STORAGE_KEY = 'familyReceptionWhatsappSeeded.v1';

const readStorageItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
};

const writeStorageItem = async (key: string, value: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
};

const loadNotifiedSubmissionIds = async () => {
  try {
    const raw = await readStorageItem(NOTIFIED_IDS_STORAGE_KEY);

    if (!raw) {
      return new Set<string>();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.map((item) => String(item)).filter(Boolean));
  } catch {
    return new Set<string>();
  }
};

const saveNotifiedSubmissionIds = async (ids: Set<string>) => {
  await writeStorageItem(NOTIFIED_IDS_STORAGE_KEY, JSON.stringify([...ids]));
};

const hasNotifierBeenSeeded = async () => (await readStorageItem(NOTIFIER_SEEDED_STORAGE_KEY)) === '1';

const markNotifierSeeded = async () => {
  await writeStorageItem(NOTIFIER_SEEDED_STORAGE_KEY, '1');
};

const findInformantName = (submission: FamilyReceptionSubmission) => {
  const informant = submission.members.find((member) => member.isInformant);

  return informant?.fullName?.trim() || submission.members[0]?.fullName?.trim() || null;
};

export const buildFamilyReceptionApprovalWhatsAppMessage = (
  submissions: FamilyReceptionSubmission[]
) => {
  if (submissions.length === 1) {
    const submission = submissions[0];
    const informantName = findInformantName(submission);

    return [
      'Cadastro familiar — IBN',
      '',
      'Um formulário foi submetido para aprovação na recepção do cadastro familiar.',
      `Integrantes: ${submission.memberCount}`,
      informantName ? `Informante: ${informantName}` : null,
      '',
      'Acesse Manutenção → Recepção Familiar no app para revisar.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const lines = submissions.slice(0, 5).map((submission) => {
    const informantName = findInformantName(submission);
    return informantName
      ? `• ${informantName} (${submission.memberCount} integrante(s))`
      : `• ${submission.memberCount} integrante(s)`;
  });

  if (submissions.length > 5) {
    lines.push(`• … e mais ${submissions.length - 5} lote(s)`);
  }

  return [
    'Cadastro familiar — IBN',
    '',
    `${submissions.length} formulário(s) submetido(s) para aprovação na recepção do cadastro familiar.`,
    '',
    ...lines,
    '',
    'Acesse Manutenção → Recepção Familiar no app para revisar.',
  ].join('\n');
};

export async function notifySuperAdminOfNewFamilyReceptionSubmissions(
  submissions: FamilyReceptionSubmission[]
) {
  if (!submissions.length) {
    return { notified: false as const, reason: 'empty' as const };
  }

  const notifiedIds = await loadNotifiedSubmissionIds();
  const seeded = await hasNotifierBeenSeeded();

  if (!seeded) {
    submissions.forEach((submission) => notifiedIds.add(submission.submissionId));
    await saveNotifiedSubmissionIds(notifiedIds);
    await markNotifierSeeded();
    return { notified: false as const, reason: 'seeded' as const };
  }

  const newSubmissions = submissions.filter(
    (submission) => !notifiedIds.has(submission.submissionId)
  );

  if (!newSubmissions.length) {
    return { notified: false as const, reason: 'none_new' as const };
  }

  const phone = await fetchSuperAdminWhatsAppPhone();

  if (!phone) {
    return { notified: false as const, reason: 'missing_phone' as const };
  }

  const message = buildFamilyReceptionApprovalWhatsAppMessage(newSubmissions);

  try {
    await openWhatsAppPhone(phone, message);
  } catch (error) {
    console.warn('Não foi possível abrir WhatsApp para aviso de recepção familiar:', error);
    return { notified: false as const, reason: 'whatsapp_blocked' as const };
  }

  newSubmissions.forEach((submission) => notifiedIds.add(submission.submissionId));
  await saveNotifiedSubmissionIds(notifiedIds);

  return {
    notified: true as const,
    count: newSubmissions.length,
  };
}
