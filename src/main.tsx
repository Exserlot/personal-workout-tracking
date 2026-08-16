import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/thai-700.css";
import { App } from "./app/App";
import { AppErrorBoundary, RouterErrorBoundary } from "./components/layout/AppErrorBoundary";
import { runtimeConfigState } from "./config/runtimeConfig";
import { initializeTelemetry } from "./lib/telemetry/telemetry";
import "./styles/globals.css";

void initializeTelemetry(runtimeConfigState.config).catch(() => undefined);

const router = createBrowserRouter([
  {
    path: "*",
    element: <App />,
    errorElement: <RouterErrorBoundary />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </React.StrictMode>,
);
