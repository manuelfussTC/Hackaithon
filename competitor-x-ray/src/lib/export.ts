import { overallScores, type PdpProfile, type XRayReport } from "./schemas";
import { levelLabel } from "./localization";

const labels = { positioning: "Positionierung", trust: "Trust-Elemente", presentation: "Produktdarstellung", conversion: "Conversion-Hebel" } as const;

export function xrayMarkdown(own: PdpProfile, competitor: PdpProfile, report: XRayReport) {
  const overall = overallScores(report);
  const lines = [
    "# Competitor X-Ray", "",
    `**Eigene PDP:** ${own.brand} ${own.productName} – ${overall.own}/100`,
    `**Wettbewerber:** ${competitor.brand} ${competitor.productName} – ${overall.competitor}/100`,
    `**Vergleichbarkeit:** ${report.fit.score}/100 (${levelLabel(report.fit.level)})`, "",
  ];
  for (const [key, label] of Object.entries(labels)) {
    const section = report.sections[key as keyof typeof report.sections];
    lines.push(`## ${label}`, "", `Eigene PDP: **${section.ownScore}/100** · Wettbewerb: **${section.competitorScore}/100**`, "", section.verdict, "", "### Eigene Stärken", ...section.ownStrengths.map((x) => `- ${x}`), "", "### Wettbewerber-Stärken", ...section.competitorStrengths.map((x) => `- ${x}`), "", "### Eigene Lücken", ...section.ownGaps.map((x) => `- ${x}`), "");
  }
  lines.push("## Top 5 Handlungsempfehlungen", "");
  report.recommendations.forEach((item) => lines.push(`### ${item.rank}. ${item.title}`, "", item.action, "", `**Wirkung:** ${levelLabel(item.impact)} · **Aufwand:** ${levelLabel(item.effort)}`, "", item.rationale, "", `**Erster Schritt:** ${item.firstStep}`, ""));
  lines.push("---", report.disclaimer);
  return lines.join("\n");
}
