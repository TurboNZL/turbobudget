import { useMemo } from "react";
import { brandDataUri } from "@/lib/brand";
import { useAppearance } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** The logo: the bars on a tile, in the selected colour theme and UI style. (The browser tab shows the bars alone, see lib/brand.ts.) */
export default function BrandMark({ className }: { className?: string }) {
  const { theme, ui } = useAppearance();
  const src = useMemo(() => brandDataUri(theme, ui), [theme, ui]);
  return <img src={src} alt="" width={32} height={32} className={cn("w-8 h-8 shrink-0", className)} />;
}
