import { useState } from "react";
import { Check, Eye, Palette, RefreshCw, RotateCcw, Wand2 } from "lucide-react";
import { ensureFonts } from "turbothemes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { picker, themes, useAppearance } from "@/lib/themes";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";
import PreviewDashboard from "./PreviewDashboard";
import { cardCls } from "./styles";

const themeGrid = "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2";

export default function AppearanceCard() {
  const { theme, appearance, revision } = useAppearance();
  // Hovering or focusing an option previews it, combined with the other current choice
  const [hoverTheme, setHoverTheme] = useState<string | null>(null);
  const [hoverUi, setHoverUi] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // `revision` changes when an update brings new themes, so the lists are re-read then
  void revision;
  const groups = picker.themes();
  const styles = picker.styles();
  const shownTheme = hoverTheme ?? appearance.theme;
  const shownUi = hoverUi ?? appearance.ui;
  const label = `${groups.flatMap((g) => g.items).find((t) => t.id === shownTheme)?.label} + ${styles.find((s) => s.id === shownUi)?.label}`;
  const matching = picker.matchingTheme(appearance.ui);
  const matchingLabel = groups.flatMap((g) => g.items).find((t) => t.id === matching)?.label;
  const version = themes.version();

  const previewUi = (id: string | null) => {
    setHoverUi(id);
    if (id) ensureFonts(id); // so the preview is set in the style's own font
  };

  const checkForUpdates = async () => {
    setChecking(true);
    const r = await picker.checkForUpdates();
    setChecking(false);
    if (r.status === "failed" || r.status === "engine-too-old") showError(r.message);
    else showSuccess(r.message);
  };

  return (
    <Card className={cardCls}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Appearance</CardTitle>
        <CardDescription>
          Pick a colour theme and a UI style; any combination works. The framed preview shows the combination before (and as) you choose. Saved in this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_27rem] items-start">
        {/* The preview sits in its own framed column so it can't be mistaken for the real page */}
        <div className="lg:order-2 lg:sticky lg:top-24">
          <div className="rounded-xl border-4 border-dashed border-primary bg-primary/10 p-3 shadow-[0_0_0_4px_hsl(var(--accent)/0.15)]">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-bold uppercase tracking-wider text-primary-foreground"><Eye className="w-3.5 h-3.5" />Preview</span>
              <span className="truncate font-medium text-foreground">{label}</span>
            </div>
            <PreviewDashboard theme={shownTheme} ui={shownUi} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Not your real page. Hover or focus an option to try it, click to apply.</p>
          </div>
        </div>

        <div className="space-y-5 min-w-0 lg:order-1">
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <h4 className="text-sm font-medium">{g.id === "device" ? "Colour theme" : g.label}</h4>
              <div role="radiogroup" aria-label={g.label} className={themeGrid} onMouseLeave={() => setHoverTheme(null)}>
                {g.items.map((t) => {
                  const selected = theme === t.id;
                  return (
                    <button
                      key={t.id} type="button" role="radio" aria-checked={selected} title={t.note}
                      onClick={() => picker.set({ theme: t.id })}
                      onMouseEnter={() => setHoverTheme(t.id)} onFocus={() => setHoverTheme(t.id)} onBlur={() => setHoverTheme(null)}
                      className={cn("text-left rounded-lg border p-2 transition-colors hover:border-primary", selected ? "border-primary ring-1 ring-primary" : "border-border")}
                    >
                      <span
                        className="block h-10 rounded-md border border-border/60 overflow-hidden relative" aria-hidden
                        style={{ background: t.colors?.bg ?? "linear-gradient(115deg, #f4f4f6 50%, #17171c 50%)" }}
                      >
                        {t.colors && (
                          <>
                            <span className="absolute left-1.5 top-1.5 h-2 w-8 rounded-sm" style={{ background: t.colors.accent }} />
                            <span className="absolute left-1.5 bottom-1.5 right-1.5 h-3 rounded-sm" style={{ background: t.colors.surface, border: `1px solid ${t.colors.text}33` }} />
                          </>
                        )}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-1 text-xs font-medium">
                        <span className="truncate">{t.label}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">UI style</h4>
              {matching && matching !== theme && (
                <Button type="button" size="sm" variant="outline" onClick={() => picker.set({ theme: matching })}
                  onMouseEnter={() => setHoverTheme(matching)} onMouseLeave={() => setHoverTheme(null)}>
                  <Wand2 /> Use matching colours ({matchingLabel})
                </Button>
              )}
            </div>
            <div role="radiogroup" aria-label="UI style" className="grid grid-cols-1 sm:grid-cols-2 gap-2" onMouseLeave={() => previewUi(null)}>
              {styles.map((s) => {
                const selected = appearance.ui === s.id;
                return (
                  <button
                    key={s.id} type="button" role="radio" aria-checked={selected}
                    onClick={() => picker.set({ ui: s.id })}
                    onMouseEnter={() => previewUi(s.id)} onFocus={() => previewUi(s.id)} onBlur={() => previewUi(null)}
                    className={cn("text-left p-3 rounded-lg border bg-muted transition-colors hover:bg-accent", selected ? "border-primary ring-1 ring-primary" : "border-border")}
                  >
                    <span className="block">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.label}</span>
                        {selected && <Check className="w-4 h-4 text-primary" />}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1">{s.description}</span>
                      <span className="block text-xs mt-1.5 opacity-80">{s.font}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-medium">Themes</h4>
            <p className="text-xs text-muted-foreground">
              Colours and styles come from the TurboNZL/turboengine repository (themes/) and update on their own, with no TurboBudget update needed.
              Now using the {version.origin === "downloaded" ? "downloaded" : "built-in"} set <span className="tabular-nums">({version.hash.slice(0, 8)})</span>, built {version.built}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void checkForUpdates()} disabled={checking}>
                <RefreshCw className={checking ? "animate-spin" : undefined} /> Check for updates
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => picker.resetLook()}>
                <RotateCcw /> Reset to match this device
              </Button>
              {version.origin === "downloaded" && (
                <Button type="button" variant="outline" size="sm" onClick={() => themes.resetToBuiltin()}>Use built-in themes</Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
