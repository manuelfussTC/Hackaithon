# K5 Hackathon Starter Kits

Zwei eigenständige, funktionsfähige KI-Starter für den Team One × ACA Hackathon. Beide Anwendungen sind bewusst lokal, ohne Accounts und ohne Datenbank gebaut. Sie können einzeln gestartet, verändert und als Ausgangspunkt für einen Hackathon-Prototyp verwendet werden.

## Projekte

| Template | Zweck | Benötigte Dienste | Port |
| --- | --- | --- | --- |
| [pdp-growth-kit/](./pdp-growth-kit/) | Erzeugt aus einer Produktdetailseite ein Marketingpaket mit sieben Kanälen und optionalen Kampagnenbildern. | OpenAI | 3001 |
| [competitor-x-ray/](./competitor-x-ray/) | Vergleicht zwei Produktdetailseiten anhand sichtbarer Evidenz, Scores und Handlungsempfehlungen. | OpenAI; Tavily empfohlen | 3002 |

Die Templates haben getrennte Abhängigkeiten und Umgebungsvariablen. Man kann deshalb auch nur einen Projektordner verwenden.

## Schnellstart

### 1. Voraussetzungen

- Git
- Node.js 20.9 oder neuer
- npm, im Node.js-Download enthalten
- ein OpenAI API-Key
- optional ein Tavily API-Key für Competitor X-Ray

Installation prüfen:

~~~bash
node --version
npm --version
git --version
~~~

### 2. Repository klonen

~~~bash
git clone git@github.com:manuelfussTC/Hackaithon.git
cd Hackaithon
~~~

Alternativ funktioniert die HTTPS-URL aus der GitHub-Oberfläche.

### 3. Keys anlegen

OpenAI authentifiziert die serverseitigen Modellaufrufe mit einem geheimen API-Key. Tavily wird nur vom Competitor X-Ray für die robustere Extraktion dynamischer PDPs verwendet.

