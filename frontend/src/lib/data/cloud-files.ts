import {Account, Client, Databases, ID} from 'appwrite';
import type {FileEntry, Result} from './file-types';
import {err, ok} from './file-types';

const appwriteEndpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const appwriteProjectId = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.PUBLIC_APPWRITE_DATABASE_ID;
const tableId = import.meta.env.PUBLIC_APPWRITE_PROJECTS_TABLE_ID;

const isAppwriteReady = () =>
  Boolean(appwriteEndpoint && appwriteProjectId && databaseId && tableId);

const getClient = () => {
  const client = new Client();
  if (appwriteEndpoint) {
    client.setEndpoint(appwriteEndpoint);
  }
  if (appwriteProjectId) {
    client.setProject(appwriteProjectId);
  }
  return client;
};

const ensureTextFilename = (name: string) => {
  const trimmed = name.trim();
  if (trimmed.endsWith('.js')) {
    return trimmed;
  }
  return `${trimmed || 'Untitled'}.js`;
};

const toAppwriteFile = (item: Record<string, unknown>): FileEntry => {
  const name =
    (typeof item.name === 'string' && item.name) ||
    (typeof item.title === 'string' && item.title) ||
    'Untitled.txt';
  const content = typeof item.content === 'string' ? item.content : '';
  const updatedAt =
    (typeof item.updatedAt === 'string' && item.updatedAt) ||
    (typeof item.$updatedAt === 'string' && item.$updatedAt) ||
    (typeof item.$createdAt === 'string' && item.$createdAt) ||
    new Date().toISOString();
  const id =
    (typeof item.$id === 'string' && item.$id) ||
    (typeof item.id === 'string' && item.id) ||
    crypto.randomUUID();

  return {
    id,
    name: ensureTextFilename(name),
    content,
    updatedAt,
    source: 'appwrite'
  };
};

const getErrorCode = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as {code: unknown}).code;
    return typeof code === 'number' ? code : null;
  }
  return null;
};

export const getLoginState = (): Promise<Result<boolean>> => {
  if (!isAppwriteReady()) {
    return Promise.resolve(ok(false));
  }

  const account = new Account(getClient());

  return account
    .get()
    .then(() => ok(true))
    .catch((error) => {
      const status = getErrorCode(error);
      if (status === 401) {
        return ok(false);
      }
      if (status === 403) {
        return err('Not authorized to read the Appwrite account.');
      }
      if (!status) {
        return err('Network error while checking Appwrite login.');
      }
      return err(`Appwrite error (${status}) while checking login.`);
    });
};

export const listFiles = (): Promise<Result<FileEntry[]>> => {
  if (!isAppwriteReady()) {
    return Promise.resolve(err('Appwrite is not configured.'));
  }

  const databases = new Databases(getClient());

  return databases
    .listDocuments(databaseId, tableId)
    .then((response) => ok(response.documents.map(toAppwriteFile)))
    .catch((error) => {
      const status = getErrorCode(error);
      if (status === 401) {
        return err('Not authenticated with Appwrite.');
      }
      if (status === 403) {
        return err('Not authorized to read Appwrite files.');
      }
      if (!status) {
        return err('Network error while loading Appwrite files.');
      }
      return err(`Appwrite error (${status}) while loading files.`);
    });
};

export const createFile = (
  name: string,
  content: string
): Promise<Result<FileEntry>> => {
  if (!isAppwriteReady()) {
    return Promise.resolve(err('Appwrite is not configured.'));
  }

  const databases = new Databases(getClient());
  const payload = {
    name: ensureTextFilename(name),
    content,
    updatedAt: new Date().toISOString()
  };

  return databases
    .createDocument(databaseId, tableId, ID.unique(), payload)
    .then((document) => ok(toAppwriteFile(document)))
    .catch((error) => {
      const status = getErrorCode(error);
      if (status === 401) {
        return err('Not authenticated with Appwrite.');
      }
      if (status === 403) {
        return err('Not authorized to create Appwrite files.');
      }
      if (!status) {
        return err('Network error while creating Appwrite file.');
      }
      return err(`Appwrite error (${status}) while creating file.`);
    });
};

export const deleteFile = (id: string): Promise<Result<string>> => {
  if (!isAppwriteReady()) {
    return Promise.resolve(err('Appwrite is not configured.'));
  }

  const databases = new Databases(getClient());

  return databases
    .deleteDocument(databaseId, tableId, id)
    .then(() => ok(id))
    .catch((error) => {
      const status = getErrorCode(error);
      if (status === 401) {
        return err('Not authenticated with Appwrite.');
      }
      if (status === 403) {
        return err('Not authorized to delete Appwrite files.');
      }
      if (!status) {
        return err('Network error while deleting Appwrite file.');
      }
      return err(`Appwrite error (${status}) while deleting file.`);
    });
};
