const memory = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }

    return memory.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }

    memory.set(key, value);
  },
  async removeItem(key: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }

    memory.delete(key);
  },
};

export default AsyncStorage;
