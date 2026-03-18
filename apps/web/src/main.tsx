import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "./index.css";

import { hydrateDesktopSettings } from "./desktopSettings";
import { isElectron } from "./env";
import { APP_DISPLAY_NAME } from "./branding";

// Electron loads the app from a file-backed shell, so hash history avoids path resolution issues.
const history = isElectron ? createHashHistory() : createBrowserHistory();

document.title = APP_DISPLAY_NAME;

async function bootstrap() {
  if (isElectron) {
    await hydrateDesktopSettings();
  }

  const { getRouter } = await import("./router");
  const router = getRouter(history);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

void bootstrap();
