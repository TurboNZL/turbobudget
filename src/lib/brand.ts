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
 * The TurboBudget mark: three rising bars on a gradient tile. The tile's colours follow the
 * accent of the selected colour theme and its corners / finish follow the UI style. The header
 * logo and the app icon are drawn from this; the browser tab uses only the bars (`faviconSvg` below).
 */
export const brandSvg = (theme: string, uiChoice: string): string => {
  const def = resolveTheme(theme);
  const ui = effectiveUi(uiChoice);
  const [h, s, l] = def.primary;
  const c1 = hslToHex((h + 305) % 360, Math.max(s, 60), Math.min(l + 10, 66));
  const c2 = hslToHex(h, s, Math.max(Math.min(l - 4, 52), 34));
  const rx = ({ default: 14, gtk4: 20, breeze: 7, win11: 16, win10: 0, win7: 9, winxp: 8, win98: 0, macos: 15, material: 22 } as Record<string, number>)[ui] ?? 14;
  const barRx = ({ default: 2, gtk4: 3.5, breeze: 1, win11: 2.5, win10: 0, win7: 1.5, winxp: 1, win98: 0, macos: 2.5, material: 4 } as Record<string, number>)[ui] ?? 2;
  const bars = `
  <rect x="14" y="36" width="9" height="14" rx="${barRx}" fill="#fff" fill-opacity=".75"/>
  <rect x="27.5" y="26" width="9" height="24" rx="${barRx}" fill="#fff" fill-opacity=".9"/>
  <rect x="41" y="15" width="9" height="35" rx="${barRx}" fill="#fff"/>`;
  const gloss =
    ui === "win7"
      ? `<path d="M0 ${rx}A${rx} ${rx} 0 0 1 ${rx} 0H${64 - rx}A${rx} ${rx} 0 0 1 64 ${rx}V30Q32 38 0 30Z" fill="#fff" fill-opacity=".28"/><rect x=".75" y=".75" width="62.5" height="62.5" rx="${rx}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>`
      : ui === "winxp"
        ? `<rect x="1.5" y="1.5" width="61" height="61" rx="${rx}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/><rect x="0" y="0" width="64" height="64" rx="${rx}" fill="none" stroke="${hslToHex(h, s, 22)}" stroke-width="2.5"/>`
        : ui === "win98"
          ? `<path d="M0 0H64V64H0Z" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".8"/><path d="M64 0V64H0" fill="none" stroke="#000" stroke-width="3" stroke-opacity=".6"/>`
        : ui === "win10"
          ? `<rect x="0" y="0" width="64" height="64" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>`
          : ui === "macos"
            ? `<rect x=".5" y=".5" width="63" height="63" rx="${rx}" fill="none" stroke="#000" stroke-opacity=".18"/><path d="M0 ${rx}A${rx} ${rx} 0 0 1 ${rx} 0H${64 - rx}A${rx} ${rx} 0 0 1 64 ${rx}V26Q32 32 0 26Z" fill="#fff" fill-opacity=".14"/>`
          : ui === "breeze"
            ? `<rect x=".5" y=".5" width="63" height="63" rx="${rx}" fill="none" stroke="#000" stroke-opacity=".25"/>`
            : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="64" height="64" rx="${rx}" fill="url(#g)"/>${bars}${gloss}</svg>`;
};

export const brandDataUri = (theme: string, ui: string): string =>
  `data:image/svg+xml,${encodeURIComponent(brandSvg(theme, ui).replace(/\s*\n\s*/g, ""))}`;

/**
 * The browser tab icon: the three bars ALONE (no tile), in the accent of the selected colour theme, so the tab changes colour with the look.
 * The engine's logo rule is that anything this small is the symbol, not the full mark; the tile (`brandSvg`) stays for the header logo and the
 * app icon. The colour is kept readable on both a light and a dark tab strip: not too pale, not too dark, never grey.
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
