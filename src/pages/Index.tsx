import { useState } from "react";
import {
  BarChart3, ChevronsUpDown, Database, Download, EyeOff, FileText, HandCoins, History, Percent, Receipt, Repeat,
  Settings as SettingsIcon, Upload, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, readDatabaseFile } from "@/lib/database";
import AccountsTab from "@/components/budget/AccountsTab";
import SubscriptionsTab from "@/components/budget/SubscriptionsTab";
import DebtsTab from "@/components/budget/DebtsTab";
import InterestTab from "@/components/budget/InterestTab";
import TaxesTab from "@/components/budget/TaxesTab";
import HistoryTab from "@/components/budget/HistoryTab";
import GraphsTab from "@/components/budget/GraphsTab";
import SettingsTab from "@/components/budget/SettingsTab";
import BrandMark from "@/components/budget/BrandMark";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { readStored, writeStored } from "@/components/budget/styles";

const LOADED_FILE_KEY = "turbobudget-loaded-file";
const TAB_KEY = "turbobudget-tab";

const TABS = [
  ["accounts", "Accounts", Wallet],
  ["subscriptions", "Subscriptions", Repeat],
  ["debts", "Debts", HandCoins],
  ["interest", "Interest", Percent],
  ["taxes", "Taxes", Receipt],
  ["history", "History", History],
  ["graphs", "Graphs", BarChart3],
  ["settings", "Settings", SettingsIcon],
] as const;

export default function Index() {
  // Bumped after an import / unload so every tab reloads its data
  const [dataVersion, setDataVersion] = useState(0);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(() => readStored(LOADED_FILE_KEY));
  const [activeTab, setActiveTab] = useState(() => {
    const stored = readStored(TAB_KEY);
    return TABS.some(([v]) => v === stored) ? stored! : "accounts";
  });
  const [unloadOpen, setUnloadOpen] = useState(false);

  const handleUnload = async () => {
    try {
      await databaseService.clearAll();
      setLoadedFileName(null);
      writeStored(LOADED_FILE_KEY, null);
      setDataVersion((v) => v + 1);
      setUnloadOpen(false);
      showSuccess("Database unloaded");
    } catch {
      showError("Failed to unload database");
    }
  };

  const handleExport = async () => {
    try {
      const data = await databaseService.exportData();
      databaseService.downloadDatabase(data, `turbobudget-${new Date().toISOString().split("T")[0]}.db`);
      showSuccess("Database exported successfully");
    } catch {
      showError("Failed to export database");
    }
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    if (!window.confirm("Importing will replace all current data. Are you sure?")) {
      const el = document.getElementById("import-file") as HTMLInputElement | null;
      if (el) el.value = "";
      return;
    }
    try {
      const data = await readDatabaseFile(file);
      await databaseService.importData(data);
      setDataVersion((v) => v + 1);
      setLoadedFileName(file.name);
      writeStored(LOADED_FILE_KEY, file.name);
      showSuccess(`Loaded ${file.name}`);
    } catch (error) {
      showError("Failed to import database: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      // Clear the file input so the same file can be re-selected later
      const el = document.getElementById("import-file") as HTMLInputElement | null;
      if (el) el.value = "";
    }
  };

  return (
    <div className="bt-root flex min-h-screen flex-col bg-background text-foreground">
      <header className="bt-top sticky top-0 z-30 backdrop-blur">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BrandMark />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-tight">TurboBudget</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <FileText className="w-3 h-3 shrink-0" />
                  {loadedFileName ? `Loaded: ${loadedFileName}` : "No file loaded · changes are saved in this browser"}
                </p>
              </div>
            </div>
            <input
              type="file" accept=".db,.json" className="hidden" id="import-file"
              onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Database className="w-4 h-4 mr-2" />Data<ChevronsUpDown className="w-3 h-3 ml-2 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export .db</DropdownMenuItem>
                <DropdownMenuItem onClick={() => document.getElementById("import-file")?.click()}><Upload className="w-4 h-4 mr-2" />Import .db</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-negative focus:text-negative" onClick={() => setUnloadOpen(true)}>
                  <EyeOff className="w-4 h-4 mr-2" />Unload database
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={unloadOpen}
        title="Unload the current database?"
        description="This clears all accounts, transactions, subscriptions, debts, interest, taxes, history timelines and exchange rates from this browser and returns TurboBudget to a blank state. Export a .db file first if you want to keep your data."
        confirmLabel="Unload"
        onConfirm={handleUnload}
        onCancel={() => setUnloadOpen(false)}
      />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 sm:px-6 py-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); writeStored(TAB_KEY, v); }} className="space-y-4">
          <TabsList className="bg-card border border-border h-auto flex-wrap justify-start">
            {TABS.map(([value, label, Icon]) => (
              <TabsTrigger key={value} value={value} aria-label={label} title={label} className="gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="accounts" className="mt-0"><AccountsTab key={dataVersion} /></TabsContent>
          <TabsContent value="subscriptions" className="mt-0"><SubscriptionsTab key={dataVersion} /></TabsContent>
          <TabsContent value="debts" className="mt-0"><DebtsTab key={dataVersion} /></TabsContent>
          <TabsContent value="interest" className="mt-0"><InterestTab key={dataVersion} /></TabsContent>
          <TabsContent value="taxes" className="mt-0"><TaxesTab key={dataVersion} /></TabsContent>
          <TabsContent value="history" className="mt-0"><HistoryTab key={dataVersion} /></TabsContent>
          <TabsContent value="graphs" className="mt-0"><GraphsTab key={dataVersion} /></TabsContent>
          <TabsContent value="settings" className="mt-0"><SettingsTab key={dataVersion} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
