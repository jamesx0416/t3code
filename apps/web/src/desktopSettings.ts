import type { DesktopSettings, DesktopSettingsInput, ThemePreference } from "@t3tools/contracts";
import {
  AppSettings as AppSettingsSchema,
  DesktopSettingsSchemaVersion,
  ThemePreference as ThemePreferenceSchema,
} from "@t3tools/contracts";
import { Schema } from "effect";
import { APP_VERSION } from "./branding";
import { isElectron } from "./env";
import {
  dispatchLocalStorageChange,
  getLocalStorageItem,
  setLocalStorageItem,
} from "./hooks/useLocalStorage";
import type { AppSettings } from "./appSettings";

const APP_SETTINGS_STORAGE_KEY = "t3code:app-settings:v1";
const THEME_STORAGE_KEY = "t3code:theme";
const DEFAULT_APP_SETTINGS = AppSettingsSchema.makeUnsafe({});
const DEFAULT_THEME: ThemePreference = "system";
const INITIAL_DESKTOP_SETTINGS = isElectron
  ? (window.desktopBridge?.initialSettings ?? null)
  : null;

let desktopSettingsHydrated = false;
let lastPersistedSerialized: string | null = null;
let latestTheme: ThemePreference = DEFAULT_THEME;
let latestAppSettings: AppSettings = DEFAULT_APP_SETTINGS;

function readThemeFromLocalStorage(): ThemePreference {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

function buildDesktopSettingsInput(): DesktopSettingsInput {
  return {
    theme: latestTheme,
    appSettings: latestAppSettings,
  };
}

function serializeSettingsInput(input: DesktopSettingsInput): string {
  return JSON.stringify(input);
}

function hasLegacySettingsInLocalStorage(): boolean {
  return (
    localStorage.getItem(THEME_STORAGE_KEY) !== null ||
    localStorage.getItem(APP_SETTINGS_STORAGE_KEY) !== null
  );
}

function applyDesktopSettings(settings: DesktopSettings): void {
  localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
  setLocalStorageItem(APP_SETTINGS_STORAGE_KEY, settings.appSettings, AppSettingsSchema);
  dispatchLocalStorageChange(APP_SETTINGS_STORAGE_KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
  latestTheme = settings.theme;
  latestAppSettings = settings.appSettings;
  lastPersistedSerialized = serializeSettingsInput({
    theme: settings.theme,
    appSettings: settings.appSettings,
  });
}

if (INITIAL_DESKTOP_SETTINGS) {
  applyDesktopSettings(INITIAL_DESKTOP_SETTINGS);
  desktopSettingsHydrated = true;
}

export async function hydrateDesktopSettings(): Promise<void> {
  if (!isElectron || !window.desktopBridge) {
    return;
  }

  if (INITIAL_DESKTOP_SETTINGS) {
    if (
      INITIAL_DESKTOP_SETTINGS.version !== APP_VERSION ||
      INITIAL_DESKTOP_SETTINGS.schemaVersion !== DesktopSettingsSchemaVersion
    ) {
      await persistDesktopSettings({ force: true }).catch(() => {});
    }
    return;
  }

  desktopSettingsHydrated = true;
  latestTheme = Schema.decodeSync(ThemePreferenceSchema)(readThemeFromLocalStorage());
  latestAppSettings =
    getLocalStorageItem(APP_SETTINGS_STORAGE_KEY, AppSettingsSchema) ?? DEFAULT_APP_SETTINGS;
  if (!hasLegacySettingsInLocalStorage()) {
    lastPersistedSerialized = serializeSettingsInput({
      theme: DEFAULT_THEME,
      appSettings: DEFAULT_APP_SETTINGS,
    });
    return;
  }

  await persistDesktopSettings({ force: true }).catch(() => {});
}

export async function persistDesktopSettings(options?: {
  force?: boolean;
  theme?: ThemePreference;
  appSettings?: AppSettings;
}): Promise<void> {
  if (!isElectron || !window.desktopBridge || !desktopSettingsHydrated) {
    return;
  }

  if (options?.theme) {
    latestTheme = Schema.decodeSync(ThemePreferenceSchema)(options.theme);
  }
  if (options?.appSettings) {
    latestAppSettings = options.appSettings;
  }

  const next = buildDesktopSettingsInput();
  const serialized = serializeSettingsInput(next);
  if (!options?.force && serialized === lastPersistedSerialized) {
    return;
  }

  const persisted = await window.desktopBridge.setSettings(next);
  lastPersistedSerialized = serializeSettingsInput({
    theme: persisted.theme,
    appSettings: persisted.appSettings,
  });
}

export function getBootDesktopTheme(): ThemePreference | null {
  return desktopSettingsHydrated ? latestTheme : null;
}

export function getBootDesktopAppSettings(): AppSettings | null {
  return desktopSettingsHydrated ? latestAppSettings : null;
}
