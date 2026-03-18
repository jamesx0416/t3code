import "../index.css";

import {
  ORCHESTRATION_WS_METHODS,
  type OrchestrationReadModel,
  type ServerConfig,
  WS_CHANNELS,
  WS_METHODS,
} from "@t3tools/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { http, HttpResponse, ws } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useComposerDraftStore } from "../composerDraftStore";
import { getRouter } from "../router";
import { useStore } from "../store";

const NOW_ISO = "2026-03-18T00:00:00.000Z";

interface TestFixture {
  snapshot: OrchestrationReadModel;
  serverConfig: ServerConfig;
}

let fixture: TestFixture;
let wsClient: { send: (data: string) => void } | null = null;
let pushSequence = 1;
const wsRequests: Array<Record<string, unknown>> = [];

const wsLink = ws.link(/ws(s)?:\/\/.*/);

function buildFixture(): TestFixture {
  return {
    snapshot: {
      snapshotSequence: 1,
      projects: [],
      threads: [],
      updatedAt: NOW_ISO,
    },
    serverConfig: {
      cwd: "/repo/project",
      keybindingsConfigPath: "/repo/project/.t3code-keybindings.json",
      keybindings: [],
      issues: [],
      providers: [
        {
          provider: "codex",
          status: "error",
          available: false,
          authStatus: "unknown",
          checkedAt: NOW_ISO,
          message: "Codex CLI (`codex`) is not installed or not on PATH.",
        },
      ],
      availableEditors: [],
    },
  };
}

function sendServerConfigUpdated() {
  if (!wsClient) {
    throw new Error("WebSocket client not connected");
  }

  wsClient.send(
    JSON.stringify({
      type: "push",
      sequence: pushSequence++,
      channel: WS_CHANNELS.serverConfigUpdated,
      data: {
        issues: fixture.serverConfig.issues,
        providers: fixture.serverConfig.providers,
      },
    }),
  );
}

const worker = setupWorker(
  wsLink.addEventListener("connection", ({ client }) => {
    wsClient = client;
    pushSequence = 1;
    client.send(
      JSON.stringify({
        type: "push",
        sequence: pushSequence++,
        channel: WS_CHANNELS.serverWelcome,
        data: {
          cwd: fixture.serverConfig.cwd,
          projectName: "Project",
        },
      }),
    );
    client.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      let request: { id: string; body: Record<string, unknown> & { _tag?: unknown } };
      try {
        request = JSON.parse(event.data);
      } catch {
        return;
      }

      const method = request.body._tag;
      if (typeof method !== "string") {
        return;
      }

      wsRequests.push(request.body);

      let result: unknown = {};
      if (method === ORCHESTRATION_WS_METHODS.getSnapshot) {
        result = fixture.snapshot;
      } else if (method === WS_METHODS.serverGetConfig) {
        result = fixture.serverConfig;
      } else if (method === WS_METHODS.serverValidateCodexCli) {
        fixture.serverConfig = {
          ...fixture.serverConfig,
          providers: [
            {
              provider: "codex",
              status: "ready",
              available: true,
              authStatus: "authenticated",
              checkedAt: "2026-03-18T00:00:01.000Z",
            },
          ],
        };
        result = fixture.serverConfig.providers[0];
        queueMicrotask(() => {
          sendServerConfigUpdated();
        });
      }

      client.send(
        JSON.stringify({
          id: request.id,
          result,
        }),
      );
    });
  }),
  http.get("*/attachments/:attachmentId", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/project-favicon", () => new HttpResponse(null, { status: 204 })),
);

async function waitForElement<T extends Element>(
  query: () => T | null,
  errorMessage: string,
): Promise<T> {
  let element: T | null = null;
  await vi.waitFor(
    () => {
      element = query();
      expect(element, errorMessage).toBeTruthy();
    },
    { timeout: 8_000, interval: 16 },
  );
  return element!;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("settings Codex validation", () => {
  beforeAll(async () => {
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  beforeEach(() => {
    fixture = buildFixture();
    wsClient = null;
    pushSequence = 1;
    wsRequests.length = 0;
    localStorage.clear();
    document.body.innerHTML = "";
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
    });
    useStore.setState({
      projects: [],
      threads: [],
      threadsHydrated: false,
    });
  });

  it("validates the Codex binary path on blur", async () => {
    const host = document.createElement("div");
    document.body.append(host);

    const router = getRouter(
      createMemoryHistory({
        initialEntries: ["/settings"],
      }),
    );

    const screen = await render(<RouterProvider router={router} />, { container: host });

    try {
      const binaryInput = await waitForElement(
        () => document.getElementById("codex-binary-path") as HTMLInputElement | null,
        "Unable to find the Codex binary path input.",
      );

      binaryInput.focus();
      setInputValue(binaryInput, "/custom/bin/codex");
      binaryInput.blur();

      await vi.waitFor(
        () => {
          expect(wsRequests).toContainEqual({
            _tag: WS_METHODS.serverValidateCodexCli,
            binaryPath: "/custom/bin/codex",
          });
        },
        { timeout: 8_000, interval: 16 },
      );
    } finally {
      await screen.unmount();
      host.remove();
    }
  });
});
