import {spawn} from 'node:child_process';

const BASE_URL = process.env.PAGE_LOAD_BASE_URL ?? 'http://127.0.0.1:4173';
const PATHS = (process.env.PAGE_LOAD_PATHS ?? '/,/app/dashboard')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
const SERVER_TIMEOUT_MS = Number(process.env.PAGE_LOAD_SERVER_TIMEOUT_MS ?? 15_000);
const REQUEST_TIMEOUT_MS = Number(process.env.PAGE_LOAD_REQUEST_TIMEOUT_MS ?? 8_000);
const POLL_INTERVAL_MS = 300;

const controllerForTimeout = (timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {controller, timer};
};

const fetchWithTimeout = async (url, timeoutMs) => {
  const {controller, timer} = controllerForTimeout(timeoutMs);
  try {
    return await fetch(url, {signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
};

const waitForServer = async (url, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (response.status < 400) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Preview server did not respond within ${timeoutMs}ms.`);
};

const run = async () => {
  const child = spawn(
    'bun',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'],
    {
      cwd: process.cwd(),
      env: {...process.env},
      stdio: 'inherit'
    }
  );

  let previewExited = false;
  child.on('exit', (code, signal) => {
    previewExited = true;
    if (code !== 0) {
      console.error(`Preview server exited with code ${code ?? 'unknown'}.`);
    } else if (signal) {
      console.error(`Preview server exited with signal ${signal}.`);
    }
  });
  child.on('error', (error) => {
    previewExited = true;
    console.error(`Failed to start preview server: ${error.message}`);
  });

  const shutdown = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };

  process.on('SIGINT', () => {
    shutdown();
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    shutdown();
    process.exit(1);
  });

  let exitCode = 0;

  try {
    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS);
    if (previewExited) {
      throw new Error('Preview server exited before checks completed.');
    }

    for (const path of PATHS) {
      const url = new URL(path, BASE_URL).toString();
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (response.status >= 400) {
        throw new Error(`Page ${url} returned status ${response.status}.`);
      }
    }
  } catch (error) {
    exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    shutdown();
  }

  process.exit(exitCode);
};

run();
