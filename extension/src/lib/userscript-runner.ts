import { browser } from "wxt/browser";

const codeRunnerScriptId = "page-proxy-code-runner";
const codeRunnerScriptFile = "code-runner-main-world.js";
const sandboxRunnerScriptId = "page-proxy-sandbox-runner";
const sandboxRunnerScriptFile = "sandbox-main-world.js";
const userscriptEnableMessage =
  "Userscripts API is not enabled. Enable it for Page Proxy, reload this tab, and run again.";
const userscriptWorldCsp = [
  "script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*",
  "object-src 'self'",
].join("; ");

type RegisteredUserscript = {
  id: string;
};

type UserscriptRegistration = {
  id: string;
  file: string;
};

const userscriptRegistrations: UserscriptRegistration[] = [
  { id: codeRunnerScriptId, file: codeRunnerScriptFile },
  { id: sandboxRunnerScriptId, file: sandboxRunnerScriptFile },
];

type UserScriptsApi = {
  configureWorld?: (properties: { messaging?: boolean; csp?: string }) => Promise<void>;
  getScripts?: (filter?: { ids?: string[] }) => Promise<RegisteredUserscript[]>;
  register: (
    scripts: Array<{
      id: string;
      matches?: string[];
      js: Array<{ file: string }>;
      runAt?: "document_start" | "document_end" | "document_idle";
      allFrames?: boolean;
    }>,
  ) => Promise<void>;
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
  const api = (browser as typeof browser & { userScripts?: UserScriptsApi }).userScripts;
  if (!api || typeof api.register !== "function") {
    return null;
  }

  return api;
};

const errorToMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isUnsupportedUserscriptWorldCspMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("configureworld") &&
    normalized.includes("csp") &&
    (normalized.includes("invalid") ||
      normalized.includes("unsupported") ||
      normalized.includes("unexpected") ||
      normalized.includes("unknown"))
  );
};

const isEnablementErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("userscript") &&
    (normalized.includes("enable") ||
      normalized.includes("disabled") ||
      normalized.includes("permission") ||
      normalized.includes("not available") ||
      normalized.includes("requires"))
  );
};

const toRegistrationFailure = (message: string): UserscriptRunnerStatus => {
  if (isEnablementErrorMessage(message)) {
    return {
      ok: false,
      needsEnablement: true,
      message: userscriptEnableMessage,
    };
  }

  return {
    ok: false,
    needsEnablement: false,
    message: `Unable to initialize Userscripts runner: ${message}`,
  };
};

const ensureWorldMessaging = async (api: UserScriptsApi) => {
  const configureWorld = api.configureWorld;
  if (typeof configureWorld !== "function") {
    return Promise.resolve<UserscriptRunnerStatus | null>(null);
  }

  try {
    await configureWorld({ messaging: true, csp: userscriptWorldCsp });
    return null;
  } catch (error) {
    const message = errorToMessage(error);
    if (!isUnsupportedUserscriptWorldCspMessage(message)) {
      return toRegistrationFailure(message);
    }
    try {
      await configureWorld({ messaging: true });
      return null;
    } catch (fallbackError) {
      return toRegistrationFailure(errorToMessage(fallbackError));
    }
  }
};

const toRegisterScript = ({ id, file }: UserscriptRegistration) => ({
  id,
  matches: ["<all_urls>"],
  js: [{ file }],
  runAt: "document_start" as const,
  allFrames: false,
});

const getMissingUserscripts = async (api: UserScriptsApi): Promise<UserscriptRegistration[]> => {
  if (typeof api.getScripts !== "function") {
    return Promise.resolve(userscriptRegistrations);
  }

  try {
    const scripts = await api.getScripts({ ids: userscriptRegistrations.map((registration) => registration.id) });
    const existingIds = new Set(scripts.map((script) => script.id));
    return userscriptRegistrations.filter((registration_1) => !existingIds.has(registration_1.id));
  } catch {
    return userscriptRegistrations;
  }
};

const registerUserscripts = (api: UserScriptsApi, registrations: UserscriptRegistration[]) =>
  api
    .register(registrations.map(toRegisterScript))
    .then(() => ({ ok: true }) satisfies UserscriptRunnerStatus)
    .catch((error: unknown) => toRegistrationFailure(errorToMessage(error)));

const ensureRequiredUserscripts = (api: UserScriptsApi) =>
  getMissingUserscripts(api).then((missingRegistrations) => {
    if (missingRegistrations.length === 0) {
      return { ok: true } satisfies UserscriptRunnerStatus;
    }

    return registerUserscripts(api, missingRegistrations);
  });

export const ensureCodeRunnerUserscript = async (): Promise<UserscriptRunnerStatus> => {
  if (ensureRunnerPromise) {
    return ensureRunnerPromise;
  }

  const api = getUserScriptsApi();
  if (!api) {
    return Promise.resolve({
      ok: false,
      needsEnablement: true,
      message: userscriptEnableMessage,
    });
  }

  ensureRunnerPromise = ensureWorldMessaging(api).then((status) => {
    if (status) {
      return status;
    }

    return ensureRequiredUserscripts(api);
  });

  const status_1 = await ensureRunnerPromise;
  if (!status_1.ok) {
    ensureRunnerPromise = null;
  }
  return status_1;
};

export const getUserscriptEnableMessage = () => userscriptEnableMessage;
