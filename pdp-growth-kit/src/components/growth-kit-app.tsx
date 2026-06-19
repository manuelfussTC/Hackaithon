"use client";
/* eslint-disable @next/next/no-img-element */

import JSZip from "jszip";
import Image from "next/image";
import { useEffect, useState } from "react";
import { growthKitMarkdown } from "@/lib/export";
import type { GrowthKit, ImageAsset, PersistedState, ProductAnalysis, SectionKey } from "@/lib/schemas";

const STORAGE_KEY = "growth-kit:v1";
const initialState: PersistedState = { version: 1, step: "input", analysis: null, kit: null };
const sections: { key: SectionKey; label: string; index: string }[] = [
  { key: "metaAds", label: "Meta Ads", index: "01" },
  { key: "googleAds", label: "Google Ads", index: "02" },
  { key: "newsletter", label: "Newsletter", index: "03" },
  { key: "linkedin", label: "LinkedIn", index: "04" },
  { key: "ugcScripts", label: "UGC Skripte", index: "05" },
  { key: "imagePrompts", label: "Bildprompts", index: "06" },
  { key: "landingHero", label: "Landingpage Hero", index: "07" },
];
const fieldLabels: Record<string, string> = {
  primaryText: "Primary Text", headline: "Headline", description: "Description", cta: "CTA",
  headlines: "Headlines", descriptions: "Descriptions", keywords: "Keywords", subjectLines: "Betreffzeilen",
  preheader: "Preheader", body: "Text", hook: "Hook", hashtags: "Hashtags", title: "Titel", duration: "Dauer",
  scenes: "Szenen", voiceover: "Voice-over", onScreenText: "On-screen Text", prompt: "Prompt",
  composition: "Komposition", light: "Licht", style: "Stil", format: "Format", negativePrompt: "Negativhinweise",
  eyebrow: "Eyebrow", subheadline: "Subheadline", primaryCta: "Primary CTA", secondaryCta: "Secondary CTA",
  trustLine: "Trust Line", visualDirection: "Visuelle Richtung",
};

type ApiError = { code?: string; message?: string };

async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error((data as ApiError).message || "Die Anfrage ist fehlgeschlagen.");
  return data as T;
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function deepSet(source: unknown, path: (string | number)[], value: string): unknown {
  const clone = structuredClone(source);
  let cursor = clone as Record<string | number, unknown>;
  path.slice(0, -1).forEach((part) => { cursor = cursor[part] as Record<string | number, unknown>; });
  cursor[path[path.length - 1]] = value;
  return clone;
}

