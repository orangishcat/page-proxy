import {browser} from 'wxt/browser';

const codeRunnerScriptId = 'page-proxy-code-runner';
const codeRunnerScriptFile = 'code-runner-main-world.js';
const userscriptEnableMessage =
  'Userscripts API is not enabled. Enable it for Page Proxy, reload this tab, and run again.';
const userscriptWorldCsp = [
  "script-src 'self' blob: 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*",
  "object-src 'self'"
].join('; ');

type RegisteredUserscript = {
  id: string;
};

type UserScriptsApi = {
  configureWorld?: (properties: {messaging?: boolean; csp?: string}) => Promise<void>;
  getScripts?: (filter?: {ids?: string[]}) => Promise<RegisteredUserscript[]>;
  register: (scripts: Array<{
    id: string;
    matches?: string[];
    js: Array<{file: string}>;
    runAt?: 'document_start' | 'document_end' | 'document_idle';
    allFrames?: boolean;
  }>) => Promise<void>;
};

export type UserscriptRunnerStatus =
  | {
      ok: true;
    }
  | {
      ok: false;
      needsEnablement: boolean;
      message: string;
    };

let ensureRunnerPromise: Promise<UserscriptRunnerStatus> | null = null;

const getUserScriptsApi = (): UserScriptsApi | null => {
  const api = (browser as typeof browser & {userScripts?: UserScriptsApi}).userScripts;
  if (!api || typeof api.register !== 'function') {
    return null;
  }

  return api;
};

const errorToMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isUnsupportedUserscriptWorldCspMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('configureworld') &&
    normalized.includes('csp') &&
    (
      normalized.includes('invalid') ||
      normalized.includes('unsupported') ||
      normalized.includes('unexpected') ||
      normalized.includes('unknown')
    )
  );
};

const isEnablementErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('userscript') &&
    (
      normalized.includes('enable') ||
      normalized.includes('disabled') ||
      normalized.includes('permission') ||
      normalized.includes('not available') ||
      normalized.includes('requires')
    )
  );
};

const toRegistrationFailure = (message: string): UserscriptRunnerStatus => {
  if (isEnablementErrorMessage(message)) {
    return {
      ok: false,
      needsEnablement: true,
      message: userscriptEnableMessage
    };
  }

  return {
    ok: false,
    needsEnablement: false,
    message: `Unable to initialize Userscripts runner: ${message}`
  };
};

const ensureWorldMessaging = (api: UserScriptsApi) => {
  const configureWorld = api.configureWorld;
  if (typeof configureWorld !== 'function') {
    return Promise.resolve<UserscriptRunnerStatus | null>(null);
  }

  return configureWorld({messaging: true, csp: userscriptWorldCsp})
    .then(() => null)
    .catch((error: unknown) => {
      const message = errorToMessage(error);
      if (!isUnsupportedUserscriptWorldCspMessage(message)) {
        return toRegistrationFailure(message);
      }

      return configureWorld({messaging: true})
        .then(() => null)
        .catch((fallbackError: unknown) => toRegistrationFailure(errorToMessage(fallbackError)));
    });
};

const hasCodeRunnerScript = (api: UserScriptsApi) => {
  if (typeof api.getScripts !== 'function') {
    return Promise.resolve(false);
  }

  return api
    .getScripts({ids: [codeRunnerScriptId]})
    .then((scripts) => scripts.some((script) => script.id === codeRunnerScriptId))
    .catch(() => false);
};

const registerCodeRunnerScript = (api: UserScriptsApi) =>
  api
    .register([
      {
        id: codeRunnerScriptId,
        matches: ['<all_urls>'],
        js: [{file: codeRunnerScriptFile}],
        runAt: 'document_start',
        allFrames: false
      }
    ])
    .then(() => ({ok: true} satisfies UserscriptRunnerStatus))
    .catch((error: unknown) => toRegistrationFailure(errorToMessage(error)));

const ensureCodeRunnerScript = (api: UserScriptsApi) =>
  hasCodeRunnerScript(api).then((hasRegistration) => {
    if (hasRegistration) {
      return {ok: true} satisfies UserscriptRunnerStatus;
    }

    return registerCodeRunnerScript(api);
  });

export const ensureCodeRunnerUserscript = (): Promise<UserscriptRunnerStatus> => {
  if (ensureRunnerPromise) {
    return ensureRunnerPromise;
  }

  const api = getUserScriptsApi();
  if (!api) {
    return Promise.resolve({
      ok: false,
      needsEnablement: true,
      message: userscriptEnableMessage
    });
  }

  ensureRunnerPromise = ensureWorldMessaging(api).then((status) => {
    if (status) {
      return status;
    }

    return ensureCodeRunnerScript(api);
  });

  return ensureRunnerPromise.then((status) => {
    if (!status.ok) {
      ensureRunnerPromise = null;
    }
    return status;
  });
};

export const getUserscriptEnableMessage = () => userscriptEnableMessage;
