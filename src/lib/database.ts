import { format, parseISO } from "date-fns";
import { showError } from "@/utils/toast";
import {
  BILLING_CYCLES,
  COMPOUNDING_OPTIONS,
  CURRENCIES,
  DEFAULT_RATES,
  PERIOD_UNITS,
  type BillingCycle,
  type Compounding,
  type Currency,
  type ExchangeRates,
  type PeriodUnit,
  type Rounding,
} from "@/lib/finance";

export type Account = {
  id: number;
  name: string;
  /**
   * Undated amount that is part of the balance but isn't stored as a transaction.
   * Positive = "Unaccounted for income"; negative = "Unaccounted for spending".
   */
  unaccounted: number;
  /** When locked, the balance stays at `lockedBalance` whatever transactions are added or removed. */
  locked: boolean;
  lockedBalance: number;
};

export type Person = {
  id: number;
  name: string;
};

export type Category = {
  id: number;
  name: string;
};

export type SubscriptionKind = "own" | "other" | "loan";

export type Transaction = {
  id: number;
  type: "deposit" | "withdrawal" | "transfer" | "income";
  amount: number;
  description: string;
  accountId: number;
  category: string;
  date?: string;
  /**
   * A transfer between two accounts is stored as two legs (out of one account, into the other) that
   * share this id. Transfers without it are older one-sided entries.
   */
  transferId?: number;
};

/** What a transfer between two of your accounts is made of. `amount` is positive. */
export type TransferInput = {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description: string;
  category: string;
  date: string;
};

export type Subscription = {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  billingCycle: BillingCycle;
  /** Used when billingCycle is "custom": every N days/weeks/months/years. */
  billingEvery?: number;
  billingUnit?: PeriodUnit;
  startDate: string;
  category: string;
  active: boolean;
  /**
   * "own" = my subscription, "other" = someone else's subscription,
   * "loan" = a recurring loan payment with a person.
   */
  kind: SubscriptionKind;
  /** Who it belongs to / who the loan is with (kind "other" and "loan"). */
  personId?: number;
  /** Whether the money leaves my side. For "loan": true = I pay them, false = they pay me. */
  paidByMe: boolean;
  /** Account the payment goes through. */
  accountId?: number;
  /** How converted / fractional amounts are rounded when applied to an account. */
  rounding: Rounding;
};

export type Repayment = {
  id: number;
  date: string;
  amount: number;
};

/** A loan that is skimmed off income automatically (e.g. an NZ student loan: 12% of income over a threshold). */
export type AutoRepay = {
  ratePct: number;
  /** Yearly income below which nothing is repaid. */
  thresholdAnnual: number;
  payFrequency: "weekly" | "fortnightly" | "monthly";
  /** True if income transactions are logged before the deduction, false if after it. */
  incomeIsGross: boolean;
  /** Only income into this account counts (undefined = every account). */
  accountId?: number;
  /** `currentBalance` is the balance on this date; income from then on reduces it. */
  startDate: string;
  rounding: Rounding;
};

export type Debt = {
  id: number;
  /** "owe" = liability (I owe them), "owed" = asset (they owe me) */
  direction: "owe" | "owed";
  name: string;
  personId: number;
  amount: number;
  currency: Currency;
  dateCreated: string;
  dueDate?: string;
  notes?: string;
  currentBalance: number;
  repayments: Repayment[];
  autoRepay?: AutoRepay;
  /** Stale = no longer a concern. Kept for the record but left out of totals and graphs. */
  stale?: boolean;
};

export type InterestBasis = "monthly" | "yearly";

export type Settings = {
  exchangeRates: ExchangeRates;
  rwtRate: number;
  /** Whether the interest calculator and new interest rules default to a month or a year. */
  interestBasis: InterestBasis;
};

export type InterestCalculation = {
  id: number;
  createdAt: string;
  mode: "forward" | "reverse";
  principal: number;
  ratePct: number;
  periodValue: number;
  periodUnit: PeriodUnit;
  compounding: Compounding;
  applyTax: boolean;
  taxRate: number;
  rounding: Rounding;
  grossInterest: number;
  tax: number;
  netInterest: number;
  finalBalance: number;
};

/** Interest an account earns, credited every period. Applied to the history through the timeline. */
export type InterestRule = {
  id: number;
  name: string;
  accountId: number;
  ratePct: number;
  billingCycle: BillingCycle;
  billingEvery?: number;
  billingUnit?: PeriodUnit;
  /** Interest starts accruing on this date; the first credit comes one period later. */
  startDate: string;
  /** Deduct matching tax rules (e.g. RWT) from each credit. */
  applyTax: boolean;
  rounding: Rounding;
  active: boolean;
};

export type TaxRule = {
  id: number;
  name: string;
  ratePct: number;
  /** "interest" = deducted from interest credits; "income" = deducted from income transactions. */
  base: "interest" | "income";
  /** undefined = every account */
  accountId?: number;
  /** For base "income": whether logged income is before (gross) or after (net) the tax. */
  incomeIsGross: boolean;
  rounding: Rounding;
  active: boolean;
};

