import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompact(value: number, prefix = ""): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${prefix}${prefix ? " " : ""}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${prefix ? " " : ""}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${prefix}${prefix ? " " : ""}${abs.toLocaleString("en-US")}`;
}
