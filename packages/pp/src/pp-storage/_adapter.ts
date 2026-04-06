export type RawStorageAdapter = {
  listKeys: () => string[];
  getItem: (storageKey: string) => string | null;
  setItem: (storageKey: string, value: string) => void;
  removeItem: (storageKey: string) => void;
};

export const localStorageAdapter: RawStorageAdapter = {
  listKeys: () => {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  },
  getItem: (storageKey) => localStorage.getItem(storageKey),
  setItem: (storageKey, value) => {
    localStorage.setItem(storageKey, value);
  },
  removeItem: (storageKey) => {
    localStorage.removeItem(storageKey);
  },
};
