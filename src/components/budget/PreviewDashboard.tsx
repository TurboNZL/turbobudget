import { CreditCard, LayoutDashboard, Plus, Repeat, Search, Settings as SettingsIcon, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { effectiveUi } from "turbothemes";
import { brandDataUri } from "@/lib/brand";
import { previewAttrs, previewStyle } from "@/lib/themes";
import { getChartStyle, ChartDefs } from "./charts";
import Segmented from "./Segmented";

const BARS = [0.45, 0.7, 0.55, 0.9, 0.65];

/**
 * A small simulated dashboard drawn with the real components, themed and styled by the given
 * colour theme and UI style (not the page's), so every combination can be previewed before choosing.
 */
export default function PreviewDashboard({ theme, ui: uiChoice }: { theme: string; ui: string }) {
  const ui = effectiveUi(uiChoice);
  const cs = getChartStyle(ui);
  const prefix = `pv-${ui}`;
  const fillFor = (n: number) =>
    cs.finish === "gloss" || cs.finish === "bevel" ? `url(#${prefix}-${cs.finish}-${n})` : cs.finish === "outline" ? `hsl(var(--chart-${n}) / 0.35)` : `hsl(var(--chart-${n}))`;

  return (
    <div
      {...previewAttrs(theme, ui)}
      style={previewStyle(theme)}
      className="rounded-lg overflow-hidden border border-border select-none"
      aria-label="Preview of the selected colour theme and UI style"
      role="img"
    >
      <header className="bt-top px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={brandDataUri(theme, ui)} alt="" className="w-6 h-6" />
          <span className="font-bold truncate">TurboBudget</span>
        </div>
        <div className="flex gap-2 pointer-events-none">
          <Button size="sm" tabIndex={-1} className="h-8"><Plus /> Add</Button>
          <Button size="sm" variant="outline" tabIndex={-1} className="h-8 hidden sm:inline-flex">Data</Button>
        </div>
      </header>
      <div className="p-3 space-y-3 bg-background text-foreground pointer-events-none">
        <Tabs value="a">
          <TabsList className="bg-card border border-border h-auto flex-wrap justify-start">
            {[["a", "Accounts", Wallet], ["b", "Subs", Repeat], ["c", "Graphs", LayoutDashboard], ["d", "Settings", SettingsIcon]].map(([v, label, Icon]) => {
              const I = Icon as typeof Wallet;
              return (
                <TabsTrigger key={v as string} value={v as string} tabIndex={-1} className="gap-1.5">
                  <I className="w-4 h-4" />{label as string}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-3 gap-2">
          {[["Balance", "$4,210.50", ""], ["Income", "+$3,900", "text-positive"], ["Spent", "-$1,284", "text-negative"]].map(([l, v, c]) => (
            <div key={l} className="bt-tile p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
              <div className={`text-base font-bold tabular-nums ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Recent</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {[["Groceries", "-$84.20", true], ["Salary", "+$1,950.00", false], ["Streaming", "-$15.99", true]].map(([n, a, neg]) => (
                <div key={n as string} className="bt-row flex items-center justify-between px-2.5 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" />{n as string}</span>
                  <span className={`tabular-nums font-medium ${neg ? "text-negative" : "text-positive"}`}>{a as string}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1.5">
                <label className="flex items-center gap-1.5 text-xs"><Switch checked aria-label="sample switch" tabIndex={-1} />Lock</label>
                <label className="flex items-center gap-1.5 text-xs"><Checkbox checked tabIndex={-1} />Tick</label>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Spending</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <svg viewBox="0 0 200 80" className="w-full h-20" aria-hidden>
                <ChartDefs ui={ui} prefix={prefix} />
                {[20, 40, 60].map((y) => <line key={y} x1="0" x2="200" y1={y} y2={y} stroke="hsl(var(--line))" strokeDasharray={cs.grid === "0" ? undefined : "3 3"} />)}
                {BARS.map((h, i) => (
                  <rect
                    key={i} x={10 + i * 38} y={78 - h * 70} width={24} height={h * 70} rx={cs.barRadius}
                    fill={fillFor((i % 3) + 1)}
                    stroke={cs.finish === "bevel" ? "var(--xp-frame, #404040)" : cs.finish === "outline" || cs.finish === "gloss" ? `hsl(var(--chart-${(i % 3) + 1}))` : "none"}
                  />
                ))}
              </svg>
              <Segmented label="sample" compact value="a" onChange={() => undefined} options={[{ value: "a", label: "Month", icon: Search }, { value: "b", label: "Year" }]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
