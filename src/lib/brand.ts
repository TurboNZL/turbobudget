import { effectiveUi, resolveTheme } from "turbothemes";

const hslToHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * The browser tab icon: the three bars ALONE (no tile), in the accent of the selected colour theme, so the tab changes colour with the look.
 * The engine's logo rule is that anything this small is the symbol, not the full mark; the full mark (the engine ring with the bars as its emblem,
 * `public/icon.svg`, made by `scripts/gen-icons.mjs`) is the header logo and the app icon. The colour is kept readable on both a light and a dark tab strip: not too pale, not too dark, never grey.
 */
export const faviconSvg = (theme: string, ui: string): string => {
  const [h, s, l] = resolveTheme(theme).primary;
  const fill = hslToHex(h, Math.max(s, 55), Math.max(46, Math.min(l, 62)));
  const r = (({ default: 3, gtk4: 5, breeze: 1.5, win11: 4, win10: 0, win7: 2.5, winxp: 2, win98: 0, macos: 4, material: 6 } as Record<string, number>)[effectiveUi(ui)] ?? 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="36" width="14" height="22" rx="${r}" fill="${fill}" fill-opacity=".72"/><rect x="25" y="24" width="14" height="34" rx="${r}" fill="${fill}" fill-opacity=".88"/><rect x="45" y="6" width="14" height="52" rx="${r}" fill="${fill}"/></svg>`;
};

export const faviconDataUri = (theme: string, ui: string): string => `data:image/svg+xml,${encodeURIComponent(faviconSvg(theme, ui))}`;

/** Points the browser tab icon at the bars in the current accent. (The mobile theme colour is kept by the engine.) */
export const applyFavicon = (theme: string, ui: string) => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = faviconDataUri(theme, ui);
};