export type EventOverride = {
  /** Move the event to a different day. */
  date?: string;
  /** Leave this event out. */
  skip?: boolean;
  rounding?: Rounding;
};

export type Timeline = {
  accountId: number;
  /** Chosen range; undefined = automatic (first dated activity / today). */
  start?: string;
  end?: string;
  applied: boolean;
  appliedStart?: string;
  appliedEnd?: string;
  overrides: Record<string, EventOverride>;
  /** Manual order of the events on a day: date -> event keys. */
  dayOrder: Record<string, string[]>;
};

export type DatabaseExport = {
  version: number;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  people?: Person[];
  categories?: Category[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  settings?: Settings;
  interestHistory?: InterestCalculation[];
  interestRules?: InterestRule[];
  taxRules?: TaxRule[];
  timelines?: Timeline[];
};

function defaultSettings(): Settings {
  return { exchangeRates: { ...DEFAULT_RATES }, rwtRate: DEFAULT_RWT_RATE, interestBasis: "monthly" };
}

const STORAGE_KEY = "turbobudget-data";
const STORAGE_VERSION = 4;
const DEFAULT_RWT_RATE = 10.5;

let accountsState: Account[] = [];
let transactionsState: Transaction[] = [];
let peopleState: Person[] = [];
let categoriesState: Category[] = [];
let subscriptionsState: Subscription[] = [];
let debtsState: Debt[] = [];
let settingsState: Settings = defaultSettings();
let interestHistoryState: InterestCalculation[] = [];
let interestRulesState: InterestRule[] = [];
let taxRulesState: TaxRule[] = [];
let timelinesState: Timeline[] = [];
let isLoaded = false;

const normalizeDate = (value: unknown): string => {
  if (!value) {
    return format(new Date(), "yyyy-MM-dd");
  }

  if (typeof value === "string") {
    try {
      return format(parseISO(value), "yyyy-MM-dd");
    } catch {
      return value;
    }
  }

  if (value instanceof Date) {
    return format(value, "yyyy-MM-dd");
  }

  return String(value);
};

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const normalizeRounding = (value: unknown, fallback: Rounding = "nearest"): Rounding =>
  value === "up" || value === "down" || value === "nearest" ? value : fallback;

const normalizeAccount = (account: Partial<Account>): Account => ({
  id: Number(account.id ?? 0),
  name: String(account.name ?? "Unnamed account"),
  unaccounted: num(account.unaccounted),
  locked: account.locked === true,
  lockedBalance: num(account.lockedBalance),
});

const normalizeTransaction = (transaction: Partial<Transaction>): Transaction => {
  const type = (transaction.type as Transaction["type"]) ?? "deposit";
  const transferId = Number(transaction.transferId);
  return {
    id: Number(transaction.id ?? 0),
    type,
    amount: Number(transaction.amount ?? 0),
    description: String(transaction.description ?? ""),
    accountId: Number(transaction.accountId ?? 0),
    category: String(transaction.category ?? "").trim(),
    date: normalizeDate(transaction.date),
    ...(type === "transfer" && Number.isInteger(transferId) && transferId > 0 ? { transferId } : {}),
  };
};

/**
 * Keeps only well-formed transfers: exactly one leg out and one leg in, on two different accounts.
 * Anything else loses its link and stays as a plain one-sided transfer.
 */
const sanitizeTransfers = (transactions: Transaction[]): Transaction[] => {
  const legs = new Map<number, Transaction[]>();
  for (const t of transactions) {
    if (t.transferId !== undefined) legs.set(t.transferId, [...(legs.get(t.transferId) ?? []), t]);
  }
  const valid = new Set<number>();
  for (const [id, pair] of legs) {
    if (pair.length === 2 && pair[0].accountId !== pair[1].accountId && pair[0].amount * pair[1].amount < 0) valid.add(id);
  }
  return transactions.map((t) => {
    if (t.transferId === undefined || valid.has(t.transferId)) return t;
    const { transferId: _unlinked, ...rest } = t;
    return rest;
  });
};

const normalizeCurrency = (value: unknown): Currency =>
  CURRENCIES.includes(value as Currency) ? (value as Currency) : "NZD";

const normalizePerson = (person: Partial<Person>): Person => ({
  id: num(person.id),
  name: String(person.name ?? "").trim() || "Unnamed person",
});

const normalizeCategory = (c: Partial<Category>): Category => ({
  id: num(c.id),
  name: String(c.name ?? "").trim() || "Unnamed category",
});

/** Finds a person by name (case-insensitive), adding them to `people` if missing. */
const personIdByName = (people: Person[], name: string): number => {
  const clean = name.trim() || "Unknown";
  const found = people.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (found) return found.id;
  const id = getNextId(people);
  people.push({ id, name: clean });
  return id;
};

const normalizeCycle = (c: {
  billingCycle?: unknown;
  billingEvery?: unknown;
  billingUnit?: unknown;
}) => {
  const billingCycle = BILLING_CYCLES.includes(c.billingCycle as BillingCycle)
    ? (c.billingCycle as BillingCycle)
    : "monthly";
  if (billingCycle !== "custom") return { billingCycle };
  return {
    billingCycle,
    billingEvery: Math.max(1, Math.round(num(c.billingEvery, 1))),
    billingUnit: PERIOD_UNITS.includes(c.billingUnit as PeriodUnit) ? (c.billingUnit as PeriodUnit) : "months",
  };
};

const normalizeSubscription = (
  sub: Partial<Subscription>,
  people: Person[] = peopleState,
  accounts: Account[] = accountsState
): Subscription => {
  const kind: SubscriptionKind = sub.kind === "other" || sub.kind === "loan" ? sub.kind : "own";
  const personId =
    kind !== "own" && people.some((p) => p.id === sub.personId) ? Number(sub.personId) : undefined;
  const accountId = accounts.some((a) => a.id === sub.accountId) ? Number(sub.accountId) : undefined;
  return {
    id: num(sub.id),
    name: String(sub.name ?? "Unnamed subscription"),
    amount: num(sub.amount),
    currency: normalizeCurrency(sub.currency),
    ...normalizeCycle(sub),
    startDate: normalizeDate(sub.startDate),
    category: String(sub.category ?? "").trim(),
    active: sub.active !== false,
    kind,
    personId,
    // My own subscriptions are always paid by me
    paidByMe: kind === "own" ? true : sub.paidByMe !== false,
    accountId,
    rounding: normalizeRounding(sub.rounding),
  };
};

const normalizeRepayment = (r: Partial<Repayment>): Repayment => ({
  id: num(r.id),
  date: normalizeDate(r.date),
  amount: num(r.amount),
});

const normalizeAutoRepay = (a: Partial<AutoRepay> | undefined, accounts: Account[]): AutoRepay | undefined => {
  if (!a) return undefined;
  const rate = num(a.ratePct, 12);
  return {
    ratePct: rate >= 0 && rate < 100 ? rate : 12,
    thresholdAnnual: Math.max(0, num(a.thresholdAnnual, 24128)),
    payFrequency: a.payFrequency === "weekly" || a.payFrequency === "monthly" ? a.payFrequency : "fortnightly",
    incomeIsGross: a.incomeIsGross !== false,
    accountId: accounts.some((x) => x.id === a.accountId) ? Number(a.accountId) : undefined,
    startDate: normalizeDate(a.startDate),
    rounding: normalizeRounding(a.rounding, "down"),
  };
};

/** `legacy.person` is the free-text name used by files saved before people were a list. */
const normalizeDebt = (
  debt: Partial<Debt> & { person?: string },
  people: Person[] = peopleState,
  accounts: Account[] = accountsState
): Debt => ({
  id: num(debt.id),
  direction: debt.direction === "owed" ? "owed" : "owe",
  name: String(debt.name ?? "Unnamed debt"),
  personId: people.some((p) => p.id === debt.personId)
    ? Number(debt.personId)
    : personIdByName(people, String(debt.person ?? "")),
  amount: num(debt.amount),
  currency: normalizeCurrency(debt.currency),
  dateCreated: normalizeDate(debt.dateCreated),
  dueDate: debt.dueDate ? normalizeDate(debt.dueDate) : undefined,
  notes: debt.notes ? String(debt.notes) : undefined,
  currentBalance: num(debt.currentBalance, num(debt.amount)),
  repayments: Array.isArray(debt.repayments) ? debt.repayments.map(normalizeRepayment) : [],
  autoRepay: normalizeAutoRepay(debt.autoRepay, accounts),
  ...(debt.stale === true ? { stale: true } : {}),
});

const normalizeSettings = (settings?: Partial<Settings>): Settings => {
  const usd = num(settings?.exchangeRates?.USD, DEFAULT_RATES.USD);
  const eur = num(settings?.exchangeRates?.EUR, DEFAULT_RATES.EUR);
  const rwt = num(settings?.rwtRate, DEFAULT_RWT_RATE);
  return {
    exchangeRates: {
      USD: usd > 0 ? usd : DEFAULT_RATES.USD,
      EUR: eur > 0 ? eur : DEFAULT_RATES.EUR,
    },
    rwtRate: rwt >= 0 && rwt < 100 ? rwt : DEFAULT_RWT_RATE,
    interestBasis: settings?.interestBasis === "yearly" ? "yearly" : "monthly",
  };
};

const normalizeInterestCalc = (c: Partial<InterestCalculation>): InterestCalculation => ({
  id: num(c.id),
  createdAt: String(c.createdAt ?? new Date().toISOString()),
  mode: c.mode === "reverse" ? "reverse" : "forward",
  principal: num(c.principal),
  ratePct: num(c.ratePct),
  periodValue: num(c.periodValue),
  periodUnit: (PERIOD_UNITS.includes(c.periodUnit as PeriodUnit) ? c.periodUnit : "years") as PeriodUnit,
  compounding: (COMPOUNDING_OPTIONS.some((o) => o.id === c.compounding) ? c.compounding : "simple") as Compounding,
  applyTax: Boolean(c.applyTax),
  taxRate: num(c.taxRate, DEFAULT_RWT_RATE),
  rounding: normalizeRounding(c.rounding),
  grossInterest: num(c.grossInterest),
  tax: num(c.tax),
  netInterest: num(c.netInterest),
  finalBalance: num(c.finalBalance),
});

const normalizeInterestRule = (r: Partial<InterestRule>): InterestRule => ({
  id: num(r.id),
  name: String(r.name ?? "Interest").trim() || "Interest",
  accountId: num(r.accountId),
  ratePct: num(r.ratePct),
  ...normalizeCycle(r),
  startDate: normalizeDate(r.startDate),
  applyTax: r.applyTax !== false,
  rounding: normalizeRounding(r.rounding, "down"),
  active: r.active !== false,
});

const normalizeTaxRule = (t: Partial<TaxRule>, accounts: Account[] = accountsState): TaxRule => {
  const rate = num(t.ratePct, DEFAULT_RWT_RATE);
  return {
    id: num(t.id),
    name: String(t.name ?? "Tax").trim() || "Tax",
    ratePct: rate >= 0 && rate < 100 ? rate : DEFAULT_RWT_RATE,
    base: t.base === "income" ? "income" : "interest",
    accountId: accounts.some((a) => a.id === t.accountId) ? Number(t.accountId) : undefined,
    incomeIsGross: t.incomeIsGross !== false,
    rounding: normalizeRounding(t.rounding, "nearest"),
    active: t.active !== false,
  };
};

const normalizeTimeline = (t: Partial<Timeline>): Timeline => {
  const overrides: Record<string, EventOverride> = {};
  for (const [key, o] of Object.entries(t.overrides ?? {})) {
    const ov: EventOverride = {};
    if (o?.date) ov.date = normalizeDate(o.date);
    if (o?.skip) ov.skip = true;
    if (o?.rounding) ov.rounding = normalizeRounding(o.rounding);
    if (Object.keys(ov).length > 0) overrides[key] = ov;
  }
  const dayOrder: Record<string, string[]> = {};
  for (const [day, keys] of Object.entries(t.dayOrder ?? {})) {
    if (Array.isArray(keys)) dayOrder[day] = keys.map(String);
  }
  return {
    accountId: num(t.accountId),
    start: t.start ? normalizeDate(t.start) : undefined,
    end: t.end ? normalizeDate(t.end) : undefined,
    applied: t.applied === true,
    appliedStart: t.appliedStart ? normalizeDate(t.appliedStart) : undefined,
    appliedEnd: t.appliedEnd ? normalizeDate(t.appliedEnd) : undefined,
    overrides,
    dayOrder,
  };
};

/** Keeps locked accounts at their locked balance by adjusting the undated unaccounted amount. */
const relockAccounts = (accounts: Account[], transactions: Transaction[]): Account[] =>
  accounts.map((a) => {
    if (!a.locked) return a;
    const accounted = transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0);
    return { ...a, unaccounted: round2(a.lockedBalance - accounted) };
  });

