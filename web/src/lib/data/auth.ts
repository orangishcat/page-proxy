import {ID} from 'appwrite';
import http, {isAppwriteConfigured} from '$lib/api/http';
import {err, ok, type Result} from '$lib/data/file-types';

type AuthSuccess = {
  email: string;
};

type AuthPayload = {
  email: string;
  password: string;
  name?: string;
  captcha: string;
};

type HttpError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
};

const getStatus = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as HttpError).response;
    if (response && typeof response.status === 'number') {
      return response.status;
    }
  }
  return null;
};

export const signUpWithEmail = (
  payload: AuthPayload
): Promise<Result<AuthSuccess>> => {
  if (!isAppwriteConfigured()) {
    return Promise.resolve(err('Appwrite is not configured.'));
  }
  if (!payload.email.trim()) {
    return Promise.resolve(err('Email is required.'));
  }
  if (!payload.password.trim()) {
    return Promise.resolve(err('Password is required.'));
  }
  if (!payload.captcha.trim()) {
    return Promise.resolve(err('Captcha verification is required.'));
  }

  return http
    .post('/account', {
      userId: ID.unique(),
      email: payload.email.trim(),
      password: payload.password,
      name: payload.name?.trim() || undefined,
      captcha: payload.captcha
    })
    .then(() => ok({email: payload.email.trim()}))
    .catch((error) => {
      const status = getStatus(error);
      if (status === 401) {
        return err('Not authenticated to create an Appwrite account.');
      }
      if (status === 403) {
        return err('Not authorized to create an Appwrite account.');
      }
      if (status === 409) {
        return err('An account with this email already exists.');
      }
      if (status === 429) {
        return err('Too many sign-up attempts. Try again soon.');
      }
      if (!status) {
        return err('Network error while creating the Appwrite account.');
      }
      return err(`Appwrite error (${status}) while creating the account.`);
    });
};

export const signInWithEmail = (
  payload: AuthPayload
): Promise<Result<AuthSuccess>> => {
  if (!isAppwriteConfigured()) {
    return Promise.resolve(err('Appwrite is not configured.'));
  }
  if (!payload.email.trim()) {
    return Promise.resolve(err('Email is required.'));
  }
  if (!payload.password.trim()) {
    return Promise.resolve(err('Password is required.'));
  }
  if (!payload.captcha.trim()) {
    return Promise.resolve(err('Captcha verification is required.'));
  }

  return http
    .post('/account/sessions/email', {
      email: payload.email.trim(),
      password: payload.password,
      captcha: payload.captcha
    })
    .then(() => ok({email: payload.email.trim()}))
    .catch((error) => {
      const status = getStatus(error);
      if (status === 401) {
        return err('Incorrect email or password.');
      }
      if (status === 403) {
        return err('Not authorized to sign in to Appwrite.');
      }
      if (status === 429) {
        return err('Too many sign-in attempts. Try again soon.');
      }
      if (!status) {
        return err('Network error while signing in to Appwrite.');
      }
      return err(`Appwrite error (${status}) while signing in.`);
    });
};
