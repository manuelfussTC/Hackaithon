# Competitor X-Ray

Competitor X-Ray stellt zwei konkrete Produktdetailseiten gegenüber. Die Anwendung extrahiert sichtbare Produkt- und Seitensignale, prüft die Vergleichbarkeit und erstellt eine evidenzbasierte Scorecard für Positionierung, Trust-Elemente, Produktdarstellung und Conversion-Hebel. Fünf priorisierte Empfehlungen zeigen konkrete nächste Schritte.

Die Scores bewerten ausschließlich das erkennbare Potenzial der vorliegenden Seiten. Sie behaupten keine tatsächliche Conversion-, Umsatz- oder Wettbewerbsperformance.

## Schnellstart

Voraussetzungen:

- Node.js 20.9 oder neuer
- npm
- OpenAI API-Key
- optional Tavily API-Key für robustere Extraktion

~~~bash
npm install
cp .env.example .env.local
~~~

.env.local:

~~~dotenv
OPENAI_API_KEY=DEIN_OPENAI_KEY
OPENAI_MODEL=gpt-5.4-mini
TAVILY_API_KEY=DEIN_TAVILY_KEY
~~~

TAVILY_API_KEY kann leer bleiben. Echte Keys niemals in .env.example oder Quellcode eintragen.

~~~bash
npm run dev -- --webpack --port 3002
~~~

Öffne [http://localhost:3002](http://localhost:3002).

Die vollständige gemeinsame Installations-, Sicherheits- und Troubleshooting-Anleitung steht in der [Repository-README](../README.md). Maschinenlesbare Angaben stehen in [hackathon-projects.json](../hackathon-projects.json).

## Nutzerfluss

1. Eigene PDP und Wettbewerber-PDP eingeben.
2. Beide URLs werden gegen SSRF, lokale Netze und gefährliche Redirects geprüft.
3. Lokale HTML-Extraktion und optional Tavily Advanced Extract laufen parallel.
4. Erkannte Profile, Preise, Bilder und Zielgruppen können korrigiert werden.
5. Optional können pro PDP je ein Desktop- und Mobile-Screenshot ergänzt werden.
6. Der Vergleich erzeugt vier Scorebereiche und fünf Empfehlungen.
7. Bereiche lassen sich einzeln editieren oder regenerieren.
8. Der Report kann als Markdown oder JSON exportiert werden.

## Evidenz und Confidence

Beobachtungen referenzieren strukturierte Daten, HTML-Signale, Tavily-Inhalte oder sichtbare Screenshot-Merkmale. Confidence sinkt, wenn Quellen blockiert sind, Tavily fehlt oder keine visuelle Evidenz vorliegt. Ein niedriger Vergleichbarkeits-Score warnt, blockiert den Flow aber nicht.

Tavily ist besonders bei JavaScript-lastigen PDPs hilfreich. Fällt Tavily aus, bleibt die lokale Extraktion nutzbar. Scheitern beide Quellen für eine Seite, stoppt die Anwendung mit einer konkreten Fehlermeldung statt Produktdaten zu erfinden.

## Screenshots

- maximal Desktop und Mobile je PDP
- PNG, JPEG oder WebP
- clientseitig auf ungefähr 1 MB komprimiert
- ausschließlich im Arbeitsspeicher der aktuellen Sitzung
- nicht in localStorage, Report oder Export enthalten

Nach einem Reload bleibt der Textreport erhalten; visuelle Regeneration benötigt erneute Uploads.

## Konfiguration

| Variable | Pflicht | Standard | Zweck |
| --- | --- | --- | --- |
| OPENAI_API_KEY | ja | keiner | Serverseitige Profil- und Reportgenerierung |
| OPENAI_MODEL | nein | gpt-5.4-mini | Konfigurierbares Textmodell |
| TAVILY_API_KEY | nein | keiner | Advanced Extract für dynamische PDPs |

## Architektur

- src/app/api/extract/route.ts: Zwei-URL-Extraktion und Fit-Vorprüfung
- src/app/api/compare/route.ts: Multipart-Vergleich mit optionalen Screenshots
- src/app/api/regenerate/route.ts: einzelne Reportsektion neu erzeugen
- src/lib/safe-fetch.ts: SSRF-, Redirect-, Timeout- und Größenkontrollen
- src/lib/pdp-parser.ts: strukturierte und sichtbare PDP-Signale
- src/lib/tavily.ts: optionaler Tavily-Batch
- src/lib/schemas.ts: Zod-Verträge
- src/app/globals.css: Hackathon-CI

Persistenter Browserzustand liegt unter competitor-xray:v1. Screenshot-Binärdaten werden nicht persistiert.

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

Logins, CAPTCHAs und Bot-Schutz werden nicht umgangen. Private IPs, Loopback, lokale Hosts, gefährliche Redirects, zu große Antworten und ungeeignete Dateitypen werden blockiert.

Die Anwendung besitzt keine Accounts, Datenbank oder eingebaute Rate Limits. Ein öffentlicher Betrieb benötigt Authentifizierung, Rate Limiting, Kostenlimits und ein Datenschutzkonzept.
