import type { Evidence, Side } from "./schemas";

export const levelLabel = (value: "high" | "medium" | "low") => ({
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
})[value];

export const sourceLabel = (value: Evidence["source"]) => ({
  structured: "Strukturierte Daten",
  html: "HTML",
  tavily: "Tavily",
  visual: "Visuell",
})[value];

export const sideLabel = (value: Side) => value === "own" ? "Eigene PDP" : "Wettbewerber";