const normalizeDatabase = (data: Partial<DatabaseExport>): DatabaseExport => {
  const accounts0 = Array.isArray(data.accounts) ? data.accounts.map(normalizeAccount) : [];
  const transactions = Array.isArray(data.transactions)
    ? sanitizeTransfers(data.transactions.map(normalizeTransaction))
    : [];
  const accounts = relockAccounts(accounts0, transactions);
  const people = Array.isArray(data.people) ? data.people.map(normalizePerson) : [];
  // Debts may add people (older files stored the name as plain text)
  const debts = Array.isArray(data.debts) ? data.debts.map((d) => normalizeDebt(d, people, accounts)) : [];
  const subscriptions = Array.isArray(data.subscriptions)
    ? data.subscriptions.map((s) => normalizeSubscription(s, people, accounts))
    : [];

  // Categories are a list like people. Older files only had free-text names, so collect those.
  const categories = Array.isArray(data.categories) ? data.categories.map(normalizeCategory) : [];
  for (const name of [...transactions.map((t) => t.category), ...subscriptions.map((s) => s.category)]) {
    if (name && !categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      categories.push({ id: getNextId(categories), name });
    }
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  return {
    version: data.version ?? STORAGE_VERSION,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    accounts,
    transactions,
    people,
    categories,
    subscriptions,
    debts,
    settings: normalizeSettings(data.settings),
    interestHistory: Array.isArray(data.interestHistory)
      ? data.interestHistory.map(normalizeInterestCalc)
      : [],
    interestRules: Array.isArray(data.interestRules)
      ? data.interestRules.map(normalizeInterestRule).filter((r) => accountIds.has(r.accountId))
      : [],
    taxRules: Array.isArray(data.taxRules) ? data.taxRules.map((t) => normalizeTaxRule(t, accounts)) : [],
    timelines: Array.isArray(data.timelines)
      ? data.timelines.map(normalizeTimeline).filter((t) => accountIds.has(t.accountId))
      : [],
  };
};

const applyDatabase = (db: DatabaseExport) => {
  accountsState = db.accounts;
  transactionsState = db.transactions;
  peopleState = db.people ?? [];
  categoriesState = db.categories ?? [];
  subscriptionsState = db.subscriptions ?? [];
  debtsState = db.debts ?? [];
  settingsState = db.settings ?? defaultSettings();
  interestHistoryState = db.interestHistory ?? [];
  interestRulesState = db.interestRules ?? [];
  taxRulesState = db.taxRules ?? [];
  timelinesState = db.timelines ?? [];
};

const resetState = () => applyDatabase(normalizeDatabase({}));

const ensureLoaded = () => {
  if (isLoaded || typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      applyDatabase(normalizeDatabase(JSON.parse(raw) as Partial<DatabaseExport>));
    }
  } catch (error) {
    console.error("Failed to load database from storage:", error);
    resetState();
  }

  isLoaded = true;
};

