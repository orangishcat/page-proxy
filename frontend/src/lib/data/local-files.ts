import type {FileEntry, Result} from './file-types';
import {err, ok, sanitizeFileTitle} from './file-types';

const legacyLocalStorageKey = 'page-proxy-files';
const localStorageFilePrefix = 'file_';
const localFileScheme = 'file://';

const ensureTextFilename = (name: string) => {
  const trimmed = sanitizeFileTitle(name);
  if (trimmed.endsWith('.js')) {
    return trimmed;
  }
  return `${trimmed || 'Untitled'}.js`;
};

const toLocalFileId = (id: string) =>
  id.startsWith(localFileScheme) ? id : `${localFileScheme}${id}`;

const fromLocalFileId = (id: string) =>
  id.startsWith(localFileScheme) ? id.slice(localFileScheme.length) : id;

const toLocalStorageKey = (id: string) => `${localStorageFilePrefix}${id}`;

const ensureUniqueLocalId = (baseId: string) => {
  if (typeof localStorage === 'undefined') {
    return baseId;
  }

  const extensionIndex = baseId.lastIndexOf('.');
  const stem = extensionIndex > 0 ? baseId.slice(0, extensionIndex) : baseId;
  const extension = extensionIndex > 0 ? baseId.slice(extensionIndex) : '';
  let candidate = baseId;
  let counter = 1;

  while (localStorage.getItem(toLocalStorageKey(candidate)) !== null) {
    candidate = `${stem}-${counter}${extension}`;
    counter += 1;
  }

  return candidate;
};

const migrateLegacyLocalFiles = () => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const raw = localStorage.getItem(legacyLocalStorageKey);
  if (!raw) {
    return;
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    localStorage.removeItem(legacyLocalStorageKey);
    return;
  }

  parsed
    .filter((item) => typeof item === 'object' && item !== null)
    .forEach((item) => {
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : 'Untitled.js';
      const content = typeof record.content === 'string' ? record.content : '';
      const baseId = ensureTextFilename(name);
      const id = ensureUniqueLocalId(baseId);
      localStorage.setItem(toLocalStorageKey(id), content);
    });

  localStorage.removeItem(legacyLocalStorageKey);
};

const readLocalFiles = (): FileEntry[] => {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  migrateLegacyLocalFiles();

  const entries: FileEntry[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(localStorageFilePrefix)) {
      continue;
    }
    const id = key.slice(localStorageFilePrefix.length);
    const content = localStorage.getItem(key) ?? '';
    entries.push({
      id: toLocalFileId(id),
      name: ensureTextFilename(id),
      content,
      updatedAt: new Date().toISOString(),
      source: 'local'
    });
  }

  return entries;
};

export const getLoginState = (): Promise<Result<boolean>> => Promise.resolve(ok(false));

export const listFiles = (): Promise<Result<FileEntry[]>> =>
  Promise.resolve(ok(readLocalFiles()));

export const getFile = (id: string): Promise<Result<FileEntry>> => {
  if (typeof localStorage === 'undefined') {
    return Promise.resolve(
      err('Local storage is unavailable in this environment.')
    );
  }
  const baseId = fromLocalFileId(id);
  const key = toLocalStorageKey(baseId);
  const content = localStorage.getItem(key);
  if (content === null) {
    return Promise.resolve(err('Local file not found.'));
  }
  const entry: FileEntry = {
    id: toLocalFileId(baseId),
    name: ensureTextFilename(baseId),
    content,
    updatedAt: new Date().toISOString(),
    source: 'local'
  };
  return Promise.resolve(ok(entry));
};

export const createFile = (
  name: string,
  content: string
): Promise<Result<FileEntry>> => {
  if (typeof localStorage === 'undefined') {
    return Promise.resolve(
      err('Local storage is unavailable in this environment.')
    );
  }

  const baseId = ensureTextFilename(name);
  const id = ensureUniqueLocalId(baseId);
  const entry: FileEntry = {
    id: toLocalFileId(id),
    name: ensureTextFilename(id),
    content,
    updatedAt: new Date().toISOString(),
    source: 'local'
  };
  localStorage.setItem(toLocalStorageKey(id), content);
  return Promise.resolve(ok(entry));
};

export const deleteFile = (id: string): Promise<Result<string>> => {
  if (typeof localStorage === 'undefined') {
    return Promise.resolve(
      err('Local storage is unavailable in this environment.')
    );
  }
  const baseId = fromLocalFileId(id);
  const key = toLocalStorageKey(baseId);
  if (!localStorage.getItem(key)) {
    return Promise.resolve(err('Local file not found.'));
  }
  localStorage.removeItem(key);
  return Promise.resolve(ok(id));
};

export const getAccount = (): Promise<Result<null>> =>
  Promise.resolve(ok(null));

export const signOut = (): Promise<Result<boolean>> =>
  Promise.resolve(ok(false));
