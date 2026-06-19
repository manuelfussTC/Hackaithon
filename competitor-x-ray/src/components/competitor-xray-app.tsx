"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { xrayMarkdown } from "@/lib/export";
import { levelLabel, sideLabel, sourceLabel } from "@/lib/localization";
import {
  overallScores,
  type ComparisonFit, type Evidence, type PdpProfile, type PersistedState,
  type ScreenshotMap, type ScreenshotSlot, type SectionKey, type XRayReport, type XRaySection,
} from "@/lib/schemas";

const STORAGE_KEY = "competitor-xray:v1";
const initialState: PersistedState = { version: 1, step: "input", own: null, competitor: null, fit: null, report: null };
const sections: { key: SectionKey; label: string; number: string }[] = [
  { key: "positioning", label: "Positionierung", number: "01" },
  { key: "trust", label: "Trust-Elemente", number: "02" },
  { key: "presentation", label: "Produktdarstellung", number: "03" },
  { key: "conversion", label: "Conversion-Hebel", number: "04" },
  { key: "recommendations", label: "Top 5 Maßnahmen", number: "05" },
];
const screenshotSlots: { key: ScreenshotSlot; label: string; side: "own" | "competitor" }[] = [
  { key: "ownDesktop", label: "Desktop", side: "own" }, { key: "ownMobile", label: "Mobile", side: "own" },
  { key: "competitorDesktop", label: "Desktop", side: "competitor" }, { key: "competitorMobile", label: "Mobile", side: "competitor" },
];

async function jsonApi<T>(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Die Anfrage ist fehlgeschlagen.");
  return data as T;
}

