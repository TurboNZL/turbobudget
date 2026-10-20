import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, History, Landmark, Lock, Scale, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import {
  databaseService, type Account, type Debt, type EventOverride, type InterestRule, type Subscription, type TaxRule, type Timeline, type Transaction,
} from "@/lib/database";
import { formatMoney, type Rounding } from "@/lib/finance";
import { buildLedger, defaultRange, effectiveRange, ymd, type Range } from "@/lib/ledger";
import { useSettings } from "./useSettings";
import TimelineEditor from "./TimelineEditor";
import LedgerList from "./LedgerList";
import StatTile from "./StatTile";
import { cardCls, readStored, writeStored } from "./styles";

const ACCOUNT_KEY = "turbobudget-history-account";

const blankTimeline = (accountId: number): Timeline => ({ accountId, applied: false, overrides: {}, dayOrder: {} });

/**
 * History: the account's transactions with the timeline's changes (subscriptions, interest, tax and
 * loan deductions) overlaid, with a running balance. Order within a day and rounding of any generated
 * amount can be corrected here.
 */
export default function HistoryTab() {
  const { settings } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [interestRules, setInterestRules] = useState<InterestRule[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const today = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    const [a, t, s, ir, tr, d, tl] = await Promise.all([
      databaseService.getAllAccounts(), databaseService.getAllTransactions(), databaseService.getAllSubscriptions(),
      databaseService.getAllInterestRules(), databaseService.getAllTaxRules(), databaseService.getAllDebts(), databaseService.getAllTimelines(),
    ]);
    setAccounts(a);
    setTransactions(t);
    setSubs(s);
    setInterestRules(ir);
    setTaxRules(tr);
    setDebts(d);
    setTimelines(tl);
    setAccountId((cur) => {
      if (cur !== null && a.some((x) => x.id === cur)) return cur;
      const saved = Number(readStored(ACCOUNT_KEY));
      return a.some((x) => x.id === saved) ? saved : a[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    load().catch(() => showError("Failed to load history"));
  }, [load]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const timeline = (account && timelines.find((t) => t.accountId === account.id)) || (account ? blankTimeline(account.id) : null);
  const def = useMemo(() => (account ? defaultRange(account, transactions, today) : null), [account, transactions, today]);
  const range: Range | null = def ? effectiveRange(timeline ?? undefined, def) : null;

  const save = useCallback(async (next: Timeline) => {
    setTimelines((list) => (list.some((t) => t.accountId === next.accountId) ? list.map((t) => (t.accountId === next.accountId ? next : t)) : [...list, next]));
    try {
      await databaseService.saveTimeline(next);
    } catch {
      showError("Failed to save the timeline");
    }
  }, []);

  const update = (patch: Partial<Timeline>) => timeline && save({ ...timeline, ...patch });

  const setOverride = (key: string, patch: EventOverride | null) => {
    if (!timeline) return;
    const overrides = { ...timeline.overrides };
    if (patch === null) delete overrides[key];
    else {
      const merged: EventOverride = { ...overrides[key], ...patch };
      if (merged.date === undefined) delete merged.date;
      if (!merged.skip) delete merged.skip;
      if (!merged.rounding) delete merged.rounding;
      if (Object.keys(merged).length === 0) delete overrides[key];
      else overrides[key] = merged;
    }
    void save({ ...timeline, overrides });
  };

  const ctx = useMemo(
    () => account && timeline ? { account, accounts, transactions, subscriptions: subs, interestRules, taxRules, debts, rates: settings.exchangeRates, timeline } : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, accounts, transactions, subs, interestRules, taxRules, debts, settings.exchangeRates, timeline]
  );

  /** Keyframes for the range being edited. */
  const preview = useMemo(() => (ctx && range ? buildLedger(ctx, range) : null), [ctx, range?.start, range?.end]);
  const appliedRange: Range | undefined = timeline?.applied && timeline.appliedStart && timeline.appliedEnd ? { start: timeline.appliedStart, end: timeline.appliedEnd } : undefined;
  const ledger = useMemo(() => {
    if (!ctx) return null;
    if (!appliedRange) return buildLedger(ctx, null);
    if (range && appliedRange.start === range.start && appliedRange.end === range.end && preview) return preview;
    return buildLedger(ctx, appliedRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, appliedRange?.start, appliedRange?.end, preview, range?.start, range?.end]);

  const realBalance = account ? transactions.filter((t) => t.accountId === account.id).reduce((s, t) => s + t.amount, 0) + account.unaccounted : 0;
  const generated = useMemo(() => (ledger ? ledger.rows.filter((r) => r.generated && !r.memo) : []), [ledger]);
  const sum = (kind: string) => generated.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0);

  if (accounts.length === 0) {
    return (
      <Card className={`${cardCls} text-center`}>
        <CardContent className="py-12 space-y-2">
          <History className="w-10 h-10 mx-auto text-primary" />
          <p className="font-medium">No accounts yet</p>
          <p className="text-sm text-muted-foreground">Add an account on the Accounts tab to see its history.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={accountId !== null ? String(accountId) : ""} onValueChange={(v) => { setAccountId(Number(v)); writeStored(ACCOUNT_KEY, v); }}>
          <SelectTrigger className="w-56 bg-muted" aria-label="Account"><Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Choose account" /></SelectTrigger>
          <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        {account?.locked && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="w-4 h-4 text-primary" />Balance locked at {formatMoney(account.lockedBalance)}</span>
        )}
      </div>

      {account && timeline && range && def && preview && ledger && (
        <>
          <div className="bt-tiles">
            <StatTile label="Balance now" icon={Scale} value={formatMoney(realBalance)} sub="from your transactions" />
            <StatTile label={appliedRange ? "With timeline applied" : "Timeline not applied"} icon={Wand2} value={formatMoney(ledger.closing)}
              sub={appliedRange ? `${generated.length} generated entries` : "apply it to see the overlay"} />
            <StatTile label="Interest earned" icon={Sparkles} tone="positive" value={formatMoney(sum("interest"))} />
            <StatTile label="Tax, subscriptions & deductions" icon={Clock} tone="negative" value={formatMoney(sum("tax") + sum("sub") + sum("loan"))} />
          </div>

          <div className="bt-grid" style={{ ["--bt-col" as string]: "44rem" }}>
            <Card className={`${cardCls} bt-span`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Timeline</CardTitle>
                <CardDescription>
                  Drag the handles to choose when to start and stop. Subscriptions, interest and taxes linked to {account.name} fall on the timeline as keyframes; click one to change its day, then apply them to the history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineEditor
                  range={range} defRange={def} keyframes={preview.keyframes} overrides={timeline.overrides}
                  applied={!!appliedRange} appliedRange={appliedRange} today={ymd(today)}
                  onRange={(r) => update({ start: r.start === def.start ? undefined : r.start, end: r.end === def.end ? undefined : r.end })}
                  onOverride={setOverride}
                  onApply={() => { update({ applied: true, appliedStart: range.start, appliedEnd: range.end }); showSuccess("Keyframes applied to the timeline"); }}
                  onUnapply={() => update({ applied: false, appliedStart: undefined, appliedEnd: undefined })}
                />
              </CardContent>
            </Card>

            <Card className={`${cardCls} bt-span`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" />History</CardTitle>
                  <CardDescription>
                    Transactions with the applied changes overlaid. Drag rows to fix their order within a day; use the rounding button on a generated amount if it was rounded the wrong way.
                  </CardDescription>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  <Switch checked={newestFirst} onCheckedChange={setNewestFirst} />Newest first
                </label>
              </CardHeader>
              <CardContent>
                <LedgerList
                  rows={ledger.rows}
                  newestFirst={newestFirst}
                  onReorder={(date, keys) => update({ dayOrder: { ...timeline.dayOrder, [date]: keys } })}
                  onRounding={(key: string, r: Rounding) => setOverride(key, { rounding: r })}
                  onSkip={(key) => setOverride(key, { skip: true })}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
