import { Option, Schema } from "effect";

export const ThemePreference = Schema.Literals(["light", "dark", "system"]);
export type ThemePreference = typeof ThemePreference.Type;

export const TIMESTAMP_FORMAT_OPTIONS = ["locale", "12-hour", "24-hour"] as const;
export type TimestampFormat = (typeof TIMESTAMP_FORMAT_OPTIONS)[number];
export const DEFAULT_TIMESTAMP_FORMAT: TimestampFormat = "locale";

export const AppSettings = Schema.Struct({
  codexBinaryPath: Schema.String.check(Schema.isMaxLength(4096)).pipe(
    Schema.withConstructorDefault(() => Option.some("")),
  ),
  codexHomePath: Schema.String.check(Schema.isMaxLength(4096)).pipe(
    Schema.withConstructorDefault(() => Option.some("")),
  ),
  defaultThreadEnvMode: Schema.Literals(["local", "worktree"]).pipe(
    Schema.withConstructorDefault(() => Option.some("local")),
  ),
  confirmThreadDelete: Schema.Boolean.pipe(Schema.withConstructorDefault(() => Option.some(true))),
  enableAssistantStreaming: Schema.Boolean.pipe(
    Schema.withConstructorDefault(() => Option.some(false)),
  ),
  timestampFormat: Schema.Literals(["locale", "12-hour", "24-hour"]).pipe(
    Schema.withConstructorDefault(() => Option.some(DEFAULT_TIMESTAMP_FORMAT)),
  ),
  customCodexModels: Schema.Array(Schema.String).pipe(
    Schema.withConstructorDefault(() => Option.some([])),
  ),
});
export type AppSettings = typeof AppSettings.Type;

export const DesktopSettingsSchemaVersion = 1 as const;

export const DesktopSettings = Schema.Struct({
  version: Schema.String,
  schemaVersion: Schema.Number,
  theme: ThemePreference,
  appSettings: AppSettings,
});
export type DesktopSettings = typeof DesktopSettings.Type;

export const DesktopSettingsInput = Schema.Struct({
  theme: ThemePreference,
  appSettings: AppSettings,
});
export type DesktopSettingsInput = typeof DesktopSettingsInput.Type;
