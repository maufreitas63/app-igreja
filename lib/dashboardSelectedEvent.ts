import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dashboard_selected_event_id';

type Listener = () => void;

let inMemorySelectedEventId: string | null = null;
const listeners = new Set<Listener>();

export const getDashboardSelectedEventIdSync = () => inMemorySelectedEventId;

export const readDashboardSelectedEventId = async (): Promise<string | null> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const changed = stored !== inMemorySelectedEventId;
    inMemorySelectedEventId = stored;

    if (changed) {
      listeners.forEach((listener) => listener());
    }

    return stored;
  } catch (error) {
    console.error('Erro ao ler evento selecionado do dashboard:', error);
    return inMemorySelectedEventId;
  }
};

export const writeDashboardSelectedEventId = async (eventId: string | null) => {
  inMemorySelectedEventId = eventId;

  try {
    if (eventId) {
      await AsyncStorage.setItem(STORAGE_KEY, eventId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Erro ao gravar evento selecionado do dashboard:', error);
  }

  listeners.forEach((listener) => listener());
};

export const subscribeDashboardSelectedEventId = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
