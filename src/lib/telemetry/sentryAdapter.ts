import { captureException, captureMessage, init, withScope } from "@sentry/react";
import type { RuntimeConfig } from "../../config/runtimeConfig";
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent } from "./privacy";
import type { TelemetryClient } from "./telemetry";

export function createSentryTelemetryClient(config: RuntimeConfig): TelemetryClient {
  init({
    dsn: config.sentryDsn ?? undefined,
    environment: config.environment,
    release: config.version,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
  });
  return {
    captureException(error, context) {
      withScope((scope) => {
        if (context) scope.setTags(context);
        captureException(error);
      });
    },
    captureEvent(name, context) {
      withScope((scope) => {
        if (context) scope.setTags(context);
        captureMessage(name, "info");
      });
    },
  };
}