const snapshot = (): DatabaseExport => ({
  version: STORAGE_VERSION,
  exportedAt: new Date().toISOString(),
  accounts: accountsState.map((a) => ({ ...a })),
  transactions: transactionsState.map((t) => ({ ...t })),
  people: peopleState.map((p) => ({ ...p })),
  categories: categoriesState.map((c) => ({ ...c })),
  subscriptions: subscriptionsState.map((s) => ({ ...s })),
  debts: debtsState.map((d) => ({
    ...d,
    repayments: d.repayments.map((r) => ({ ...r })),
    autoRepay: d.autoRepay ? { ...d.autoRepay } : undefined,
  })),
  settings: { ...settingsState, exchangeRates: { ...settingsState.exchangeRates } },
  interestHistory: interestHistoryState.map((c) => ({ ...c })),
  interestRules: interestRulesState.map((r) => ({ ...r })),
  taxRules: taxRulesState.map((t) => ({ ...t })),
  timelines: timelinesState.map(cloneTimeline),
});

const cloneTimeline = (t: Timeline): Timeline => ({
  ...t,
  overrides: Object.fromEntries(Object.entries(t.overrides).map(([k, v]) => [k, { ...v }])),
  dayOrder: Object.fromEntries(Object.entries(t.dayOrder).map(([k, v]) => [k, [...v]])),
});

