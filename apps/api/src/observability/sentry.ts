import * as Sentry from "@sentry/node";

export interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
}

export function initSentry(options: SentryInitOptions): boolean {
  if (options.dsn.trim().length === 0) {
    return false;
  }

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    tracesSampleRate: options.environment === "production" ? 0.1 : 0,
    sendDefaultPii: false,
  });

  return true;
}

export function captureException(error: unknown, requestId: string): void {
  if (!isSentryActive()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("requestId", requestId);
    Sentry.captureException(error);
  });
}

export async function flushSentry(): Promise<void> {
  if (!isSentryActive()) {
    return;
  }
  await Sentry.flush(2000);
}

function isSentryActive(): boolean {
  if (typeof Sentry.isInitialized === "function") {
    return Sentry.isInitialized();
  }
  return Sentry.getClient() !== undefined;
}