export function GrowthKitApp() {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"analyze" | "generate" | "regenerate" | "" >("");
  const [error, setError] = useState("");
  const [active, setActive] = useState<SectionKey>("metaAds");
  const [instruction, setInstruction] = useState("");
  const [images, setImages] = useState<Record<string, ImageAsset>>({});
  const [imageBusy, setImageBusy] = useState<string[]>([]);
  const [imageFallback, setImageFallback] = useState<string[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as PersistedState;
          if (saved.version === 1) setState(saved);
        }
      } catch { localStorage.removeItem(STORAGE_KEY); }
      setHydrated(true);
    });
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state, hydrated]);

  const progress = state.step === "input" ? 0 : state.step === "review" ? 50 : 100;
  const analysis = state.analysis;
  const kit = state.kit;

  async function analyze(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy("analyze");
    try {
      const result = await api<ProductAnalysis>("/api/analyze", { url });
      setState({ version: 1, step: "review", analysis: result, kit: null });
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function generate() {
    if (!analysis) return; setError(""); setBusy("generate");
    try {
      const result = await api<GrowthKit>("/api/generate", { analysis });
      setState({ version: 1, step: "results", analysis, kit: result }); setActive("metaAds");
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function regenerate() {
    if (!analysis || !kit) return; setBusy("regenerate"); setError("");
    try {
      const wantsHeroImage = active === "landingHero" && /\b(bild|image|foto|motiv|visual|hintergrund|hero)\b/i.test(instruction);
      if (wantsHeroImage) {
        await createImage(buildHeroImagePrompt(analysis, kit.landingHero, instruction));
        setInstruction("");
        return;
      }
      const value = await api<unknown>("/api/regenerate", { section: active, analysis, current: kit[active], instruction });
      setState({ ...state, kit: { ...kit, [active]: value } as GrowthKit }); setInstruction("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  function updateAnalysis(field: keyof ProductAnalysis, value: string | string[]) {
    if (analysis) setState({ ...state, analysis: { ...analysis, [field]: value } });
  }

  function updateSection(path: (string | number)[], value: string) {
    if (!kit) return;
    const changed = deepSet(kit[active], path, value);
    setState({ ...state, kit: { ...kit, [active]: changed } as GrowthKit });
  }

  async function createImage(item: GrowthKit["imagePrompts"][number], useReference = true) {
    if (!analysis || imageBusy.includes(item.id)) return false;
    setImageBusy((current) => current.includes(item.id) ? current : [...current, item.id]);
    setError("");
    setImageFallback((current) => current.filter((id) => id !== item.id));
    setImageErrors((current) => { const next = { ...current }; delete next[item.id]; return next; });
    try {
      const result = await api<ImageAsset>("/api/images/generate", {
        promptId: item.id, prompt: `${item.prompt}. Composition: ${item.composition}. Lighting: ${item.light}. Style: ${item.style}. Avoid: ${item.negativePrompt}`,
        format: item.format, productImageUrl: analysis.imageUrl, useReference,
      });
      setImages((current) => ({ ...current, [item.id]: result }));
      return true;
    } catch (e) {
      const message = (e as Error).message;
      setImageErrors((current) => ({ ...current, [item.id]: message }));
      if (useReference && analysis.imageUrl) setImageFallback((current) => [...new Set([...current, item.id])]);
      return false;
    } finally { setImageBusy((current) => current.filter((id) => id !== item.id)); }
  }

  function reset() {
    if (state.step !== "input" && !window.confirm("Aktuelles Growth Kit wirklich verwerfen?")) return;
    localStorage.removeItem(STORAGE_KEY); setState(initialState); setImages({}); setUrl(""); setError("");
  }

  async function exportZip() {
    if (!analysis || !kit) return;
    const zip = new JSZip();
    zip.file("growth-kit.md", growthKitMarkdown(analysis, kit));
    zip.file("growth-kit.json", JSON.stringify({ analysis, kit }, null, 2));
    Object.values(images).forEach((image) => zip.file(`images/${image.filename}`, image.base64, { base64: true }));
    download("growth-kit.zip", await zip.generateAsync({ type: "blob" }), "application/zip");
  }

  if (!hydrated) return <div className="boot"><span /></div>;
  return (
    <main className="app-shell">
      <Header progress={progress} onReset={reset} />
      {error && <div className="error-banner"><span>Hinweis</span>{error}<button onClick={() => setError("")}>×</button></div>}
      {state.step === "input" && <InputStep url={url} setUrl={setUrl} onSubmit={analyze} busy={busy === "analyze"} />}
      {state.step === "review" && analysis && <ReviewStep analysis={analysis} update={updateAnalysis} onBack={() => setState({ ...state, step: "input" })} onGenerate={generate} busy={busy === "generate"} />}
      {state.step === "results" && analysis && kit && (
        <ResultsStep analysis={analysis} kit={kit} active={active} setActive={setActive} update={updateSection}
          instruction={instruction} setInstruction={setInstruction} regenerate={regenerate} busy={busy === "regenerate"}
          images={images} imageBusy={imageBusy} imageFallback={imageFallback} imageErrors={imageErrors} createImage={createImage}
          exportMarkdown={() => download("growth-kit.md", growthKitMarkdown(analysis, kit), "text/markdown")}
          exportJson={() => download("growth-kit.json", JSON.stringify({ analysis, kit }, null, 2), "application/json")}
          exportZip={exportZip} />
      )}
      <footer><span>K5 × TEAM ONE HACK-AI-THON</span><span>BUILD. SHIP. GROW.</span></footer>
    </main>
  );
}

function Header({ progress, onReset }: { progress: number; onReset: () => void }) {
  return <><header className="topbar"><button className="brand" onClick={onReset} aria-label="Startseite"><img src="/team-one.svg" width="136" height="34" alt="Team One" /><i>×</i><img src="/aca.png" width="113" height="38" alt="Agentic Commerce Alliance" /></button><div className="product-name"><span>PDP</span> → GROWTH KIT</div><HeaderCredits /><button className="new-project" onClick={onReset}>Neues Projekt ↗</button></header><div className="progress"><span style={{ width: `${progress}%` }} /></div></>;
}

function HeaderCredits() { return <div className="header-credits"><div className="header-tech" aria-label="Verwendete Technologien"><span>BUILT WITH</span><a className="openai-badge" href="https://openai.com/" target="_blank" rel="noreferrer" aria-label="OpenAI – Technologieanbieter"><img src="/openai-logo.png" alt="OpenAI" /></a><a href="https://www.tavily.com/" target="_blank" rel="noreferrer" aria-label="Tavily – Technologieanbieter"><img src="/tavily-wordmark.svg" alt="Tavily" /></a></div><a className="builder" href="https://manuel-fuss.de" target="_blank" rel="noreferrer" aria-label="Website von Manuel Fuß"><span>BUILT BY</span><strong>Manuel Fuß ↗</strong></a></div>; }

function InputStep({ url, setUrl, onSubmit, busy }: { url: string; setUrl: (v: string) => void; onSubmit: (e: React.FormEvent) => void; busy: boolean }) {
  return <section className="intro"><div className="eyebrow">01 · PDP ANALYSE</div><h1>TURN PRODUCT<br />PAGES INTO<br /><em>GROWTH.</em></h1><p>Eine URL. Sieben Kanäle. Dein komplettes Marketingpaket, erzeugt aus echten Produktdaten.</p><form onSubmit={onSubmit} className="url-form"><label htmlFor="pdp-url">Produktdetailseite</label><div><input id="pdp-url" type="url" required placeholder="https://dein-shop.de/products/..." value={url} onChange={(e) => setUrl(e.target.value)} /><button disabled={busy}>{busy ? "WIRD ANALYSIERT …" : "PDP ANALYSIEREN →"}</button></div><small>Öffentliche Produkt-URL · Keine Anmeldung · Keine Datenbank</small></form><div className="channel-strip">{sections.map((s) => <span key={s.key}>{s.index} {s.label}</span>)}</div></section>;
}

function ReviewStep({ analysis, update, onBack, onGenerate, busy }: { analysis: ProductAnalysis; update: (field: keyof ProductAnalysis, value: string | string[]) => void; onBack: () => void; onGenerate: () => void; busy: boolean }) {
  return <section className="workspace review"><div className="workspace-head"><div><span className="eyebrow">02 · ANALYSE PRÜFEN</span><h2>FOUNDATION<br /><em>BEFORE FIRE.</em></h2></div><p>Wir haben Produkt, Zielgruppe und Markenstimme erkannt. Korrigiere die Basis, bevor die Kampagne entsteht.</p></div><div className="review-grid"><article className="product-card">{analysis.imageUrl ? <div className="product-image" style={{ backgroundImage: `url("${analysis.imageUrl.replaceAll('"', "%22")}")` }} /> : <div className="product-image placeholder">NO IMAGE</div>}<div className="product-card-copy"><span>{analysis.brand}</span><h3>{analysis.productName}</h3><p>{analysis.price || "Preis nicht erkannt"}</p><a href={analysis.sourceUrl} target="_blank" rel="noreferrer">PDP öffnen ↗</a></div></article><div className="analysis-form"><Field label="Produktname" value={analysis.productName} onChange={(v) => update("productName", v)} /><Field label="Marke" value={analysis.brand} onChange={(v) => update("brand", v)} /><Field label="Zielgruppe" value={analysis.audience} onChange={(v) => update("audience", v)} area /><Field label="Tonalität" value={analysis.tone} onChange={(v) => update("tone", v)} /><ListField label="Kernvorteile" value={analysis.benefits} onChange={(v) => update("benefits", v)} /><ListField label="Proof Points" value={analysis.proofPoints} onChange={(v) => update("proofPoints", v)} /><label className="field"><span>Ausgabesprache</span><select value={analysis.language} onChange={(e) => update("language", e.target.value)}><option value="de">Deutsch</option><option value="en">English</option></select></label></div></div><div className="actions"><button className="button ghost" onClick={onBack}>← URL ändern</button><button className="button primary" onClick={onGenerate} disabled={busy}>{busy ? "7 KANÄLE WERDEN GEBAUT …" : "GROWTH KIT GENERIEREN →"}</button></div>{busy && <GenerationStatus />}</section>;
}

function GenerationStatus() { return <div className="generation"><strong>FROM PDP TO CAMPAIGN</strong><div>{sections.map((s, i) => <span key={s.key} style={{ animationDelay: `${i * .2}s` }}>{s.label}</span>)}</div></div>; }

type ResultsProps = {
  analysis: ProductAnalysis; kit: GrowthKit; active: SectionKey; setActive: (v: SectionKey) => void;
  update: (path: (string | number)[], value: string) => void; instruction: string; setInstruction: (v: string) => void;
  regenerate: () => void; busy: boolean; images: Record<string, ImageAsset>; imageBusy: string[]; imageFallback: string[];
  imageErrors: Record<string, string>;
  createImage: (item: GrowthKit["imagePrompts"][number], useReference?: boolean) => Promise<boolean>;
  exportMarkdown: () => void; exportJson: () => void; exportZip: () => void;
};

function ResultsStep(props: ResultsProps) {
  const current = props.kit[props.active];
  const section = sections.find((s) => s.key === props.active)!;
  const heroImagePrompt = props.kit.landingHero ? buildHeroImagePrompt(props.analysis, props.kit.landingHero, "") : null;
  return <section className="results"><aside><div className="result-product"><span>{props.analysis.brand}</span><strong>{props.analysis.productName}</strong><small>7/7 Assets bereit</small></div><label className="mobile-channel"><span>Output wählen</span><select aria-label="Output wählen" value={props.active} onChange={(event) => props.setActive(event.target.value as SectionKey)}>{sections.map((item) => <option key={item.key} value={item.key}>{item.index} · {item.label}</option>)}</select></label><nav>{sections.map((item) => <button key={item.key} className={props.active === item.key ? "active" : ""} onClick={() => props.setActive(item.key)}><span>{item.index}</span>{item.label}<i>→</i></button>)}</nav><div className="exports"><span>EXPORT</span><button onClick={props.exportMarkdown}>Markdown ↓</button><button onClick={props.exportJson}>JSON ↓</button>{Object.keys(props.images).length > 0 && <button onClick={props.exportZip}>Kit + Bilder ZIP ↓</button>}</div></aside><div className="result-main"><div className="result-head"><div><span className="eyebrow">{section.index} · OUTPUT</span><h2>{section.label}</h2></div><button className="copy" onClick={() => navigator.clipboard.writeText(JSON.stringify(current, null, 2))}>Bereich kopieren</button></div>{props.active === "landingHero" && props.kit.landingHero && heroImagePrompt && <HeroPreview hero={props.kit.landingHero} sourceImage={props.analysis.imageUrl} generatedImage={props.images["landing-hero"]} busy={props.imageBusy.includes("landing-hero")} error={props.imageErrors["landing-hero"]} canFallback={props.imageFallback.includes("landing-hero")} onGenerate={(useReference = true) => props.createImage(heroImagePrompt, useReference)} />}{props.active === "imagePrompts" ? <ImagePrompts items={props.kit.imagePrompts} update={props.update} images={props.images} busy={props.imageBusy} fallback={props.imageFallback} errors={props.imageErrors} create={props.createImage} /> : <JsonEditor value={current} onChange={props.update} /> }<div className="regenerate"><div><strong>Diesen Bereich neu denken</strong><small>{props.active === "landingHero" ? "Bei Bild-, Foto- oder Motiv-Wünschen wird GPT Image 2 verwendet." : "Alle anderen Assets bleiben unverändert."}</small></div><input value={props.instruction} onChange={(e) => props.setInstruction(e.target.value)} placeholder="Optionaler Änderungswunsch …" /><button onClick={props.regenerate} disabled={props.busy}>{props.busy ? props.imageBusy.includes("landing-hero") ? "HERO-BILD WIRD GENERIERT …" : "ARBEITET …" : "NEU GENERIEREN ↻"}</button></div></div></section>;
}

function JsonEditor({ value, onChange, path = [] }: { value: unknown; onChange: (path: (string | number)[], value: string) => void; path?: (string | number)[] }) {
  if (typeof value === "string") return <textarea className="editable" value={value} onChange={(e) => onChange(path, e.target.value)} rows={Math.min(9, Math.max(2, Math.ceil(value.length / 75)))} />;
  if (Array.isArray(value)) return <div className="editor-list">{value.map((item, i) => <article className={typeof item === "object" ? "asset-card" : "line-item"} key={i}>{typeof item === "object" && <span className="card-number">{String(i + 1).padStart(2, "0")}</span>}<JsonEditor value={item} onChange={onChange} path={[...path, i]} /></article>)}</div>;
  if (value && typeof value === "object") return <div className="object-editor">{Object.entries(value).filter(([key]) => key !== "id").map(([key, item]) => <label className="editor-field" key={key}><span>{fieldLabels[key] || key}</span><JsonEditor value={item} onChange={onChange} path={[...path, key]} /></label>)}</div>;
  return null;
}

function ImagePrompts({ items, update, images, busy, fallback, errors, create }: { items: GrowthKit["imagePrompts"]; update: (path: (string | number)[], value: string) => void; images: Record<string, ImageAsset>; busy: string[]; fallback: string[]; errors: Record<string, string>; create: (item: GrowthKit["imagePrompts"][number], useReference?: boolean) => Promise<boolean> }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((item) => item.id)));
  const [batch, setBatch] = useState({ active: false, done: 0, total: 0 });
  const selectedItems = items.filter((item) => selected.has(item.id));
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((item) => item.id)));

  async function generateSelected() {
    const queue = selectedItems.filter((item) => !busy.includes(item.id));
    if (!queue.length) return;
    setBatch({ active: true, done: 0, total: queue.length });
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        await create(item);
        setBatch((current) => ({ ...current, done: current.done + 1 }));
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
    setBatch((current) => ({ ...current, active: false }));
  }

  return <div className="image-workspace"><div className="batch-toolbar"><label><input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} disabled={batch.active} /><span>{selected.size === items.length ? "Alle ausgewählt" : `${selected.size} ausgewählt`}</span></label><button onClick={generateSelected} disabled={!selected.size || batch.active}>{batch.active ? `${batch.done} VON ${batch.total} FERTIG …` : `${selected.size} BILDER GENERIEREN →`}</button></div>{batch.total > 0 && <div className={`batch-progress ${batch.active ? "active" : "complete"}`} aria-live="polite"><div><strong>{batch.active ? "GPT IMAGE 2 GENERIERT" : "BATCH ABGESCHLOSSEN"}</strong><span>{batch.done} / {batch.total}</span></div><i><span style={{ width: `${(batch.done / batch.total) * 100}%` }} /></i></div>}<div className="prompt-grid">{items.map((item, i) => { const image = images[item.id]; const isBusy = busy.includes(item.id); return <article className={`prompt-card ${selected.has(item.id) ? "selected" : ""}`} key={item.id}><label className="prompt-select"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={batch.active} /><span>Motiv {String(i + 1).padStart(2, "0")}</span></label><div className={`generated-image ${item.format} ${isBusy ? "loading" : ""}`}>{isBusy ? <div className="image-loader"><i /><strong>WIRD GENERIERT</strong><small>GPT Image 2 arbeitet am Motiv</small></div> : image ? <Image src={`data:${image.mimeType};base64,${image.base64}`} width={1024} height={1024} unoptimized alt={item.title} /> : <span>{String(i + 1).padStart(2, "0")}<small>{item.format}</small></span>}</div><Field label="Titel" value={item.title} onChange={(v) => update([i, "title"], v)} /><Field label="Prompt" value={item.prompt} onChange={(v) => update([i, "prompt"], v)} area /><div className="prompt-meta"><span>{item.style}</span><span>{item.light}</span><span>{item.composition}</span></div>{errors[item.id] && <div className="image-error">{errors[item.id]}</div>}<button className="button image-button" onClick={() => create(item)} disabled={isBusy || batch.active}>{isBusy ? "GPT IMAGE 2 ARBEITET …" : image ? "NEU GENERIEREN ↻" : "BILD GENERIEREN →"}</button>{fallback.includes(item.id) && <button className="text-button" onClick={() => create(item, false)} disabled={isBusy || batch.active}>Ohne Produktreferenz versuchen</button>}{image && <button className="text-button" onClick={() => download(image.filename, Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0)), image.mimeType)}>PNG herunterladen ↓</button>}</article>; })}</div></div>;
}