const persistState = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
};

const getNextId = (items: Array<{ id: number }>) => {
  if (items.length === 0) {
    return 1;
  }

  return Math.max(...items.map((item) => item.id)) + 1;
};

const nextTransferId = () =>
  transactionsState.reduce((max, t) => Math.max(max, t.transferId ?? 0), 0) + 1;

/** The two legs of a transfer: the one leaving `from` (negative) first, then the one arriving in `to`. */
const buildTransferLegs = (transfer: TransferInput, firstId: number, transferId: number): Transaction[] => {
  const amount = Math.abs(transfer.amount);
  if (!(amount > 0)) throw new Error("Enter an amount");
  if (transfer.fromAccountId === transfer.toAccountId) throw new Error("Pick two different accounts");
  if (![transfer.fromAccountId, transfer.toAccountId].every((id) => accountsState.some((a) => a.id === id))) {
    throw new Error("Account not found");
  }
  const date = normalizeDate(transfer.date);
  const common = { type: "transfer" as const, description: transfer.description, category: transfer.category, date, transferId };
  return [
    { ...common, id: firstId, amount: -amount, accountId: transfer.fromAccountId },
    { ...common, id: firstId + 1, amount, accountId: transfer.toAccountId },
  ];
};

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const databaseService = {
  async getAllAccounts(): Promise<Account[]> {
    ensureLoaded();
    return accountsState.map((account) => ({ ...account }));
  },

  async getAllTransactions(): Promise<Transaction[]> {
    ensureLoaded();
    return transactionsState.map((transaction) => ({ ...transaction }));
  },

  async addAccount(name: string): Promise<number> {
    ensureLoaded();
    const id = getNextId(accountsState);
    accountsState = [...accountsState, { id, name, unaccounted: 0, locked: false, lockedBalance: 0 }];
    persistState();
    return id;
  },

  async updateAccount(id: number, name: string): Promise<void> {
    ensureLoaded();
    accountsState = accountsState.map((account) =>
      account.id === id ? { ...account, name } : account
    );
    persistState();
  },

  async deleteAccount(id: number): Promise<void> {
    ensureLoaded();
    accountsState = accountsState.filter((account) => account.id !== id);
    // The other side of a transfer stays in its account, as a plain one-sided transfer
    const orphaned = new Set(
      transactionsState.filter((t) => t.accountId === id && t.transferId !== undefined).map((t) => t.transferId)
    );
    transactionsState = transactionsState
      .filter((transaction) => transaction.accountId !== id)
      .map((t) => {
        if (t.transferId === undefined || !orphaned.has(t.transferId)) return t;
        const { transferId: _unlinked, ...rest } = t;
        return rest;
      });
    subscriptionsState = subscriptionsState.map((s) =>
      s.accountId === id ? { ...s, accountId: undefined } : s
    );
    interestRulesState = interestRulesState.filter((r) => r.accountId !== id);
    taxRulesState = taxRulesState.map((t) => (t.accountId === id ? { ...t, accountId: undefined } : t));
    timelinesState = timelinesState.filter((t) => t.accountId !== id);
    debtsState = debtsState.map((d) =>
      d.autoRepay?.accountId === id ? { ...d, autoRepay: { ...d.autoRepay, accountId: undefined } } : d
    );
    persistState();
  },

  /**
   * Sets the account's current balance. Whatever the transactions don't explain becomes the
   * undated "unaccounted" amount. With `locked`, later transaction changes keep the balance fixed
   * by adjusting that amount; otherwise it keeps adding to the balance as transactions change.
   */
  async setAccountBalance(id: number, balance: number, locked = false): Promise<void> {
    ensureLoaded();
    const accounted = transactionsState
      .filter((tx) => tx.accountId === id)
      .reduce((sum, tx) => sum + tx.amount, 0);
    // Round to cents so floating-point noise doesn't leave a 0.0000001 "unaccounted" row
    const unaccounted = round2(balance - accounted);
    accountsState = accountsState.map((a) =>
      a.id === id ? { ...a, unaccounted, locked, lockedBalance: locked ? round2(balance) : a.lockedBalance } : a
    );
    persistState();
  },

  /** Unlocks the balance, keeping whatever it currently is. */
  async unlockAccount(id: number): Promise<void> {
    ensureLoaded();
    accountsState = accountsState.map((a) => (a.id === id ? { ...a, locked: false } : a));
    persistState();
  },

  async getAllPeople(): Promise<Person[]> {
    ensureLoaded();
    return peopleState.map((p) => ({ ...p }));
  },

  /** Adds a person, or returns the existing one with the same name (case-insensitive). */
  async addPerson(name: string): Promise<number> {
    ensureLoaded();
    const clean = name.trim();
    if (!clean) throw new Error("Name cannot be empty");
    const id = personIdByName(peopleState, clean);
    persistState();
    return id;
  },

  async renamePerson(id: number, name: string): Promise<void> {
    ensureLoaded();
    const clean = name.trim();
    if (!clean) throw new Error("Name cannot be empty");
    if (peopleState.some((p) => p.id !== id && sameName(p.name, clean))) {
      throw new Error(`Someone called "${clean}" already exists`);
    }
    peopleState = peopleState.map((p) => (p.id === id ? { ...p, name: clean } : p));
    persistState();
  },

  /** Only people with no debts or subscriptions attached can be removed. */
  async deletePerson(id: number): Promise<void> {
    ensureLoaded();
    if (debtsState.some((d) => d.personId === id) || subscriptionsState.some((s) => s.personId === id)) {
      throw new Error("This person is still used by a debt or subscription");
    }
    peopleState = peopleState.filter((p) => p.id !== id);
    persistState();
  },

  async getAllCategories(): Promise<Category[]> {
    ensureLoaded();
    return categoriesState.map((c) => ({ ...c }));
  },

  /** Adds a category, or returns the existing one with the same name (case-insensitive). Returns its name. */
  async addCategory(name: string): Promise<string> {
    ensureLoaded();
    const clean = name.trim();
    if (!clean) throw new Error("Name cannot be empty");
    const found = categoriesState.find((c) => sameName(c.name, clean));
    if (found) return found.name;
    categoriesState = [...categoriesState, { id: getNextId(categoriesState), name: clean }];
    persistState();
    return clean;
  },

  /** Renaming updates every transaction and subscription that uses the category. */
  async renameCategory(id: number, name: string): Promise<void> {
    ensureLoaded();
    const clean = name.trim();
    if (!clean) throw new Error("Name cannot be empty");
    if (categoriesState.some((c) => c.id !== id && sameName(c.name, clean))) {
      throw new Error(`A category called "${clean}" already exists`);
    }
    const old = categoriesState.find((c) => c.id === id);
    if (!old) return;
    categoriesState = categoriesState.map((c) => (c.id === id ? { ...c, name: clean } : c));
    transactionsState = transactionsState.map((t) => (t.category === old.name ? { ...t, category: clean } : t));
    subscriptionsState = subscriptionsState.map((s) => (s.category === old.name ? { ...s, category: clean } : s));
    persistState();
  },

  /** Deleting a category leaves its transactions and subscriptions uncategorised. */
  async deleteCategory(id: number): Promise<void> {
    ensureLoaded();
    const old = categoriesState.find((c) => c.id === id);
    if (!old) return;
    categoriesState = categoriesState.filter((c) => c.id !== id);
    transactionsState = transactionsState.map((t) => (t.category === old.name ? { ...t, category: "" } : t));
    subscriptionsState = subscriptionsState.map((s) => (s.category === old.name ? { ...s, category: "" } : s));
    persistState();
  },

  async addTransaction(transaction: Omit<Transaction, "id">): Promise<number> {
    ensureLoaded();
    const id = getNextId(transactionsState);
    const normalizedTransaction: Transaction = {
      ...transaction,
      id,
      date: normalizeDate(transaction.date ?? new Date()),
    };
    transactionsState = [normalizedTransaction, ...transactionsState];
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
    return id;
  },

  /** Adds a transfer: money leaves `fromAccountId` and arrives in `toAccountId`. Returns the transfer id. */
  async addTransfer(transfer: TransferInput): Promise<number> {
    ensureLoaded();
    const legs = buildTransferLegs(transfer, getNextId(transactionsState), nextTransferId());
    transactionsState = [...legs, ...transactionsState];
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
    return legs[0].transferId!;
  },

  /** Changes both legs of a transfer. */
  async updateTransfer(transferId: number, transfer: TransferInput): Promise<void> {
    ensureLoaded();
    const existing = transactionsState.filter((t) => t.transferId === transferId);
    if (existing.length !== 2) throw new Error("Transfer not found");
    const [out, into] = buildTransferLegs(transfer, 0, transferId);
    transactionsState = transactionsState.map((t) => {
      if (t.transferId !== transferId) return t;
      return { ...t, ...(t.amount < 0 ? out : into), id: t.id };
    });
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
  },

  /** Re-adds deleted transactions with their old ids (used by Undo). */
  async restoreTransactions(transactions: Transaction[]): Promise<void> {
    ensureLoaded();
    const fresh = transactions.filter((tx) => !transactionsState.some((t) => t.id === tx.id));
    if (fresh.length === 0) return;
    transactionsState = [...fresh.map(normalizeTransaction), ...transactionsState];
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
  },

  async updateTransaction(id: number, transaction: Omit<Transaction, "id">): Promise<void> {
    ensureLoaded();
    transactionsState = transactionsState.map((tx) =>
      tx.id === id
        ? { ...tx, ...transaction, date: normalizeDate(transaction.date ?? tx.date) }
        : tx
    );
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
  },

  /** Deletes a transaction; a transfer goes with both of its legs. Returns what was removed (for Undo). */
  async deleteTransaction(id: number): Promise<Transaction[]> {
    ensureLoaded();
    const target = transactionsState.find((t) => t.id === id);
    if (!target) return [];
    const removed = transactionsState.filter((t) =>
      t.id === id || (target.transferId !== undefined && t.transferId === target.transferId)
    );
    transactionsState = transactionsState.filter((t) => !removed.includes(t));
    accountsState = relockAccounts(accountsState, transactionsState);
    persistState();
    return removed.map((t) => ({ ...t }));
  },

  async getSettings(): Promise<Settings> {
    ensureLoaded();
    return { ...settingsState, exchangeRates: { ...settingsState.exchangeRates } };
  },

  async updateSettings(settings: Settings): Promise<void> {
    ensureLoaded();
    settingsState = normalizeSettings(settings);
    persistState();
  },

  async getAllSubscriptions(): Promise<Subscription[]> {
    ensureLoaded();
    return subscriptionsState.map((sub) => ({ ...sub }));
  },

  async addSubscription(sub: Omit<Subscription, "id">): Promise<number> {
    ensureLoaded();
    const id = getNextId(subscriptionsState);
    subscriptionsState = [...subscriptionsState, normalizeSubscription({ ...sub, id })];
    persistState();
    return id;
  },

  async updateSubscription(id: number, sub: Omit<Subscription, "id">): Promise<void> {
    ensureLoaded();
    subscriptionsState = subscriptionsState.map((s) =>
      s.id === id ? normalizeSubscription({ ...sub, id }) : s
    );
    persistState();
  },

  async deleteSubscription(id: number): Promise<void> {
    ensureLoaded();
    subscriptionsState = subscriptionsState.filter((s) => s.id !== id);
    persistState();
  },

  async getAllDebts(): Promise<Debt[]> {
    ensureLoaded();
    return snapshot().debts ?? [];
  },

  async addDebt(debt: Omit<Debt, "id" | "repayments">): Promise<number> {
    ensureLoaded();
    const id = getNextId(debtsState);
    debtsState = [...debtsState, normalizeDebt({ ...debt, id, repayments: [] })];
    persistState();
    return id;
  },

  /** Updates the editable fields; repayment history is preserved. */
  async updateDebt(id: number, debt: Omit<Debt, "id" | "repayments">): Promise<void> {
    ensureLoaded();
    debtsState = debtsState.map((d) =>
      d.id === id ? normalizeDebt({ ...debt, id, repayments: d.repayments, stale: d.stale }) : d
    );
    persistState();
  },

  async deleteDebt(id: number): Promise<void> {
    ensureLoaded();
    debtsState = debtsState.filter((d) => d.id !== id);
    persistState();
  },

  /** Logs a repayment and reduces the current balance (never below zero). */
  async addRepayment(debtId: number, repayment: Omit<Repayment, "id">): Promise<void> {
    ensureLoaded();
    debtsState = debtsState.map((d) => {
      if (d.id !== debtId) return d;
      const id = getNextId(d.repayments);
      return {
        ...d,
        repayments: [...d.repayments, normalizeRepayment({ ...repayment, id })],
        currentBalance: Math.max(0, d.currentBalance - repayment.amount),
      };
    });
    persistState();
  },

  /** Marks a debt as stale (no longer a concern) or active again. */
  async setDebtStale(id: number, stale: boolean): Promise<void> {
    ensureLoaded();
    debtsState = debtsState.map((d) => {
      if (d.id !== id) return d;
      const { stale: _old, ...rest } = d;
      return stale ? { ...rest, stale: true } : rest;
    });
    persistState();
  },

  /** Removes a repayment and adds its amount back to the current balance. */
  async deleteRepayment(debtId: number, repaymentId: number): Promise<void> {
    ensureLoaded();
    debtsState = debtsState.map((d) => {
      if (d.id !== debtId) return d;
      const target = d.repayments.find((r) => r.id === repaymentId);
      if (!target) return d;
      return {
        ...d,
        repayments: d.repayments.filter((r) => r.id !== repaymentId),
        currentBalance: d.currentBalance + target.amount,
      };
    });
    persistState();
  },

  async getInterestHistory(): Promise<InterestCalculation[]> {
    ensureLoaded();
    return interestHistoryState.map((c) => ({ ...c }));
  },

  async addInterestCalculation(calc: Omit<InterestCalculation, "id" | "createdAt">): Promise<void> {
    ensureLoaded();
    const id = getNextId(interestHistoryState);
    interestHistoryState = [
      normalizeInterestCalc({ ...calc, id, createdAt: new Date().toISOString() }),
      ...interestHistoryState,
    ];
    persistState();
  },

  async deleteInterestCalculation(id: number): Promise<void> {
    ensureLoaded();
    interestHistoryState = interestHistoryState.filter((c) => c.id !== id);
    persistState();
  },

  async getAllInterestRules(): Promise<InterestRule[]> {
    ensureLoaded();
    return interestRulesState.map((r) => ({ ...r }));
  },

  async addInterestRule(rule: Omit<InterestRule, "id">): Promise<number> {
    ensureLoaded();
    const id = getNextId(interestRulesState);
    interestRulesState = [...interestRulesState, normalizeInterestRule({ ...rule, id })];
    persistState();
    return id;
  },

  async updateInterestRule(id: number, rule: Omit<InterestRule, "id">): Promise<void> {
    ensureLoaded();
    interestRulesState = interestRulesState.map((r) => (r.id === id ? normalizeInterestRule({ ...rule, id }) : r));
    persistState();
  },

  async deleteInterestRule(id: number): Promise<void> {
    ensureLoaded();
    interestRulesState = interestRulesState.filter((r) => r.id !== id);
    persistState();
  },

  async getAllTaxRules(): Promise<TaxRule[]> {
    ensureLoaded();
    return taxRulesState.map((t) => ({ ...t }));
  },

  async addTaxRule(rule: Omit<TaxRule, "id">): Promise<number> {
    ensureLoaded();
    const id = getNextId(taxRulesState);
    taxRulesState = [...taxRulesState, normalizeTaxRule({ ...rule, id })];
    persistState();
    return id;
  },

  async updateTaxRule(id: number, rule: Omit<TaxRule, "id">): Promise<void> {
    ensureLoaded();
    taxRulesState = taxRulesState.map((t) => (t.id === id ? normalizeTaxRule({ ...rule, id }) : t));
    persistState();
  },

  async deleteTaxRule(id: number): Promise<void> {
    ensureLoaded();
    taxRulesState = taxRulesState.filter((t) => t.id !== id);
    persistState();
  },

  async getAllTimelines(): Promise<Timeline[]> {
    ensureLoaded();
    return timelinesState.map(cloneTimeline);
  },

  async saveTimeline(timeline: Timeline): Promise<void> {
    ensureLoaded();
    const clean = normalizeTimeline(timeline);
    timelinesState = timelinesState.some((t) => t.accountId === clean.accountId)
      ? timelinesState.map((t) => (t.accountId === clean.accountId ? clean : t))
      : [...timelinesState, clean];
    persistState();
  },

  /** Unloads everything: resets in-memory state and removes the stored copy. */
  async clearAll(): Promise<void> {
    resetState();
    isLoaded = true;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },

  async exportData(): Promise<DatabaseExport> {
    ensureLoaded();
    return snapshot();
  },

  async importData(data: DatabaseExport): Promise<void> {
    const normalized = normalizeDatabase(data);

    applyDatabase(normalized);
    isLoaded = true;
    persistState();
  },

  downloadDatabase(data: DatabaseExport, filename = "turbobudget.db") {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      if (blob.size === 0) {
        throw new Error("Empty database file generated");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      console.error("Database download failed:", error);
      showError("Failed to generate database file");
      throw error;
    }
  },
};

export const downloadDatabase = (data: DatabaseExport, filename = "turbobudget.db") => {
  databaseService.downloadDatabase(data, filename);
};

export const readDatabaseFile = async (file: File): Promise<DatabaseExport> => {
  try {
    const text = await file.text();

    let data: Partial<DatabaseExport>;
    try {
      data = JSON.parse(text) as Partial<DatabaseExport>;
    } catch (parseError) {
      console.error("readDatabaseFile: JSON parse failed", { parseError });
      throw new Error("Invalid JSON in database file");
    }

    if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
      throw new Error("Invalid database structure");
    }

    return normalizeDatabase(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("readDatabaseFile: failed", { error: err });
    throw new Error(`Invalid database file: ${message}`);
  }
};
