import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, Calendar, FileText, Landmark, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type Category, type Transaction } from "@/lib/database";
import EntryDialog from "./EntryDialog";
import { Field, IconInput } from "./Field";
import Segmented, { type SegmentedOption } from "./Segmented";
import CategorySelect from "./CategorySelect";
import { addDaysStr, readStored, todayStr, triggerCls, writeStored } from "./styles";

const LAST_ACCOUNT = "turbobudget-last-account";
const LAST_TYPE = "turbobudget-last-type";

export const TYPE_OPTIONS: SegmentedOption<Transaction["type"]>[] = [
  { value: "income", label: "Income", icon: Banknote, hint: "Money you earned (pay, freelance...)" },
  { value: "deposit", label: "Deposit", icon: ArrowDownToLine, hint: "Money paid into the account" },
  { value: "withdrawal", label: "Spend", icon: ArrowUpFromLine, hint: "Money that left the account" },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight, hint: "Move money from one of your accounts to another" },
];

export const isOutflow = (type: Transaction["type"]) => type === "withdrawal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  /** Needed to find the other side of a transfer being edited. */
  transactions: Transaction[];
  categories: Category[];
  onAddCategory: (name: string) => Promise<string>;
  /** Edit this transaction; otherwise a new one is added. */
  editing?: Transaction | null;
  /** Pre-selected account for new transactions. */
  accountId?: number | null;
  onSaved: () => void;
};

type Form = {
  type: Transaction["type"]; amount: string; description: string; category: string; date: string;
  /** The account (for a transfer: the one money leaves). */
  accountId: number | null;
  /** Transfers only: the account money arrives in. */
  toAccountId: number | null;
};

/** The account a transfer leg's money left from, and the one it went to. */
const transferEnds = (tx: Transaction, all: Transaction[]): { from: number | null; to: number | null } => {
  const other = tx.transferId !== undefined ? all.find((x) => x.transferId === tx.transferId && x.id !== tx.id) : undefined;
  if (tx.amount < 0) return { from: tx.accountId, to: other?.accountId ?? null };
  return { from: other?.accountId ?? null, to: tx.accountId };
};

export default function TransactionDialog({ open, onOpenChange, accounts, transactions, categories, onAddCategory, editing, accountId, onSaved }: Props) {
  const blank = (): Form => {
    const lastAccount = Number(readStored(LAST_ACCOUNT));
    const preferred = accountId ?? (accounts.some((a) => a.id === lastAccount) ? lastAccount : accounts.length === 1 ? accounts[0].id : null);
    const lastType = readStored(LAST_TYPE) as Transaction["type"] | null;
    return {
      type: TYPE_OPTIONS.some((o) => o.value === lastType) ? lastType! : "withdrawal",
      amount: "", description: "", accountId: preferred, toAccountId: null, category: "", date: todayStr(),
    };
  };
  const [form, setForm] = useState<Form>(blank);

  useEffect(() => {
    if (!open) return;
    if (!editing) return setForm(blank());
    const ends = editing.type === "transfer" ? transferEnds(editing, transactions) : null;
    setForm({
      type: editing.type, amount: String(Math.abs(editing.amount)), description: editing.description,
      accountId: ends ? ends.from : editing.accountId, toAccountId: ends ? ends.to : null,
      category: editing.category, date: editing.date ?? todayStr(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, accountId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const isTransfer = form.type === "transfer";

  const save = async (another: boolean) => {
    const amount = Math.abs(Number(form.amount));
    if (!(amount > 0)) return showError("Please enter an amount");
    if (form.accountId === null) return showError(isTransfer ? "Please choose the account to move money from" : "Please choose an account");
    if (isTransfer) {
      if (form.toAccountId === null) return showError("Please choose the account to move money to");
      if (form.toAccountId === form.accountId) return showError("Pick two different accounts");
    }
    if (!form.date) return showError("Please choose a date");
    const base = { description: form.description.trim(), category: form.category, date: form.date };
    try {
      if (isTransfer) {
        const transfer = { ...base, amount, fromAccountId: form.accountId, toAccountId: form.toAccountId! };
        if (editing?.transferId !== undefined) await databaseService.updateTransfer(editing.transferId, transfer);
        else {
          // A new transfer, or an older one-sided entry being turned into a real one
          await databaseService.addTransfer(transfer);
          if (editing) await databaseService.deleteTransaction(editing.id);
        }
      } else {
        const data = { ...base, type: form.type, amount: isOutflow(form.type) ? -amount : amount, accountId: form.accountId };
        if (editing?.transferId !== undefined) {
          // No longer a transfer: replace both legs with a single transaction
          await databaseService.addTransaction(data);
          await databaseService.deleteTransaction(editing.id);
        } else if (editing) await databaseService.updateTransaction(editing.id, data);
        else await databaseService.addTransaction(data);
      }
      writeStored(LAST_ACCOUNT, String(form.accountId));
      writeStored(LAST_TYPE, form.type);
      showSuccess(editing ? "Transaction updated" : isTransfer ? "Transfer added" : "Transaction added");
      onSaved();
      if (another && !editing) setForm((f) => ({ ...f, amount: "", description: "" }));
      else onOpenChange(false);
    } catch (e) {
      showError(e instanceof Error && isTransfer ? e.message : "Failed to save the transaction");
    }
  };

  const accountSelect = (label: string, value: number | null, onChange: (id: number) => void, exclude: number | null) => (
    <Field label={label}>
      <Select value={value !== null ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className={triggerCls}>
          <Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Choose account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)} disabled={a.id === exclude}>{a.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <EntryDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? FileText : Plus}
      title={editing ? "Edit transaction" : "Add transaction"}
      description={editing ? undefined : "Pick a type, enter the amount and press Enter."}
      submitLabel={editing ? "Save changes" : "Add"}
      submitIcon={editing ? Save : Plus}
      onSubmit={() => save(false)}
      secondary={editing ? undefined : { label: "Add & next", onClick: () => save(true) }}
    >
      <Segmented label="Transaction type" value={form.type} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Amount">
          <IconInput
            data-autofocus
            symbol="$" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00"
            value={form.amount} onChange={(e) => set("amount", e.target.value)}
            className="text-lg font-semibold tabular-nums"
          />
        </Field>
        {isTransfer ? null : accountSelect("Account", form.accountId, (id) => set("accountId", id), null)}
      </div>
      {isTransfer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accountSelect("From account", form.accountId, (id) => set("accountId", id), form.toAccountId)}
          {accountSelect("To account", form.toAccountId, (id) => set("toAccountId", id), form.accountId)}
        </div>
      )}
      <Field label="Description">
        <IconInput icon={FileText} placeholder="What was it for? (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Category">
          <CategorySelect categories={categories} value={form.category} onChange={(v) => set("category", v)} onAdd={onAddCategory} />
        </Field>
        <Field label="Date">
          <IconInput icon={Calendar} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          <div className="flex gap-1 mt-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => set("date", todayStr())}>Today</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => set("date", addDaysStr(todayStr(), -1))}>Yesterday</Button>
          </div>
        </Field>
      </div>
    </EntryDialog>
  );
}