function buildHeroImagePrompt(analysis: ProductAnalysis, hero: GrowthKit["landingHero"], instruction: string): GrowthKit["imagePrompts"][number] {
  return {
    id: "landing-hero",
    title: `Landingpage Hero für ${analysis.productName}`,
    prompt: `Erzeuge ein hochwertiges breites E-Commerce-Landingpage-Hero-Bild für ${analysis.brand} ${analysis.productName}. Visuelle Richtung: ${hero.visualDirection}. ${instruction ? `Änderungswunsch: ${instruction}.` : ""} Das Produkt muss originalgetreu bleiben. Lasse ausreichend ruhige Negativfläche für Headline und CTA. Keine Schrift und keine UI-Elemente im Bild.`,
    composition: "Breites 3:2 Hero-Layout mit klarer Negativfläche für Text",
    light: "Hochwertiges kampagnentaugliches Licht",
    style: "Premium E-Commerce Kampagne",
    format: "landscape",
    negativePrompt: "Text, Logos, Wasserzeichen, verzerrtes Produkt, zusätzliche Produkte",
  };
}

function HeroPreview({ hero, sourceImage, generatedImage, busy, error, canFallback, onGenerate }: { hero: GrowthKit["landingHero"]; sourceImage: string; generatedImage?: ImageAsset; busy: boolean; error?: string; canFallback: boolean; onGenerate: (useReference?: boolean) => Promise<boolean> }) {
  const image = generatedImage ? `data:${generatedImage.mimeType};base64,${generatedImage.base64}` : sourceImage;
  return <div className={`hero-preview ${generatedImage ? "generated" : ""}`} data-generated-image={generatedImage ? "true" : "false"} style={image ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.88), rgba(0,0,0,.18)), url("${image.replaceAll('"', "%22")}")` } : undefined}>{busy && <div className="hero-image-loading"><i /><strong>HERO-BILD WIRD GENERIERT</strong><small>GPT Image 2 baut das neue Motiv</small></div>}<div className="hero-content"><span>{hero.eyebrow}</span><h3>{hero.headline}</h3><p>{hero.subheadline}</p><button>{hero.primaryCta} →</button><small>{hero.trustLine}</small></div><div className="hero-image-actions"><button onClick={() => onGenerate()} disabled={busy}>{generatedImage ? "Hero-Bild neu generieren ↻" : "Hero-Bild generieren →"}</button>{generatedImage && <button onClick={() => download(generatedImage.filename, Uint8Array.from(atob(generatedImage.base64), (c) => c.charCodeAt(0)), generatedImage.mimeType)}>PNG herunterladen ↓</button>}</div>{error && <div className="hero-image-error">{error}{canFallback && <button onClick={() => onGenerate(false)} disabled={busy}>Ohne Produktreferenz versuchen</button>}</div>}</div>;
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) { return <label className="field"><span>{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>; }
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) { return <Field label={label} area value={value.join("\n")} onChange={(v) => onChange(v.split("\n").map((x) => x.trim()).filter(Boolean))} />; }
