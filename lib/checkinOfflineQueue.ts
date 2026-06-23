import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'geo_checkin_offline_queue_v1';

export type GeoCheckinQueueOperation =
  | {
      type: 'confirm';
      eventId: string;
      familyId: string;
      latitude: number;
      longitude: number;
      skipGeofence?: boolean;
    }
  | {
      type: 'sync_registrations';
      eventId: string;
      familyId: string;
      memberIds: string[];
      latitude: number;
      longitude: number;
      skipGeofence?: boolean;
    };

export type GeoCheckinQueueItem = GeoCheckinQueueOperation & {
  id: string;
  createdAt: string;
};

const generateQueueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const isDeviceOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }

  return true;
};

const readQueue = async (): Promise<GeoCheckinQueueItem[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as GeoCheckinQueueItem[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (items: GeoCheckinQueueItem[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const enqueueGeoCheckinOperation = async (
  operation: GeoCheckinQueueOperation
): Promise<GeoCheckinQueueItem> => {
  const item: GeoCheckinQueueItem = {
    ...operation,
    id: generateQueueId(),
    createdAt: new Date().toISOString(),
  };

  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);

  return item;
};

export const peekGeoCheckinQueue = () => readQueue();

export const removeGeoCheckinQueueItem = async (id: string) => {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
};

export const clearGeoCheckinQueue = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

export type GeoCheckinQueueProcessor = (item: GeoCheckinQueueItem) => Promise<boolean>;

let drainInFlight: Promise<number> | null = null;
let onlineListenerAttached = false;

export const drainGeoCheckinQueue = async (
  processor: GeoCheckinQueueProcessor
): Promise<number> => {
  if (drainInFlight) {
    return drainInFlight;
  }

  drainInFlight = (async () => {
    if (!isDeviceOnline()) {
      return 0;
    }

    const queue = await readQueue();
    let processed = 0;

    for (const item of queue) {
      if (!isDeviceOnline()) {
        break;
      }

      try {
        const ok = await processor(item);

        if (ok) {
          await removeGeoCheckinQueueItem(item.id);
          processed += 1;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    return processed;
  })().finally(() => {
    drainInFlight = null;
  });

  return drainInFlight;
};

export const attachGeoCheckinOnlineSync = (processor: GeoCheckinQueueProcessor) => {
  if (onlineListenerAttached || Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => undefined;
  }

  onlineListenerAttached = true;

  const handleOnline = () => {
    void drainGeoCheckinQueue(processor);
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
    onlineListenerAttached = false;
  };
};
