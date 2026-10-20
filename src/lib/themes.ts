/**
 * The look of the app comes from the turbothemes engine (turbothemes, in github.com/TurboNZL/turboengine under themes/): palettes and UI styles live in that
 * repository and reach the app through its updater, so a theme fix never needs a TurboBudget release. This file starts the engine
 * and gives React the little it needs; the choice is remembered by the engine under `turbobudget.*` in localStorage.
 */
import { useSyncExternalStore } from "react";
import { effectiveUi, resolveTheme, start, themeStyle, type Appearance, type Hsl } from "turbothemes";
import { applyFavicon } from "./brand";

const PREFIX = "turbobudget";

/** Carries the choice made with the pre-turbothemes settings over once, so nobody's look resets on this update. */
const migrateOldSettings = () => {
  try {
    const ls = window.localStorage;
    if (ls.getItem(`${PREFIX}.appearance`)) return;
    const theme = ls.getItem("turbobudget-theme");
    const ui = ls.getItem("turbobudget-ui-style");
    if (!theme && !ui) return;
    const wp = JSON.parse(ls.getItem("turbobudget-wallpaper") ?? "{}") as { enabled?: boolean; darkness?: number; custom?: boolean };
    const image = ls.getItem("turbobudget-wallpaper-image");
    if (image) ls.setItem(`${PREFIX}.wallpaperImage`, image);
    const appearance: Appearance = {
      theme: theme ?? "dark",
      ui: ui ?? "default",
      wallpaper: wp.enabled === true,
      wallpaperDarkness: typeof wp.darkness === "number" ? wp.darkness : 0.45,
      wallpaperCustom: wp.custom === true && !!image,
    };
    ls.setItem(`${PREFIX}.appearance`, JSON.stringify(appearance));
    for (const k of ["turbobudget-theme", "turbobudget-ui-style", "turbobudget-wallpaper", "turbobudget-wallpaper-image"]) ls.removeItem(k);
  } catch {
    // storage unavailable: the defaults apply
  }
};

migrateOldSettings();

/** The engine. `persist` remembers the user's choice; newer themes are fetched from the repository in the background. */
export const themes = start({
  storagePrefix: PREFIX,
  persist: true,
  appearance: { theme: "dark", ui: "default", wallpaper: false, wallpaperDarkness: 0.45 },
});

export const picker = themes.picker();

/** Series colours for charts, spun around the accent hue so they stay on-theme. */
export const chartVars = (primary: Hsl, dark: boolean): Record<string, string> => {
  const [h, s, l] = primary;
  const sat = Math.max(55, Math.min(s, 85));
  const lum = dark ? Math.max(l, 58) : Math.min(l, 45);
  return {
    "--chart-1": `${h} ${sat}% ${lum}%`,
    "--chart-2": `${(h + 150) % 360} ${sat}% ${lum}%`,
    "--chart-3": `${(h + 40) % 360} ${Math.max(sat, 70)}% ${dark ? 62 : 46}%`,
    "--chart-4": `${(h + 210) % 360} ${sat}% ${lum}%`,
    "--chart-5": `${(h + 100) % 360} ${sat}% ${dark ? 60 : 42}%`,
    "--chart-6": `${(h + 290) % 360} ${sat}% ${lum}%`,
  };
};

/** Inline style that gives an element a palette's colours (and chart colours), for previews. */
export const previewStyle = (theme: string): React.CSSProperties => {
  const p = resolveTheme(theme);
  return { ...themeStyle(theme), ...chartVars(p.primary, p.dark) } as React.CSSProperties;
};

/** The same look the engine puts on <html>, in a form a wrapper element can carry. */
export const previewAttrs = (theme: string, ui: string) => ({
  "data-theme": resolveTheme(theme).id,
  "data-mode": resolveTheme(theme).dark ? "dark" : "light",
  "data-ui": effectiveUi(ui),
});

/** Keeps what the engine does not know about in step with the look that is showing: the chart colours, the logo and favicon. */
const syncApp = () => {
  const { shown } = picker.getState();
  const p = resolveTheme(shown.theme);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(chartVars(p.primary, p.dark))) root.style.setProperty(k, v);
  applyFavicon(shown.theme, shown.ui);
};
syncApp();
picker.subscribe(syncApp);

/** The selected look; components re-render when it changes. `shown` differs from `appearance` only while previewing. */
export const useAppearance = () => {
  const state = useSyncExternalStore(picker.subscribe, picker.getState, picker.getState);
  const { appearance } = state;
  const palette = resolveTheme(appearance.theme);
  return { ...state, theme: appearance.theme, ui: effectiveUi(appearance.ui), palette, dark: palette.dark };
};
