import type { GrowthKit, ProductAnalysis } from "./schemas";

export function growthKitMarkdown(analysis: ProductAnalysis, kit: GrowthKit) {
  const lines = [`# Growth Kit: ${analysis.productName}`, "", `**Marke:** ${analysis.brand}`, `**Quelle:** ${analysis.sourceUrl}`, "", "## Meta Ads"];
  kit.metaAds.forEach((ad, i) => lines.push(`\n### Variante ${i + 1}\n\n${ad.primaryText}\n\n**${ad.headline}**\n\n${ad.description}\n\nCTA: ${ad.cta}`));
  lines.push("", "## Google Ads", "", "### Headlines", ...kit.googleAds.headlines.map((x) => `- ${x}`), "", "### Descriptions", ...kit.googleAds.descriptions.map((x) => `- ${x}`), "", `**Keywords:** ${kit.googleAds.keywords.join(", ")}`);
  lines.push("", "## Newsletter", "", ...kit.newsletter.subjectLines.map((x) => `- Betreff: ${x}`), `\nPreheader: ${kit.newsletter.preheader}\n`, kit.newsletter.body);
  lines.push("", "## LinkedIn Post", "", kit.linkedin.hook, "", kit.linkedin.body, "", kit.linkedin.cta, kit.linkedin.hashtags.join(" "));
  lines.push("", "## UGC Skripte");
  kit.ugcScripts.forEach((x) => lines.push(`\n### ${x.title} (${x.duration})\n\n**Hook:** ${x.hook}\n\n${x.scenes.join("\n")}\n\n**Voice-over:** ${x.voiceover}\n\n**On-screen:** ${x.onScreenText.join(" / ")}\n\n**CTA:** ${x.cta}`));
  lines.push("", "## Bildprompts");
  kit.imagePrompts.forEach((x) => lines.push(`\n### ${x.title}\n\n${x.prompt}\n\n- Komposition: ${x.composition}\n- Licht: ${x.light}\n- Stil: ${x.style}\n- Format: ${x.format}\n- Vermeiden: ${x.negativePrompt}`));
  const hero = kit.landingHero;
  lines.push("", "## Landingpage Hero", "", hero.eyebrow, `\n# ${hero.headline}\n`, hero.subheadline, `\nCTA: ${hero.primaryCta} / ${hero.secondaryCta}`, `\n${hero.trustLine}`, `\nVisuelle Richtung: ${hero.visualDirection}`);
  return lines.join("\n");
}
