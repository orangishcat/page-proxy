import * as cloudFiles from './cloud-files';
import type {FileEntry, Result} from './file-types';
import * as localFiles from './local-files';
import {err, isFileTitleValid} from './file-types';

export type {FileEntry, Result} from './file-types';
export {isResultError} from './file-types';

const useLocalStorageMode = true;

const getMode = () => (useLocalStorageMode ? 'local' : 'cloud');

export const getLoginState = (): Promise<Result<boolean>> =>
  getMode() === 'local' ? localFiles.getLoginState() : cloudFiles.getLoginState();

export const listFiles = (): Promise<Result<FileEntry[]>> =>
  getMode() === 'local' ? localFiles.listFiles() : cloudFiles.listFiles();

export const getFile = (id: string): Promise<Result<FileEntry>> =>
  getMode() === 'local' ? localFiles.getFile(id) : cloudFiles.getFile(id);

export const createFile = (
  name: string,
  content: string
): Promise<Result<FileEntry>> =>
  !isFileTitleValid(name)
    ? Promise.resolve(err('File titles cannot include ":" or "/".'))
    : getMode() === 'local'
      ? localFiles.createFile(name, content)
      : cloudFiles.createFile(name, content);

export const deleteFile = (id: string): Promise<Result<string>> =>
  getMode() === 'local' ? localFiles.deleteFile(id) : cloudFiles.deleteFile(id);
