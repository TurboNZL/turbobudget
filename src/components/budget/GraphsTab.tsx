import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addMonths, format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError } from "@/utils/toast";
import {
  databaseService,
  type Account,
  type Debt,
  type Person,
  type Subscription,
  type Transaction,
} from "@/lib/database";
import { formatMoney } from "@/lib/finance";
import { withAutoRepayments } from "@/lib/ledger";
import {
  averageMonthlyNet,
  balanceHistory,
  debtByPerson,
  projectBalance,
  projectDebtPayoff,
  subscriptionSpendByCategory,
  totalBalance,
  type BalancePoint,
} from "@/lib/graphs";
import { useSettings } from "./useSettings";
import { cardCls, readStored, writeStored } from "./styles";
import MoreCharts from "./MoreCharts";
import { ChartDefs, useChartStyle } from "./charts";
import AccountCharts from "./AccountCharts";

const FILTER_KEY = "turbobudget-graph-account";

const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-center py-12">{children}</p>;
}

export default function GraphsTab() {
  const { settings } = useSettings();
  const c = useChartStyle();
  const tooltipProps = { ...c.tooltip, formatter: (value: number) => formatMoney(value) };
  const AXIS = c.axis.stroke;
  const GRID = c.grid.stroke;
  const rates = settings.exchangeRates;
  const [allAccounts, setAccounts] = useState<Account[]>([]);
  const [allTransactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [allSubs, setSubs] = useState<Subscription[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [includeSubs, setIncludeSubs] = useState(true);
  // null = every account
  const [accountId, setAccountId] = useState<number | null>(() => {
    const stored = Number(readStored(FILTER_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });

  useEffect(() => {
    Promise.all([
      databaseService.getAllAccounts(),
      databaseService.getAllTransactions(),
      databaseService.getAllDebts(),
      databaseService.getAllSubscriptions(),
      databaseService.getAllPeople(),
    ])
      .then(([a, t, d, s, p]) => {
        setAccounts(a);
        setTransactions(t);
        setDebts(d);
        setSubs(s);
        setPeople(p);
      })
      .catch(() => showError("Failed to load graph data"));
  }, []);

  const today = useMemo(() => new Date(), []);

  // A removed account falls back to "All accounts"
  const selected = accountId !== null && allAccounts.some((a) => a.id === accountId) ? accountId : null;
  const changeAccount = (id: number | null) => {
    setAccountId(id);
    writeStored(FILTER_KEY, id === null ? null : String(id));
  };
  const accounts = useMemo(() => (selected === null ? allAccounts : allAccounts.filter((a) => a.id === selected)), [allAccounts, selected]);
  const transactions = useMemo(() => (selected === null ? allTransactions : allTransactions.filter((t) => t.accountId === selected)), [allTransactions, selected]);
  // Subscriptions are tied to the account they are paid from
  const subs = useMemo(() => (selected === null ? allSubs : allSubs.filter((s) => s.accountId === selected)), [allSubs, selected]);

  // Loans skimmed off income (e.g. a student loan) already have those repayments taken off
  // Debts aren't tied to an account, so they always use every transaction. Stale ones are left out.
  const liveDebts = useMemo(() => withAutoRepayments(debts, allTransactions, today).filter((d) => !d.stale), [debts, allTransactions, today]);
  const byPerson = useMemo(() => debtByPerson(liveDebts, people, rates), [liveDebts, people, rates]);
  const payoff = useMemo(() => projectDebtPayoff(liveDebts, rates, today), [liveDebts, rates, today]);
  const hasDebt = payoff.owe.remaining > 0 || payoff.owed.remaining > 0;

  const current = useMemo(() => totalBalance(accounts, transactions), [accounts, transactions]);
  const trend = useMemo(() => averageMonthlyNet(transactions, today), [transactions, today]);
  const balanceSeries = useMemo<BalancePoint[]>(() => {
    const history = balanceHistory(accounts, transactions, today);
    const projection = projectBalance(current, trend.perMonth, subs, rates, today, 12, includeSubs);
    // The "Today" point belongs to both lines so they join up
    const todayPoint = history.find((p) => p.label === "Today");
    const merged = history.filter((p) => p.label !== "Today");
    merged.push({ label: "Today", actual: todayPoint?.actual ?? Math.round(current * 100) / 100, projected: projection[0].projected });
    return [...merged, ...projection.slice(1)];
  }, [accounts, transactions, subs, rates, today, current, trend.perMonth, includeSubs]);

  const accountBars = useMemo(
    () =>
      accounts.map((a) => ({
        name: a.name,
        balance:
          Math.round(
            (transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0) + a.unaccounted) * 100
          ) / 100,
      })),
    [accounts, transactions]
  );

  const subSpend = useMemo(() => subscriptionSpendByCategory(subs, rates), [subs, rates]);

  const clearText = (monthsToClear: number | null, remaining: number) => {
    if (remaining <= 0) return "nothing outstanding";
    if (monthsToClear === null) return "no repayments in the last 90 days, so no payoff date";
    return `clears around ${format(addMonths(today, monthsToClear), "MMM yyyy")} (${monthsToClear} month${monthsToClear === 1 ? "" : "s"})`;
  };

  return (
    <div className="bt-grid" style={{ ["--bt-col" as string]: "34rem" }}>
      <div className="bt-span flex flex-wrap items-center gap-3">
        <Select value={selected === null ? "all" : String(selected)} onValueChange={(v) => changeAccount(v === "all" ? null : Number(v))}>
          <SelectTrigger className="w-60 bg-muted" aria-label="Filter graphs by account"><Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {allAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selected !== null && <p className="text-sm text-muted-foreground">Debt graphs are not tied to an account, so they always show everything.</p>}
      </div>
      <AccountCharts transactions={transactions} />
        <Card className={cardCls}>
          <CardHeader>
            <CardTitle>Debt by person</CardTitle>
            <CardDescription>Outstanding balances in NZD.</CardDescription>
          </CardHeader>
          <CardContent>
            {byPerson.length === 0 ? (
              <Empty>No outstanding debts</Empty>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, byPerson.length * 56 + 60)}>
                <BarChart data={byPerson} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <ChartDefs /><CartesianGrid {...c.grid} horizontal={false} />
                  <XAxis type="number" stroke={AXIS} fontSize={c.cs.fontSize} tickFormatter={axisMoney} />
                  <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={c.cs.fontSize} width={90} />
                  <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                  <Legend />
                  <Bar dataKey="owe" name="I owe them" {...c.bar(3)} fill={c.cs.finish === "flat" ? "hsl(var(--bad))" : c.bar(3).fill} maxBarSize={20} />
                  <Bar dataKey="owed" name="They owe me" {...c.bar(1)} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={cardCls}>
          <CardHeader>
            <CardTitle>Account balances</CardTitle>
            <CardDescription>Transactions plus any unaccounted amount.</CardDescription>
          </CardHeader>
          <CardContent>
            {accountBars.length === 0 ? (
              <Empty>No accounts yet</Empty>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, accountBars.length * 56 + 60)}>
                <BarChart data={accountBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <ChartDefs /><CartesianGrid {...c.grid} horizontal={false} />
                  <XAxis type="number" stroke={AXIS} fontSize={c.cs.fontSize} tickFormatter={axisMoney} />
                  <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={c.cs.fontSize} width={90} />
                  <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                  <Bar dataKey="balance" name="Balance" {...c.bar(1)} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Debt payoff projection</CardTitle>
          <CardDescription>
            Assumes repayments continue at the average pace of the last {payoff.lookbackDays} days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasDebt ? (
            <Empty>No outstanding debts to project</Empty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={payoff.points} margin={{ right: 16 }}>
                  <ChartDefs /><CartesianGrid {...c.grid} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={c.cs.fontSize} minTickGap={24} />
                  <YAxis stroke={AXIS} fontSize={c.cs.fontSize} tickFormatter={axisMoney} />
                  <Tooltip {...tooltipProps} />
                  <Legend />
                  {payoff.owe.remaining > 0 && (
                    <Line type={c.ui === "winxp" || c.ui === "win10" ? "linear" : "monotone"} dataKey="owe" name="I owe" {...c.line(3)} stroke="hsl(var(--bad))" dot={false} />
                  )}
                  {payoff.owed.remaining > 0 && (
                    <Line type={c.ui === "winxp" || c.ui === "win10" ? "linear" : "monotone"} dataKey="owed" name="Owed to me" {...c.line(1)} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <span className="text-foreground font-medium">I owe {formatMoney(payoff.owe.remaining)}</span>
                  {payoff.owe.remaining > 0 && <> at about {formatMoney(payoff.owe.monthlyRate)}/month</>}:{" "}
                  {clearText(payoff.owe.monthsToClear, payoff.owe.remaining)}
                </li>
                <li>
                  <span className="text-foreground font-medium">Owed to me {formatMoney(payoff.owed.remaining)}</span>
                  {payoff.owed.remaining > 0 && <> at about {formatMoney(payoff.owed.monthlyRate)}/month</>}:{" "}
                  {clearText(payoff.owed.monthsToClear, payoff.owed.remaining)}
                </li>
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={`${cardCls} bt-span`}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Balance history and projection</CardTitle>
            <CardDescription>
              Total across all accounts. The projection continues your average net change of{" "}
              {formatMoney(trend.perMonth)}/month (last {trend.windowDays} days)
              {includeSubs ? ", plus upcoming subscription and loan payments." : "."}
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Switch checked={includeSubs} onCheckedChange={setIncludeSubs} />
            Subscriptions
          </label>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <Empty>Add an account to see balances</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={balanceSeries} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} />
                <XAxis dataKey="label" stroke={AXIS} fontSize={c.cs.fontSize} minTickGap={24} />
                <YAxis stroke={AXIS} fontSize={c.cs.fontSize} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} />
                <Legend />
                <Line type={c.ui === "winxp" || c.ui === "win10" ? "linear" : "monotone"} dataKey="actual" name="Balance" {...c.line(1)} dot={{ r: 3 }} connectNulls />
                <Line type={c.ui === "winxp" || c.ui === "win10" ? "linear" : "monotone"} dataKey="projected" name="Projected" {...c.line(1, true)} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Subscription spend by category</CardTitle>
          <CardDescription>
            Approximate NZD per month for active subscriptions you pay for. Loans and subscriptions others pay are left out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subSpend.length === 0 ? (
            <Empty>No active subscriptions</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, subSpend.length * 48 + 60)}>
              <BarChart data={subSpend} layout="vertical" margin={{ left: 8, right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} horizontal={false} />
                <XAxis type="number" stroke={AXIS} fontSize={c.cs.fontSize} tickFormatter={axisMoney} />
                <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={c.cs.fontSize} width={100} />
                <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Bar dataKey="value" name="Per month" {...c.bar(2)} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <MoreCharts accounts={accounts} transactions={transactions} subs={subs} debts={liveDebts} rates={rates} today={today} />
    </div>
  );
}
