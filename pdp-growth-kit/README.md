# PDP → Growth Kit

Das PDP Growth Kit analysiert eine öffentliche Produktdetailseite und erzeugt daraus ein strukturiertes Marketingpaket. Produkt- und Markendaten werden vor der Generierung überprüft und können korrigiert werden.

## Outputs

- Meta Ads: drei Varianten
- Google Ads: Headlines, Descriptions und Keywords
- Newsletter: Betreffzeilen, Preheader und Body
- LinkedIn Post
- drei UGC-Skripte
- fünf editierbare Bildprompts
- Landingpage-Hero mit Live-Vorschau

## Schnellstart

Voraussetzungen:

- Node.js 20.9 oder neuer
- npm
- OpenAI API-Key mit Zugriff auf die konfigurierten Modelle

~~~bash
npm install
cp .env.example .env.local
~~~

.env.local:

~~~dotenv
OPENAI_API_KEY=DEIN_OPENAI_KEY
OPENAI_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
~~~

Echte Keys niemals in .env.example oder Quellcode eintragen.

~~~bash
npm run dev -- --webpack --port 3001
~~~

Öffne [http://localhost:3001](http://localhost:3001).

Die vollständige gemeinsame Installations-, Sicherheits- und Troubleshooting-Anleitung steht in der [Repository-README](../README.md). Maschinenlesbare Angaben stehen in [hackathon-projects.json](../hackathon-projects.json).

## Nutzerfluss

1. Öffentliche PDP-URL eingeben.
2. Produktbild, Marke, Produktname, Preis und Quell-URL prüfen.
3. Zielgruppe, Tonalität, Kernvorteile, Proof Points und Sprache korrigieren.
4. Das vollständige Growth Kit generieren.
5. Texte inline bearbeiten, kopieren oder einzelne Bereiche regenerieren.
6. Markdown und JSON exportieren.
7. Bildprompts einzeln oder als Auswahl mit gpt-image-2 visualisieren.
8. PNG-Dateien beziehungsweise ein ZIP mit Texten und Bildern herunterladen.

## Bildgenerierung

Bilder werden niemals automatisch erzeugt. Jeder Klick auf „Bild generieren“ löst einen separaten Modellaufruf und mögliche Kosten aus. Wenn erreichbar, lädt der Server das PDP-Produktbild und übergibt es als High-Fidelity-Referenz. Ist die Referenz nicht abrufbar, warnt die Oberfläche und verlangt eine bewusste reine Prompt-Generierung.

Die Ausgabequalität steht standardmäßig auf medium, um die Wartezeit im Hackathon zu reduzieren. Für maximale Geschwindigkeit kann OPENAI_IMAGE_QUALITY=low gesetzt werden; high liefert mehr Detail, dauert aber deutlich länger. Nach einer Änderung muss der Development-Server neu gestartet werden.

Bilddaten bleiben ausschließlich im Arbeitsspeicher der Browsersitzung. Sie überleben keinen Reload und sollten vorher heruntergeladen werden. Texte und Prompts bleiben versioniert unter growth-kit:v1 in localStorage.

## Konfiguration

| Variable | Pflicht | Standard | Zweck |
| --- | --- | --- | --- |
| OPENAI_API_KEY | ja | keiner | Serverseitige Analyse und Generierung |
| OPENAI_MODEL | nein | gpt-5.4-mini | Konfigurierbares Textmodell |
| OPENAI_IMAGE_MODEL | nein | gpt-image-2 | Konfigurierbares Bildmodell |
| OPENAI_IMAGE_QUALITY | nein | medium | low, medium oder high; steuert Geschwindigkeit und Detailgrad |

## Unterstützte PDPs

Am zuverlässigsten funktionieren öffentlich erreichbare, serverseitig gerenderte PDPs mit schema.org/Product, Open-Graph-Daten und einer öffentlichen Produktbild-URL. Die Extraktion priorisiert JSON-LD, Open Graph, Metadaten und relevanten sichtbaren Text.

Logins, CAPTCHAs und Bot-Schutz werden nicht umgangen. Inhaltsarme oder blockierte Seiten liefern einen verständlichen Fehler statt erfundener Produktdaten.

## Architektur

- src/app/api/analyze/route.ts: sichere PDP-Extraktion und Produktanalyse
- src/app/api/generate/route.ts: vollständiges Growth Kit
- src/app/api/regenerate/route.ts: einzelne Sektion regenerieren
- src/app/api/images/generate/route.ts: bewusste Bildgenerierung
- src/lib/safe-fetch.ts: SSRF-, Redirect-, Timeout- und Größenkontrollen
- src/lib/pdp-parser.ts: strukturierte PDP-Signale
- src/lib/schemas.ts: Zod-Verträge und Zeichenlimits
- src/app/globals.css: Hackathon-CI

## Befehle

~~~bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
~~~

Vor dem ersten E2E-Lauf:

~~~bash
npx playwright install chromium
~~~

## Grenzen und sicherer Betrieb

Private IPs, Loopback, lokale Hosts, gefährliche Redirects, zu große Antworten und ungeeignete Bildformate werden blockiert. OpenAI-Key, Roh-HTML und Bildreferenzdaten gelangen nicht in localStorage.

API-Routen akzeptieren keine fremden Browser-Origins, begrenzen Requestgrößen und Aufrufe und senden `Cache-Control: no-store`. Security-Header werden in `next.config.ts` gesetzt. `.htaccess` schützt sensible Dateien zusätzlich unter Apache; Vercel und der Next.js-Server werten sie nicht aus. `.vercelignore` und `.dockerignore` verhindern die Aufnahme lokaler Env-Dateien in Deployment-Kontexte.

Die Anwendung besitzt keine Accounts oder Datenbank. Das eingebaute Rate Limit gilt nur pro laufender Node.js-Instanz; ein öffentlicher Betrieb benötigt zusätzlich Authentifizierung, persistentes verteiltes Rate Limiting, Kostenlimits und ein Datenschutzkonzept.