- [OpenAI API und Authentifizierung](https://platform.openai.com/docs/api-reference/authentication)
- [Tavily API-Key-Management](https://docs.tavily.com/documentation/best-practices/api-key-management)

**Keys niemals in Quellcode, Chatnachrichten, Screenshots oder Git-Commits einfügen.** In diesem Repository gehören sie ausschließlich in eine lokale Datei namens .env.local.

### 4. PDP Growth Kit starten

~~~bash
cd pdp-growth-kit
npm install
cp .env.example .env.local
~~~

Öffne .env.local und ersetze den OpenAI-Platzhalter:

~~~dotenv
OPENAI_API_KEY=DEIN_OPENAI_KEY
OPENAI_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
~~~

Dann starten:

~~~bash
npm run dev -- --webpack --port 3001
~~~

Öffne [http://localhost:3001](http://localhost:3001).

### 5. Competitor X-Ray starten

In einem zweiten Terminal:

~~~bash
cd competitor-x-ray
npm install
cp .env.example .env.local
~~~

Konfiguration:

~~~dotenv
OPENAI_API_KEY=DEIN_OPENAI_KEY
OPENAI_MODEL=gpt-5.4-mini
TAVILY_API_KEY=DEIN_TAVILY_KEY
~~~

TAVILY_API_KEY ist optional. Ohne Tavily arbeitet die lokale PDP-Extraktion weiter und weist eine niedrigere Confidence aus.

~~~bash
npm run dev -- --webpack --port 3002
~~~

Öffne [http://localhost:3002](http://localhost:3002).

## API-Kosten

API-Aufrufe sind nicht Teil dieses Repositories und können beim jeweiligen Anbieter Kosten verursachen:

- Textanalysen und Generierungen nutzen standardmäßig gpt-5.4-mini.
- Bilder werden ausschließlich nach einem bewussten Klick mit gpt-image-2 erzeugt.
- Die Bildqualität steht für kürzere Wartezeiten standardmäßig auf medium; low ist schneller, high langsamer und detailreicher.
- Mehrfachgenerierung erzeugt mehrere Bildaufrufe.
- Tavily Advanced Extract verbraucht Tavily-Credits.

Verwendet für den Hackathon möglichst eigene Projekt-Keys mit begrenztem Budget. Prüft Nutzung und Limits direkt beim Anbieter. Ein öffentliches Deployment ohne Authentifizierung und Rate Limiting ist nicht vorgesehen.

## Projektstruktur

~~~text
Hackaithon/
├── README.md
├── AGENTS.md
├── hackathon-projects.json
├── SECURITY.md
├── competitor-x-ray/
└── pdp-growth-kit/
~~~

Jedes Template enthält eine eigene README, eine sichere .env.example, eigene npm-Abhängigkeiten, Tests und serverseitige API-Routen. Es gibt keine Laufzeitabhängigkeit zwischen den Templates.

Coding-Assistenten lesen zuerst [AGENTS.md](./AGENTS.md). Automatisierungen können Ports, Variablen und Befehle aus [hackathon-projects.json](./hackathon-projects.json) beziehen.

## Qualität prüfen

Im jeweiligen Projektordner:

~~~bash
npm run lint
npm run typecheck
npm test
npm run build
~~~

Für Browser-Tests einmalig Chromium installieren:

~~~bash
npx playwright install chromium
npm run test:e2e
~~~

Die E2E-Konfiguration startet selbstständig einen Testserver. Ein bereits laufender Next.js-Development-Server desselben Projekts muss vorher beendet werden.

## Typische Probleme

### OPENAI_API_KEY fehlt

Die Datei muss exakt .env.local heißen und im gestarteten Projektordner liegen. Nach Änderungen den Development-Server neu starten.

### PDP kann nicht verarbeitet werden

Die URL muss öffentlich über HTTP oder HTTPS erreichbar sein. Logins, CAPTCHAs, private Netzwerke und Bot-Schutz werden nicht umgangen. JSON-LD, Open Graph und serverseitig ausgelieferte Produktdaten erhöhen die Erfolgsquote.

### Competitor X-Ray erkennt zu wenig

Tavily konfigurieren und erneut extrahieren. Bei stark clientseitig gerenderten Seiten können zusätzlich Desktop- und Mobile-Screenshots hochgeladen werden. Screenshots bleiben nur in der Browsersitzung.

### Bildgenerierung schlägt fehl

Modellzugriff, Guthaben und OPENAI_IMAGE_MODEL prüfen. Ist das PDP-Produktbild nicht serverseitig abrufbar, kann bewusst nur aus dem Textprompt generiert werden.

### Port ist bereits belegt

Einen anderen Port verwenden:

~~~bash
npm run dev -- --webpack --port 3010
~~~

## Sicherheit und Datenschutz

- .env-Dateien werden rekursiv ignoriert; nur .env.example darf versioniert werden.
- `.vercelignore` und `.dockerignore` verhindern zusätzlich, dass lokale Secrets, Builds oder Logs in Deployment-Kontexte gelangen.
- Eine Root- und je eine Projekt-`.htaccess` sperren unter Apache Env-, Git-, Quellcode-, Schlüssel- und Konfigurationsdateien. Next.js und Vercel verwenden stattdessen die eingebauten Security-Header.
- Alle API-Routen prüfen Browser-Origin und Requestgröße und besitzen ein lokales Rate Limit; API-Antworten werden nicht gecacht.
- OpenAI- und Tavily-Aufrufe erfolgen ausschließlich serverseitig.
- Roh-HTML, API-Keys und Produktbild-Referenzdaten werden nicht in localStorage geschrieben.
- Generierte Bilder und hochgeladene Screenshots sind nicht dauerhaft gespeichert.
- Private IPs, Loopback, lokale Hosts und gefährliche Redirects werden blockiert.
- Es gibt keine Accounts, Datenbank oder Telemetrie.

Vor jedem Push:

~~~bash
git status --short
git diff --cached
git grep -n -E '(sk-[A-Za-z0-9_-]{16,}|tvly-[A-Za-z0-9_-]{16,})' -- . ':!**/.env.example'
~~~

Weitere Regeln stehen in [SECURITY.md](./SECURITY.md).

## Technischer Überblick

Beide Projekte verwenden Next.js App Router, TypeScript, Zod, OpenAI Responses API, Vitest und Playwright. Das Hackathon-CI nutzt Schwarz, warmes Off-White, Neon-Grün, Archivo/Archivo Black und JetBrains Mono.

Die lokale Nutzung ist der vorgesehene Standard. Für ein öffentliches Deployment müssen mindestens Authentifizierung, Rate Limiting, serverseitige Kostenlimits, Monitoring und ein Datenschutzkonzept ergänzt werden.

Vercel-Nutzer legen echte API-Keys ausschließlich als **Sensitive Environment Variables** in den Projekt-Einstellungen an. Die `.htaccess` ist dort wirkungslos und kein Ersatz für die Next.js-Sicherheitskonfiguration.

## Lizenz und Credits

Siehe [LICENSE](./LICENSE). Entwickelt für den Team One × ACA Hackathon von [Manuel Fuß](https://manuel-fuss.de).
