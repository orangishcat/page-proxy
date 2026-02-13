<script lang="ts">
  import {onMount} from 'svelte';
  import {Dialog} from 'bits-ui';
  import {isResultError} from '$lib/data/file-types';
  import {signInWithEmail, signUpWithEmail} from '$lib/data/auth';

  type AuthMode = 'sign-in' | 'sign-up';

  type AuthSuccessEvent = {
    mode: AuthMode;
    email: string;
  };

  type Props = {
    open?: boolean;
    onSuccess?: (event: AuthSuccessEvent) => void;
  };

  type HCaptchaApi = {
    render: (
      container: HTMLElement,
      options: {
        sitekey: string;
        theme: 'light' | 'dark';
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
      }
    ) => number;
    reset: (widgetId: number) => void;
  };

  let {open = $bindable(false), onSuccess}: Props = $props();

  const captchaSiteKey = import.meta.env.PUBLIC_HCAPTCHA_SITE_KEY as string | undefined;

  let mode = $state<AuthMode>('sign-in');
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let attemptedSubmit = $state(false);
  let touched = $state({name: false, email: false, password: false});
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);

  let captchaContainer = $state<HTMLDivElement | null>(null);
  let captchaWidgetId = $state<number | null>(null);
  let captchaToken = $state('');
  let captchaError = $state<string | null>(null);

  const getHcaptcha = () =>
    typeof window !== 'undefined'
      ? (window as Window & {hcaptcha?: HCaptchaApi}).hcaptcha
      : undefined;

  const resolveCaptchaTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const loadHcaptchaScript = () => {
    if (getHcaptcha()) {
      return Promise.resolve(true);
    }

    const existing = document.querySelector('script[data-hcaptcha]');
    if (existing) {
      return new Promise<boolean>((resolve) => {
        if (getHcaptcha()) {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true), {once: true});
        existing.addEventListener('error', () => resolve(false), {once: true});
      });
    }

    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.hcaptcha = 'true';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  };

  const renderCaptcha = () => {
    if (!captchaSiteKey) {
      captchaError = 'hCaptcha is not configured.';
      return;
    }
    if (!captchaContainer) {
      return;
    }
    const hcaptcha = getHcaptcha();
    if (!hcaptcha) {
      captchaError = 'hCaptcha failed to load.';
      return;
    }
    if (captchaWidgetId !== null) {
      return;
    }

    captchaWidgetId = hcaptcha.render(captchaContainer, {
      sitekey: captchaSiteKey,
      theme: resolveCaptchaTheme(),
      callback: (token) => {
        captchaToken = token;
        captchaError = null;
      },
      'expired-callback': () => {
        captchaToken = '';
      },
      'error-callback': () => {
        captchaToken = '';
        captchaError = 'Captcha validation failed. Try again.';
      }
    });
  };

  const attachCaptcha = (node: HTMLDivElement) => {
    captchaContainer = node;
    if (open) {
      renderCaptcha();
    }
    return {
      destroy() {
        if (captchaContainer === node) {
          captchaContainer = null;
        }
      }
    };
  };

  const resetCaptcha = () => {
    const hcaptcha = getHcaptcha();
    if (hcaptcha && captchaWidgetId !== null) {
      hcaptcha.reset(captchaWidgetId);
    }
    captchaToken = '';
  };

  const resetForm = () => {
    mode = 'sign-in';
    name = '';
    email = '';
    password = '';
    attemptedSubmit = false;
    touched = {name: false, email: false, password: false};
    isSubmitting = false;
    errorMessage = null;
    statusMessage = null;
    captchaError = null;
    resetCaptcha();
  };

  const nameValue = () => name.trim();
  const emailValue = () => email.trim();
  const passwordValue = () => password;

  const isValidEmail = () => {
    const value = emailValue();
    if (!value) {
      return false;
    }
    return value.includes('@') && value.includes('.');
  };

  const isValidPassword = () => passwordValue().length >= 8;
  const isValidName = () => nameValue().length >= 2;

  const isFormValid = () => {
    const captchaReady = Boolean(captchaToken);
    if (mode === 'sign-up') {
      return isValidName() && isValidEmail() && isValidPassword() && captchaReady;
    }
    return isValidEmail() && isValidPassword() && captchaReady;
  };

  const switchMode = (nextMode: AuthMode, preserveStatus = false) => {
    if (mode === nextMode) {
      return;
    }
    mode = nextMode;
    attemptedSubmit = false;
    touched = {name: false, email: false, password: false};
    errorMessage = null;
    if (!preserveStatus) {
      statusMessage = null;
    }
    resetCaptcha();
  };

  const handleSubmit = async () => {
    attemptedSubmit = true;
    errorMessage = null;
    statusMessage = null;

    if (!isFormValid()) {
      if (!captchaToken) {
        captchaError = 'Complete the captcha to continue.';
      }
      return;
    }

    isSubmitting = true;

    if (mode === 'sign-in') {
      const result = await signInWithEmail({
        email: emailValue(),
        password: passwordValue(),
        captcha: captchaToken
      });

      isSubmitting = false;

      if (isResultError(result)) {
        errorMessage = result.error;
        resetCaptcha();
        return;
      }

      onSuccess?.({mode, email: emailValue()});
      resetForm();
      open = false;
      return;
    }

    const result = await signUpWithEmail({
      email: emailValue(),
      password: passwordValue(),
      name: nameValue(),
      captcha: captchaToken
    });

    isSubmitting = false;

    if (isResultError(result)) {
      errorMessage = result.error;
      resetCaptcha();
      return;
    }

    statusMessage = 'Account created. Sign in to continue.';
    switchMode('sign-in', true);
  };

  onMount(() => {
    if (!captchaSiteKey) {
      captchaError = 'hCaptcha site key is missing.';
      return;
    }

    loadHcaptchaScript().then((loaded) => {
      if (!loaded) {
        captchaError = 'Unable to load hCaptcha.';
        return;
      }
      renderCaptcha();
    });
  });
