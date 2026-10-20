import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight, ArrowUpDown, BarChart3, ChevronDown, ChevronUp, Landmark, Lock, Pencil, Plus, Scale, Search,
  Trash2, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type Transaction } from "@/lib/database";
import { formatMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useCategories } from "./useCategories";
import TransactionDialog, { TYPE_OPTIONS } from "./TransactionDialog";
import { AccountDialog, BalanceDialog } from "./AccountDialogs";
import AccountCharts from "./AccountCharts";
import StatTile from "./StatTile";
import ConfirmDialog from "./ConfirmDialog";
import IconButton from "./IconButton";
import { cardCls, readStored, writeStored } from "./styles";

const CHARTS_KEY = "turbobudget-side-charts";
const PAGE = 100;

type SortKey = "date" | "description" | "category" | "amount";

const typeIcon = (type: Transaction["type"]) => TYPE_OPTIONS.find((o) => o.value === type)?.icon ?? ArrowLeftRight;

export default function AccountsTab({ onChanged }: { onChanged?: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { categories, add: addCategory, reload: reloadCategories } = useCategories();
  const [filterAccount, setFilterAccount] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | Transaction["type"]>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [limit, setLimit] = useState(PAGE);
  const [showCharts, setShowCharts] = useState(() => readStored(CHARTS_KEY) === "1");

  const [txDialog, setTxDialog] = useState<{ open: boolean; editing: Transaction | null; accountId: number | null }>({ open: false, editing: null, accountId: null });
  const [accountDialog, setAccountDialog] = useState<{ open: boolean; editing: Account | null }>({ open: false, editing: null });
  const [balanceAccount, setBalanceAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

  const reload = useCallback(async () => {
    const [a, t] = await Promise.all([databaseService.getAllAccounts(), databaseService.getAllTransactions()]);
    setAccounts(a);
    setTransactions(t);
    onChanged?.();
  }, [onChanged]);

  useEffect(() => {
    reload().catch(() => showError("Failed to load data"));
  }, [reload]);

  const accountedFor = (id: number) => transactions.filter((t) => t.accountId === id).reduce((s, t) => s + t.amount, 0);
  const balanceOf = (a: Account) => accountedFor(a.id) + a.unaccounted;

  const totals = useMemo(() => {
    const balance = accounts.reduce((s, a) => s + transactions.filter((t) => t.accountId === a.id).reduce((x, t) => x + t.amount, 0) + a.unaccounted, 0);
    // Moving money between your own accounts is neither income nor spending
    const external = transactions.filter((t) => t.transferId === undefined);
    const income = external.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = external.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { balance, income, expenses };
  }, [accounts, transactions]);

  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";
  /** The other leg of an account-to-account transfer. */
  const counterpart = (t: Transaction) =>
    t.transferId === undefined ? undefined : transactions.find((x) => x.transferId === t.transferId && x.id !== t.id);

  type Row = { kind: "tx"; t: Transaction } | { kind: "unaccounted"; a: Account };

  /**
   * Transactions and the undated "unaccounted" amounts, sorted together so sorting by amount (or any
   * column) puts them in their real place instead of pinning the unaccounted rows to the top.
   */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Row[] = transactions
      .filter(
        (t) =>
          (filterAccount === null || t.accountId === filterAccount) &&
          // With every account shown, a transfer is one row (its outgoing leg) rather than two
          !(filterAccount === null && t.transferId !== undefined && t.amount > 0) &&
          (filterType === "all" || t.type === filterType) &&
          (!q || `${t.description} ${t.category} ${accountName(t.accountId)} ${t.transferId !== undefined ? accountName(counterpart(t)?.accountId ?? -1) : ""}`.toLowerCase().includes(q))
      )
      .map((t) => ({ kind: "tx" as const, t }));
    if (!q) {
      for (const a of accounts) {
        if (a.unaccounted === 0 || (filterAccount !== null && filterAccount !== a.id)) continue;
        // Unaccounted income counts as income, unaccounted spending as a withdrawal
        const type = a.unaccounted > 0 ? "income" : "withdrawal";
        if (filterType === "all" || filterType === type || (filterType === "deposit" && a.unaccounted > 0)) list.push({ kind: "unaccounted", a });
      }
    }
    const amountOf = (r: Row) =>
      r.kind === "unaccounted" ? r.a.unaccounted
        // A transfer between your own accounts shown as one row is net zero
        : filterAccount === null && r.t.transferId !== undefined ? 0 : r.t.amount;
    const textOf = (r: Row, key: "description" | "category") =>
      r.kind === "unaccounted" ? (key === "description" ? (r.a.locked ? "Locked balance adjustment" : r.a.unaccounted > 0 ? "Unaccounted for income" : "Unaccounted for spending") : "Unaccounted") : r.t[key];
    // Undated amounts count as the oldest entries
    const dateOf = (r: Row) => (r.kind === "unaccounted" ? "" : r.t.date ?? "");
    const idOf = (r: Row) => (r.kind === "unaccounted" ? -r.a.id : r.t.id);
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((x, y) => {
      const cmp =
        sort.key === "amount" ? amountOf(x) - amountOf(y)
        : sort.key === "date" ? dateOf(x).localeCompare(dateOf(y))
        : textOf(x, sort.key).localeCompare(textOf(y, sort.key));
      return (cmp || idOf(x) - idOf(y)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, accounts, filterAccount, filterType, query, sort]);

  const requestSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" || key === "amount" ? "desc" : "asc" }));

  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <button type="button" onClick={() => requestSort(key)} className={cn("flex items-center gap-1 hover:text-foreground text-left", className)}>
      {label}
      {sort.key === key ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  );

  const removeTransaction = async (tx: Transaction) => {
    try {
      const removed = await databaseService.deleteTransaction(tx.id);
      await reload();
      toast(tx.transferId !== undefined ? "Transfer deleted" : "Transaction deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            await databaseService.restoreTransactions(removed);
            await reload();
          },
        },
      });
    } catch {
      showError("Failed to delete the transaction");
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteAccount) return;
    try {
      await databaseService.deleteAccount(deleteAccount.id);
      if (filterAccount === deleteAccount.id) setFilterAccount(null);
      setDeleteAccount(null);
      await reload();
      showSuccess("Account deleted");
    } catch {
      showError("Failed to delete the account");
    }
  };

  const openAdd = (accountId: number | null = filterAccount) => setTxDialog({ open: true, editing: null, accountId });
  const fmtDate = (d?: string) => {
    try {
      return d ? format(parseISO(d), "d MMM yyyy") : "";
    } catch {
      return d ?? "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button className="bg-primary text-primary-foreground" disabled={accounts.length === 0} onClick={() => openAdd()}>
            <Plus /> Add transaction
          </Button>
          <Button variant="outline" onClick={() => setAccountDialog({ open: true, editing: null })}>
            <Landmark /> Add account
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="w-4 h-4" />
          Side charts
          <Switch checked={showCharts} onCheckedChange={(v) => { setShowCharts(v); writeStored(CHARTS_KEY, v ? "1" : "0"); }} />
        </label>
      </div>

      <div className="bt-tiles">
        <StatTile label="Total balance" icon={Wallet} value={formatMoney(totals.balance)} tone={totals.balance < 0 ? "negative" : undefined} />
        <StatTile label="Total income" icon={TrendingUp} tone="positive" value={`+${formatMoney(totals.income)}`} />
        <StatTile label="Total expenses" icon={TrendingDown} tone="negative" value={`-${formatMoney(totals.expenses)}`} />
      </div>

      {accounts.length === 0 ? (
        <Card className={cn(cardCls, "text-center")}>
          <CardContent className="py-12 space-y-3">
            <Landmark className="w-10 h-10 mx-auto text-primary" />
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground">Add an account to start tracking transactions.</p>
            <Button onClick={() => setAccountDialog({ open: true, editing: null })}><Plus /> Add your first account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] items-start">
          <div className="space-y-4 xl:sticky xl:top-24">
            <Card className={cardCls}>
              <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Accounts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {accounts.map((a) => {
                  const selected = filterAccount === a.id;
                  const bal = balanceOf(a);
                  return (
                    <div
                      key={a.id}
                      data-selected={selected}
                      onClick={() => setFilterAccount(selected ? null : a.id)}
                      className="bt-row group p-3 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-pressed={selected}
                          title={selected ? "Showing only this account. Click to show all." : "Show only this account's transactions"}
                          onClick={(e) => { e.stopPropagation(); setFilterAccount(selected ? null : a.id); }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {a.name}
                            {a.locked && <Lock className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Balance locked" />}
                          </div>
                          <div className={cn("text-lg font-semibold tabular-nums", bal < 0 ? "text-negative" : "text-positive")}>{formatMoney(bal)}</div>
                        </button>
                        <div className="flex items-center shrink-0">
                          <IconButton icon={Plus} label={`Add transaction to ${a.name}`} onClick={() => openAdd(a.id)} />
                          <IconButton icon={a.locked ? Lock : Scale} label="Set current balance" onClick={() => setBalanceAccount(a)} />
                          <IconButton icon={Pencil} label={`Rename ${a.name}`} onClick={() => setAccountDialog({ open: true, editing: a })} />
                          <IconButton icon={Trash2} tone="danger" label={`Delete ${a.name}`} onClick={() => setDeleteAccount(a)} />
                        </div>
                      </div>
                      {a.unaccounted !== 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {a.locked ? "Locked. " : ""}includes {formatMoney(a.unaccounted)} {a.unaccounted > 0 ? "unaccounted for income" : "unaccounted for spending"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            {showCharts && <AccountCharts transactions={transactions} compact />}
          </div>

          <Card className={cardCls}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base font-medium">
                  Transactions
                  {filterAccount !== null && <span className="text-muted-foreground font-normal"> · {accountName(filterAccount)}</span>}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search" aria-label="Search transactions" className="pl-8 h-9 w-40 bg-muted" />
                  </div>
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                    <SelectTrigger className="h-9 w-36 bg-muted" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {rows.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-muted-foreground">{transactions.length === 0 ? "No transactions yet" : "No transactions match"}</p>
                  {transactions.length === 0 && <Button onClick={() => openAdd()}><Plus /> Add your first transaction</Button>}
                </div>
              ) : (
                <>
                  <div className="hidden md:grid grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1.2fr)_7rem_7.5rem_6.5rem] gap-3 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span />
                    {sortHeader("description", "Description")}
                    {sortHeader("category", "Category")}
                    {sortHeader("date", "Date")}
                    {sortHeader("amount", "Amount", "justify-end")}
                    <span />
                  </div>
                  {rows.slice(0, limit).map((row) => {
                    if (row.kind === "unaccounted") {
                      const a = row.a;
                      return (
                        <div key={`u${a.id}`} className="bt-row grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] md:grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1.2fr)_7rem_7.5rem_6.5rem] items-center gap-3 px-3 py-2.5 border-dashed" style={{ borderStyle: "dashed" }}>
                          <Scale className="w-4 h-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{a.locked ? "Locked balance adjustment" : a.unaccounted > 0 ? "Unaccounted for income" : "Unaccounted for spending"}</div>
                            <div className="text-xs text-muted-foreground truncate">{a.name}</div>
                          </div>
                          <span className="hidden md:block text-sm text-muted-foreground">Unaccounted</span>
                          <span className="hidden md:block text-sm text-muted-foreground">Undated</span>
                          <span className={cn("font-medium tabular-nums text-right", a.unaccounted >= 0 ? "text-positive" : "text-negative")}>
                            {a.unaccounted >= 0 ? "+" : "-"}{formatMoney(Math.abs(a.unaccounted))}
                          </span>
                          <div className="flex justify-end"><IconButton icon={Scale} label="Edit balance" onClick={() => setBalanceAccount(a)} /></div>
                        </div>
                      );
                    }
                    const t = row.t;
                    const Icon = typeIcon(t.type);
                    const other = counterpart(t);
                    const between = filterAccount === null && other !== undefined; // shown as one row "From -> To"
                    const neutral = between; // net zero across your accounts
                    const title = t.description || (other
                      ? between ? "Transfer" : `Transfer ${t.amount < 0 ? "to" : "from"} ${accountName(other.accountId)}`
                      : null);
                    const place = between ? `${accountName(t.accountId)} → ${accountName(other.accountId)}` : accountName(t.accountId);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setTxDialog({ open: true, editing: t, accountId: null })}
                        className="bt-row grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] md:grid-cols-[2rem_minmax(0,2.4fr)_minmax(0,1.2fr)_7rem_7.5rem_6.5rem] items-center gap-3 px-3 py-2.5 cursor-pointer"
                      >
                        <Icon className={cn("w-4 h-4", neutral ? "text-muted-foreground" : t.amount >= 0 ? "text-positive" : "text-negative")} aria-label={t.type} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{title || <span className="text-muted-foreground capitalize">{t.type}</span>}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {place}<span className="md:hidden"> · {fmtDate(t.date)}{t.category && ` · ${t.category}`}</span>
                          </div>
                        </div>
                        <span className="hidden md:block text-sm text-foreground/80 truncate">{t.category || <span className="text-muted-foreground">-</span>}</span>
                        <span className="hidden md:block text-sm">{fmtDate(t.date)}</span>
                        <span className={cn("font-medium tabular-nums text-right", neutral ? "text-foreground" : t.amount >= 0 ? "text-positive" : "text-negative")}>
                          {neutral ? "" : t.amount >= 0 ? "+" : "-"}{formatMoney(Math.abs(t.amount))}
                        </span>
                        <div className="flex justify-end">
                          <IconButton icon={Pencil} label="Edit transaction" onClick={() => setTxDialog({ open: true, editing: t, accountId: null })} />
                          <IconButton icon={Trash2} tone="danger" label="Delete transaction" onClick={() => removeTransaction(t)} />
                        </div>
                      </div>
                    );
                  })}
                  {rows.length > limit && (
                    <div className="text-center pt-2">
                      <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <TransactionDialog
        open={txDialog.open}
        onOpenChange={(o) => setTxDialog((d) => ({ ...d, open: o }))}
        accounts={accounts}
        transactions={transactions}
        categories={categories}
        onAddCategory={addCategory}
        editing={txDialog.editing}
        accountId={txDialog.accountId}
        onSaved={() => { reload(); reloadCategories(); }}
      />
      <AccountDialog open={accountDialog.open} onOpenChange={(o) => setAccountDialog((d) => ({ ...d, open: o }))} editing={accountDialog.editing} onSaved={() => reload()} />
      <BalanceDialog account={balanceAccount} accounted={balanceAccount ? accountedFor(balanceAccount.id) : 0} onClose={() => setBalanceAccount(null)} onSaved={() => reload()} />

      <ConfirmDialog
        open={deleteAccount !== null}
        title={`Delete ${deleteAccount?.name ?? ""}?`}
        description="This also deletes its transactions, interest rules and history timeline. The other side of any transfer with it stays in its own account. Subscriptions that use it are kept but unlinked."
        confirmLabel="Delete account"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeleteAccount(null)}
      />
    </div>
  );
}
