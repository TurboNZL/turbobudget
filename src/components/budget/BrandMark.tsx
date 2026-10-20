import { cn } from "@/lib/utils";

/** The logo: the engine mark with the bars as its emblem (public/icon.svg, made by scripts/gen-icons.mjs from branding/logo.json). The browser tab shows the bars alone, see lib/brand.ts. */
export default function BrandMark({ className }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={32} height={32} className={cn("w-8 h-8 shrink-0", className)} />;
}