</script>

<Dialog.Root
  bind:open
  onOpenChange={(nextOpen) => {
    if (!nextOpen) {
      resetForm();
      return;
    }
    renderCaptcha();
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-gray-950/70" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-300 bg-gray-300 p-6 text-gray-700 shadow-2xl will-change-[transform,opacity] data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out dark:border-gray-700 dark:bg-gray-850 dark:text-gray-100"
    >
      <div class="grid gap-2">
        <Dialog.Title class="text-title">
          {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
        </Dialog.Title>
        <Dialog.Description class="text-body text-gray-500 dark:text-gray-200">
          {mode === 'sign-in'
            ? 'Sign in with your Appwrite credentials to access your projects.'
            : 'Create a new Appwrite account to sync your projects.'}
        </Dialog.Description>
      </div>

      <div class="mt-4 flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-100 p-1 text-caption text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <button
          class="flex-1 rounded-lg px-3 py-2 text-center transition hover:bg-gray-200 dark:hover:bg-gray-800"
          class:font-semibold={mode === 'sign-in'}
          class:bg-white={mode === 'sign-in'}
          class:text-gray-900={mode === 'sign-in'}
          class:shadow-sm={mode === 'sign-in'}
          class:dark:bg-gray-800={mode === 'sign-in'}
          class:dark:text-gray-100={mode === 'sign-in'}
          type="button"
          onclick={() => switchMode('sign-in')}
        >
          Sign in
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-center transition hover:bg-gray-200 dark:hover:bg-gray-800"
          class:font-semibold={mode === 'sign-up'}
          class:bg-white={mode === 'sign-up'}
          class:text-gray-900={mode === 'sign-up'}
          class:shadow-sm={mode === 'sign-up'}
          class:dark:bg-gray-800={mode === 'sign-up'}
          class:dark:text-gray-100={mode === 'sign-up'}
          type="button"
          onclick={() => switchMode('sign-up')}
        >
          Sign up
        </button>
      </div>

      <form
        class="mt-6 grid gap-4"
        onsubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        novalidate
      >
        {#if mode === 'sign-up'}
          <label class="grid gap-2">
            <span class="flex items-center justify-between gap-4">
              <span class="text-label text-gray-600 dark:text-gray-300">Name</span>
              {#if (attemptedSubmit || touched.name) && !isValidName()}
                <span class="text-caption text-red-600 dark:text-red-400">
                  Enter at least 2 characters.
                </span>
              {/if}
            </span>
            <input
              class="h-10 rounded-xl border border-gray-300 bg-white px-3 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              type="text"
              name="name"
              placeholder="Alex Kim"
              bind:value={name}
              required
              aria-invalid={(attemptedSubmit || touched.name) && !isValidName()}
              onblur={() => {
                touched = {...touched, name: true};
              }}
            />
          </label>
        {/if}

        <label class="grid gap-2">
          <span class="flex items-center justify-between gap-4">
            <span class="text-label text-gray-600 dark:text-gray-300">Email</span>
            {#if (attemptedSubmit || touched.email) && !isValidEmail()}
              <span class="text-caption text-red-600 dark:text-red-400">Enter a valid email.</span>
            {/if}
          </span>
          <input
            class="h-10 rounded-xl border border-gray-300 bg-white px-3 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            type="email"
            name="email"
            placeholder="you@work.com"
            bind:value={email}
            required
            aria-invalid={(attemptedSubmit || touched.email) && !isValidEmail()}
            onblur={() => {
              touched = {...touched, email: true};
            }}
          />
        </label>

        <label class="grid gap-2">
          <span class="flex items-center justify-between gap-4">
            <span class="text-label text-gray-600 dark:text-gray-300">Password</span>
            {#if (attemptedSubmit || touched.password) && !isValidPassword()}
              <span class="text-caption text-red-600 dark:text-red-400">
                Use at least 8 characters.
              </span>
            {/if}
          </span>
          <input
            class="h-10 rounded-xl border border-gray-300 bg-white px-3 text-body text-gray-700 shadow-sm outline-none ring-0 transition focus:border-accent-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            type="password"
            name="password"
            placeholder="••••••••"
            bind:value={password}
            required
            aria-invalid={(attemptedSubmit || touched.password) && !isValidPassword()}
            onblur={() => {
              touched = {...touched, password: true};
            }}
          />
        </label>

        <div class="grid gap-2">
          <span class="text-label text-gray-600 dark:text-gray-300">Verification</span>
          <div
            class="rounded-xl border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div use:attachCaptcha class="min-h-20"></div>
          </div>
          {#if captchaError}
            <span class="text-caption text-red-600 dark:text-red-400">{captchaError}</span>
          {/if}
        </div>

        {#if errorMessage}
          <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-caption text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
            {errorMessage}
          </div>
        {/if}

        {#if statusMessage}
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-caption text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
            {statusMessage}
          </div>
        {/if}

        <div class="mt-2 flex items-center justify-end gap-4">
          <Dialog.Close
            class="rounded-lg border border-secondary-500/65 bg-transparent px-4 py-1.5 text-button text-gray-700 hover:bg-gray-300 hover:opacity-100 active:opacity-100 dark:text-gray-100 dark:hover:bg-gray-600"
            onclick={resetForm}
            type="button"
          >
            Cancel
          </Dialog.Close>
          <button
            class="rounded-lg border border-secondary-500/65 bg-radial from-primary-600 to-primary-400 px-4 py-1.5 text-button text-gray-700 hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100"
            type="submit"
            disabled={!isFormValid() || isSubmitting}
          >
            {isSubmitting
              ? mode === 'sign-in'
                ? 'Signing in...'
                : 'Signing up...'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
