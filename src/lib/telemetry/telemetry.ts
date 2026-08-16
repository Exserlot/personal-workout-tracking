import type { RuntimeConfig } from "../../config/runtimeConfig";

export type TelemetryValue = string | number | boolean | null;
export type TelemetryContext = Record<string, TelemetryValue>;

export interface TelemetryClient {
  captureException(error: unknown, context?: TelemetryContext): void;
  captureEvent(name: string, context?: TelemetryContext): void;
}

const noopClient: TelemetryClient = {
  captureException: () => undefined,
  captureEvent: () => undefined,
};

let activeClient = noopClient;

export const telemetry: TelemetryClient = {
  captureException: (error, context) => activeClient.captureException(error, context),
  captureEvent: (name, context) => activeClient.captureEvent(name, context),
};

export function setTelemetryClient(client: TelemetryClient | null) {
  activeClient = client ?? noopClient;
}

export async function initializeTelemetry(config: RuntimeConfig | null) {
  if (!config || config.environment === "local" || !config.sentryDsn) {
    setTelemetryClient(null);
    return;
  }

  const { createSentryTelemetryClient } = await import("./sentryAdapter");
  setTelemetryClient(createSentryTelemetryClient(config));
}
