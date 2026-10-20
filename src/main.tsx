import { createRoot } from "react-dom/client";
import "./globals.css";
// Carries the old BudgetTrack storage keys over before anything reads storage (see lib/legacyNames.ts)
import "./lib/legacyNames";
// Starts the look (turbothemes) before the first render, so the page never flashes the wrong theme
import "./lib/themes";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
