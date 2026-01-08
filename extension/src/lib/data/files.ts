import type {Result} from './file-types';
import {ok} from './file-types';

export type AccountProfile = {
  name: string;
  email: string;
};

export const getAccount = (): Promise<Result<AccountProfile | null>> =>
  Promise.resolve(ok(null));

export const signOut = (): Promise<Result<boolean>> =>
  Promise.resolve(ok(true));