async function formApi<T>(url: string, form: FormData) {
  const response = await fetch(url, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Die Anfrage ist fehlgeschlagen.");
  return data as T;
}

function appendScreenshots(form: FormData, screenshots: ScreenshotMap) {
  Object.entries(screenshots).forEach(([slot, file]) => { if (file) form.append(slot, file); });
}

function download(name: string, value: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function compressScreenshot(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Bitte PNG, JPEG oder WebP hochladen.");
  if (file.size <= 1_000_000) return file;
  const image = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Screenshot konnte nicht gelesen werden.")); image.src = url; });
  URL.revokeObjectURL(url);
  const scale = Math.min(1, 1800 / image.width, 5000 / image.height);
  const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .72));
  if (!blob || blob.size > 1_100_000) throw new Error("Screenshot ist nach Komprimierung noch zu groß. Bitte einen kürzeren Ausschnitt verwenden.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function CompetitorXRayApp() {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [ownUrl, setOwnUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [busy, setBusy] = useState<"extract" | "compare" | "regenerate" | "">("");
  const [error, setError] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotMap>({});
  const [previews, setPreviews] = useState<Partial<Record<ScreenshotSlot, string>>>({});
  const [active, setActive] = useState<SectionKey>("positioning");
  const [instruction, setInstruction] = useState("");
  const [evidenceId, setEvidenceId] = useState("");

  useEffect(() => { queueMicrotask(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const saved = JSON.parse(raw) as PersistedState; if (saved.version === 1) setState(saved); } } catch { localStorage.removeItem(STORAGE_KEY); } setHydrated(true); }); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [hydrated, state]);

  const progress = state.step === "input" ? 0 : state.step === "review" ? 50 : 100;
  const evidence = useMemo(() => [...(state.own?.evidence || []), ...(state.competitor?.evidence || []), ...(state.report?.visualEvidence || [])], [state]);
  const selectedEvidence = evidence.find((item) => item.id === evidenceId);

  async function extract(event: React.FormEvent) {
    event.preventDefault(); setBusy("extract"); setError("");
    try {
      const result = await jsonApi<{ own: PdpProfile; competitor: PdpProfile; fit: ComparisonFit }>("/api/extract", { ownUrl, competitorUrl });
      setState({ version: 1, step: "review", report: null, ...result });
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function addScreenshot(slot: ScreenshotSlot, file?: File) {
    if (!file) return;
    try {
      const compressed = await compressScreenshot(file);
      if (previews[slot]) URL.revokeObjectURL(previews[slot]!);
      setScreenshots((current) => ({ ...current, [slot]: compressed }));
      setPreviews((current) => ({ ...current, [slot]: URL.createObjectURL(compressed) }));
    } catch (e) { setError((e as Error).message); }
  }

  function removeScreenshot(slot: ScreenshotSlot) {
    if (previews[slot]) URL.revokeObjectURL(previews[slot]!);
    setScreenshots((current) => { const next = { ...current }; delete next[slot]; return next; });
    setPreviews((current) => { const next = { ...current }; delete next[slot]; return next; });
  }

  async function compare() {
    if (!state.own || !state.competitor || !state.fit) return;
    setBusy("compare"); setError("");
    try {
      const form = new FormData(); form.append("own", JSON.stringify(state.own)); form.append("competitor", JSON.stringify(state.competitor)); form.append("fit", JSON.stringify(state.fit)); appendScreenshots(form, screenshots);
      const report = await formApi<XRayReport>("/api/compare", form);
      setState({ ...state, step: "results", report }); setActive("positioning");
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  async function regenerate() {
    if (!state.own || !state.competitor || !state.report) return;
    setBusy("regenerate"); setError("");
    try {
      const form = new FormData(); form.append("section", active); form.append("own", JSON.stringify(state.own)); form.append("competitor", JSON.stringify(state.competitor)); form.append("report", JSON.stringify(state.report)); form.append("instruction", instruction); appendScreenshots(form, screenshots);
      const value = await formApi<unknown>("/api/regenerate", form);
      const report = active === "recommendations" ? { ...state.report, recommendations: value as XRayReport["recommendations"] } : { ...state.report, sections: { ...state.report.sections, [active]: value } };
      setState({ ...state, report: report as XRayReport }); setInstruction("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  function updateProfile(side: "own" | "competitor", field: keyof PdpProfile, value: string) {
    const profile = state[side]; if (!profile) return;
    setState({ ...state, [side]: { ...profile, [field]: value } });
  }

  function reset() {
    if (state.step !== "input" && !confirm("Aktuellen X-Ray wirklich verwerfen?")) return;
    Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
    localStorage.removeItem(STORAGE_KEY); setState(initialState); setScreenshots({}); setPreviews({}); setOwnUrl(""); setCompetitorUrl(""); setError("");
  }

  if (!hydrated) return <div className="boot"><i /></div>;
  return <main className="app"><Header progress={progress} reset={reset} />{error && <div className="error"><strong>HINWEIS</strong>{error}<button onClick={() => setError("")}>×</button></div>}{state.step === "input" && <InputStep ownUrl={ownUrl} competitorUrl={competitorUrl} setOwnUrl={setOwnUrl} setCompetitorUrl={setCompetitorUrl} submit={extract} busy={busy === "extract"} />}{state.step === "review" && state.own && state.competitor && state.fit && <ReviewStep own={state.own} competitor={state.competitor} fit={state.fit} update={updateProfile} previews={previews} addScreenshot={addScreenshot} removeScreenshot={removeScreenshot} compare={compare} back={() => setState({ ...state, step: "input" })} busy={busy === "compare"} />}{state.step === "results" && state.own && state.competitor && state.report && <Results own={state.own} competitor={state.competitor} report={state.report} setReport={(report) => setState({ ...state, report })} active={active} setActive={setActive} instruction={instruction} setInstruction={setInstruction} regenerate={regenerate} busy={busy === "regenerate"} evidence={evidence} showEvidence={setEvidenceId} exportMd={() => download("competitor-xray.md", xrayMarkdown(state.own!, state.competitor!, state.report!), "text/markdown")} exportJson={() => download("competitor-xray.json", JSON.stringify({ own: state.own, competitor: state.competitor, report: state.report }, null, 2), "application/json")} screenshotsAvailable={Object.keys(screenshots).length > 0} />}{selectedEvidence && <EvidenceDrawer evidence={selectedEvidence} close={() => setEvidenceId("")} />}<Footer /></main>;
}

function Header({ progress, reset }: { progress: number; reset: () => void }) { return <><header className="topbar"><button className="brand" onClick={reset}><img src="/team-one.svg" alt="Team One" /><i>×</i><img src="/aca.png" alt="ACA" /></button><strong><em>COMPETITOR</em> X-RAY</strong><HeaderCredits /><button className="reset" onClick={reset}>Neuer Vergleich ↗</button></header><div className="progress"><i style={{ width: `${progress}%` }} /></div></>; }

function HeaderCredits() { return <div className="header-credits"><div className="header-tech" aria-label="Verwendete Technologien"><span>BUILT WITH</span><a className="openai-badge" href="https://openai.com/" target="_blank" rel="noreferrer" aria-label="OpenAI – Technologieanbieter"><img src="/openai-logo.png" alt="OpenAI" /></a><a href="https://www.tavily.com/" target="_blank" rel="noreferrer" aria-label="Tavily – Technologieanbieter"><img src="/tavily-wordmark.svg" alt="Tavily" /></a></div><a className="builder" href="https://manuel-fuss.de" target="_blank" rel="noreferrer" aria-label="Website von Manuel Fuß"><span>BUILT BY</span><strong>Manuel Fuß ↗</strong></a></div>; }

function Footer() { return <footer><div className="footer-copy"><span>K5 × TEAM ONE HACK-AI-THON</span><span>EVIDENCE OVER OPINION.</span></div></footer>; }

function InputStep({ ownUrl, competitorUrl, setOwnUrl, setCompetitorUrl, submit, busy }: { ownUrl: string; competitorUrl: string; setOwnUrl: (v: string) => void; setCompetitorUrl: (v: string) => void; submit: (e: React.FormEvent) => void; busy: boolean }) { return <section className="intro"><span className="kicker">01 · COMPETITOR INTELLIGENCE</span><h1>SEE WHAT<br />THEY DO.<br /><em>WIN BETTER.</em></h1><p>Zwei Produktseiten. Ein evidenzbasierter Vergleich. Klare Hebel statt Bauchgefühl.</p><form onSubmit={submit} className="battle-input"><label><span>DEINE PRODUKTSEITE</span><input type="url" required value={ownUrl} onChange={(e) => setOwnUrl(e.target.value)} placeholder="https://dein-shop.de/produkt/..." /></label><b>VS</b><label><span>WETTBEWERBER</span><input type="url" required value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} placeholder="https://wettbewerber.de/produkt/..." /></label><button disabled={busy}>{busy ? "BEIDE PDPs WERDEN DURCHLEUCHTET …" : "X-RAY STARTEN →"}</button></form><div className="metric-row">{sections.map((item) => <span key={item.key}>{item.number} {item.label}</span>)}</div>{busy && <Loading stages={["Lokale PDP-Signale", "Tavily Advanced", "Produkt-Fit", "Evidenzprofile"]} />}</section>; }

function ReviewStep({ own, competitor, fit, update, previews, addScreenshot, removeScreenshot, compare, back, busy }: { own: PdpProfile; competitor: PdpProfile; fit: ComparisonFit; update: (side: "own" | "competitor", field: keyof PdpProfile, value: string) => void; previews: Partial<Record<ScreenshotSlot, string>>; addScreenshot: (slot: ScreenshotSlot, file?: File) => void; removeScreenshot: (slot: ScreenshotSlot) => void; compare: () => void; back: () => void; busy: boolean }) { return <section className="workspace"><div className="workspace-head"><div><span className="kicker">02 · PROFILE PRÜFEN</span><h2>RIGHT FIGHT.<br /><em>RIGHT SIGNALS.</em></h2></div><FitBadge fit={fit} /></div><div className="profile-grid"><ProfileCard side="own" label="DEINE PDP" profile={own} update={update} /><div className="versus">VS</div><ProfileCard side="competitor" label="WETTBEWERBER" profile={competitor} update={update} /></div><div className="upload-area"><div><span className="kicker">OPTIONALE VISUELLE EVIDENZ</span><h3>Desktop & Mobile Screenshots</h3><p>Nur in dieser Sitzung. Keine Speicherung, kein Export.</p></div><div className="upload-grid">{screenshotSlots.map((slot) => <ScreenshotUpload key={slot.key} slot={slot.key} label={`${slot.side === "own" ? "Eigene PDP" : "Wettbewerber"} · ${slot.label}`} preview={previews[slot.key]} add={addScreenshot} remove={removeScreenshot} />)}</div></div><div className="actions"><button onClick={back}>← URLs ändern</button><button className="primary" onClick={compare} disabled={busy}>{busy ? "SCORECARD WIRD GEBAUT …" : "VERGLEICH GENERIEREN →"}</button></div>{busy && <Loading stages={["Evidenz bewerten", "Positionierung", "Trust & Darstellung", "Conversion & Maßnahmen"]} />}</section>; }

function ProfileCard({ side, label, profile, update }: { side: "own" | "competitor"; label: string; profile: PdpProfile; update: (side: "own" | "competitor", field: keyof PdpProfile, value: string) => void }) { return <article className={`profile ${side}`}>{profile.imageUrl ? <div className="product-image" style={{ backgroundImage: `url("${profile.imageUrl.replaceAll('"', "%22")}")` }} /> : <div className="product-image empty">KEIN BILD</div>}<div className="profile-body"><span className="side-label">{label}</span><Edit label="Produkt" value={profile.productName} onChange={(v) => update(side, "productName", v)} /><Edit label="Marke" value={profile.brand} onChange={(v) => update(side, "brand", v)} /><Edit label="Kategorie" value={profile.category} onChange={(v) => update(side, "category", v)} /><Edit label="Preis" value={profile.price} onChange={(v) => update(side, "price", v)} /><Edit label="Zielgruppe" value={profile.audience} onChange={(v) => update(side, "audience", v)} area /><div className="source-status"><span className={profile.extraction.local ? "ok" : "off"}>HTML</span><span className={profile.extraction.tavily ? "ok" : "off"}>TAVILY</span><span>{profile.evidence.length} BELEGE</span></div></div></article>; }

function ScreenshotUpload({ slot, label, preview, add, remove }: { slot: ScreenshotSlot; label: string; preview?: string; add: (slot: ScreenshotSlot, file?: File) => void; remove: (slot: ScreenshotSlot) => void }) { return <label className={`upload ${preview ? "filled" : ""}`}>{preview ? <><img src={preview} alt={label} /><button type="button" onClick={(e) => { e.preventDefault(); remove(slot); }}>Entfernen ×</button></> : <><strong>＋</strong><span>{label}</span><small>PNG · JPG · WEBP · max. 1 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => add(slot, e.target.files?.[0])} /></>}</label>; }

function FitBadge({ fit }: { fit: ComparisonFit }) { return <div className={`fit ${fit.level}`}><span>VERGLEICHBARKEIT</span><strong>{fit.score}</strong><small>/100 · {levelLabel(fit.level).toUpperCase()}</small><p>{fit.rationale}</p>{fit.warnings.map((warning) => <em key={warning}>! {warning}</em>)}</div>; }

type ResultProps = { own: PdpProfile; competitor: PdpProfile; report: XRayReport; setReport: (v: XRayReport) => void; active: SectionKey; setActive: (v: SectionKey) => void; instruction: string; setInstruction: (v: string) => void; regenerate: () => void; busy: boolean; evidence: Evidence[]; showEvidence: (id: string) => void; exportMd: () => void; exportJson: () => void; screenshotsAvailable: boolean };

function Results(props: ResultProps) { const overall = overallScores(props.report); const current = sections.find((item) => item.key === props.active)!; return <section className="results"><aside><div className="mini-fit"><span>PASSUNG</span><strong>{props.report.fit.score}</strong></div><label className="mobile-section"><span>Bereich</span><select value={props.active} onChange={(e) => props.setActive(e.target.value as SectionKey)}>{sections.map((item) => <option key={item.key} value={item.key}>{item.number} · {item.label}</option>)}</select></label><nav>{sections.map((item) => <button key={item.key} className={props.active === item.key ? "active" : ""} onClick={() => props.setActive(item.key)}><span>{item.number}</span>{item.label}<i>→</i></button>)}</nav><div className="exports"><small>HERUNTERLADEN</small><button onClick={props.exportMd}>Markdown ↓</button><button onClick={props.exportJson}>JSON ↓</button></div></aside><div className="result-body"><div className="score-hero"><ScoreProduct side="own" profile={props.own} score={overall.own} /><div className="delta"><span>Δ</span><strong>{Math.abs(overall.own - overall.competitor)}</strong><small>{overall.own === overall.competitor ? "GLEICHSTAND" : overall.own > overall.competitor ? "DEIN VORSPRUNG" : "DEINE LÜCKE"}</small></div><ScoreProduct side="competitor" profile={props.competitor} score={overall.competitor} /></div><div className="section-head"><div><span className="kicker">{current.number} · X-RAY</span><h2>{current.label}</h2></div><span className="confidence">SICHERHEIT {props.report.confidence}%</span></div>{props.active === "recommendations" ? <Recommendations report={props.report} setReport={props.setReport} evidence={props.evidence} showEvidence={props.showEvidence} /> : <SectionView section={props.report.sections[props.active]} update={(section) => props.setReport({ ...props.report, sections: { ...props.report.sections, [props.active]: section } })} evidence={props.evidence} showEvidence={props.showEvidence} />}<div className="regenerate"><div><strong>Diesen Bereich neu bewerten</strong><small>{props.screenshotsAvailable ? "Screenshots fließen erneut ein." : "Ohne visuelle Uploads."}</small></div><input value={props.instruction} onChange={(e) => props.setInstruction(e.target.value)} placeholder="Optionaler Änderungswunsch …" /><button onClick={props.regenerate} disabled={props.busy}>{props.busy ? "WIRD NEU BEWERTET …" : "NEU GENERIEREN ↻"}</button></div><p className="disclaimer">{props.report.disclaimer}</p></div></section>; }

function ScoreProduct({ side, profile, score }: { side: "own" | "competitor"; profile: PdpProfile; score: number }) { const productName = profile.productName.toLocaleLowerCase().startsWith(profile.brand.toLocaleLowerCase()) ? profile.productName.slice(profile.brand.length).trim() : profile.productName; return <article className={`score-product ${side}`}><span>{side === "own" ? "DEINE PDP" : "WETTBEWERBER"}</span><h3>{profile.brand}<br />{productName}</h3><div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><small>/100</small></div></article>; }

function SectionView({ section, update, evidence, showEvidence }: { section: XRaySection; update: (v: XRaySection) => void; evidence: Evidence[]; showEvidence: (id: string) => void }) { return <div className="section-view"><div className="dual-scores"><ScoreInput label="DEINE PDP" value={section.ownScore} onChange={(value) => update({ ...section, ownScore: value })} /><div className="section-verdict"><span>FAZIT</span><textarea value={section.verdict} onChange={(e) => update({ ...section, verdict: e.target.value })} /></div><ScoreInput label="WETTBEWERBER" value={section.competitorScore} onChange={(value) => update({ ...section, competitorScore: value })} /></div><div className="insight-grid"><ListEditor title="Deine Stärken" values={section.ownStrengths} onChange={(ownStrengths) => update({ ...section, ownStrengths })} /><ListEditor title="Wettbewerber-Stärken" values={section.competitorStrengths} onChange={(competitorStrengths) => update({ ...section, competitorStrengths })} /><ListEditor title="Deine Lücken" values={section.ownGaps} onChange={(ownGaps) => update({ ...section, ownGaps })} /></div><div className="observations"><span className="kicker">BELEGTE BEOBACHTUNGEN</span>{section.observations.map((item, index) => <article key={index}><i className={item.side}>{item.side === "own" ? "EIGEN" : "WETTB."}</i><p>{item.claim}</p><div>{item.evidenceIds.map((id) => <EvidenceButton key={id} id={id} evidence={evidence} show={showEvidence} />)}</div></article>)}</div></div>; }

function Recommendations({ report, setReport, evidence, showEvidence }: { report: XRayReport; setReport: (v: XRayReport) => void; evidence: Evidence[]; showEvidence: (id: string) => void }) { const patch = (index: number, field: string, value: string) => { const recommendations = structuredClone(report.recommendations); recommendations[index] = { ...recommendations[index], [field]: value }; setReport({ ...report, recommendations }); }; return <div className="recommendations">{report.recommendations.map((item, index) => <article key={item.rank}><div className="rank">{String(item.rank).padStart(2, "0")}</div><div><input className="recommendation-title" value={item.title} onChange={(e) => patch(index, "title", e.target.value)} /><textarea value={item.action} onChange={(e) => patch(index, "action", e.target.value)} /><p>{item.rationale}</p><div className="chips"><span>WIRKUNG {levelLabel(item.impact)}</span><span>AUFWAND {levelLabel(item.effort)}</span></div><label>ERSTER SCHRITT<textarea value={item.firstStep} onChange={(e) => patch(index, "firstStep", e.target.value)} /></label><div>{item.evidenceIds.map((id) => <EvidenceButton key={id} id={id} evidence={evidence} show={showEvidence} />)}</div></div></article>)}</div>; }

function EvidenceButton({ id, evidence, show }: { id: string; evidence: Evidence[]; show: (id: string) => void }) { const found = evidence.find((item) => item.id === id); return <button className="evidence-button" onClick={() => show(id)} disabled={!found}>↗ {found?.signal || id}</button>; }
function EvidenceDrawer({ evidence, close }: { evidence: Evidence; close: () => void }) { return <div className="drawer-backdrop" onClick={close}><aside className="drawer" onClick={(e) => e.stopPropagation()}><button onClick={close}>×</button><span className="kicker">BELEG · {sourceLabel(evidence.source)}</span><h3>{evidence.signal}</h3><blockquote>{evidence.excerpt}</blockquote><div><span>{sideLabel(evidence.side).toUpperCase()}</span><strong>SICHERHEIT {evidence.confidence}%</strong></div></aside></div>; }
function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <label className="score-input"><span>{label}</span><input type="number" min="0" max="100" value={value} onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))} /><small>/100</small></label>; }
function ListEditor({ title, values, onChange }: { title: string; values: string[]; onChange: (v: string[]) => void }) { return <label className="list-editor"><span>{title}</span><textarea value={values.map((x) => `• ${x}`).join("\n")} onChange={(e) => onChange(e.target.value.split("\n").map((x) => x.replace(/^\s*[•-]\s*/, "").trim()).filter(Boolean))} /></label>; }
function Edit({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) { return <label className="edit"><span>{label}</span>{area ? <textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}</label>; }
function Loading({ stages }: { stages: string[] }) { return <div className="loading"><div className="scanner" /><strong>COMPETITOR X-RAY LÄUFT</strong><div>{stages.map((stage, index) => <span key={stage} style={{ animationDelay: `${index * .25}s` }}>{stage}</span>)}</div></div>; }
