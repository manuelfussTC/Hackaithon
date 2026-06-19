# Sicherheit

## API-Keys

API-Keys sind Geheimnisse. Sie gehören ausschließlich in die lokale .env.local des jeweiligen Projekts. Alle .env-Varianten werden durch die Root- und Projekt-.gitignore ausgeschlossen; nur .env.example ist als Vertrag ohne echte Werte versioniert.

Wenn ein Key versehentlich veröffentlicht wurde:

1. Key beim Anbieter sofort widerrufen.
2. Neuen Key erzeugen und lokale .env.local aktualisieren.
3. Nutzung und Abrechnung auf unbekannte Zugriffe prüfen.
4. Den Fund im Repository und in der gesamten Git-Historie bereinigen.
5. Erst danach erneut veröffentlichen.

Ein Entfernen im neuesten Commit allein reicht nicht, weil der Key in älteren Commits erhalten bleibt.

## Betrieb

Die Templates sind für lokale Hackathon-Nutzung gedacht. Vor einem öffentlichen Deployment sind mindestens Authentifizierung, Rate Limiting, Kostenlimits, Monitoring und ein Datenschutz-Review erforderlich.

### Mehrschichtiger Schutz

- `.gitignore`, `.vercelignore` und `.dockerignore` schließen lokale Env-Dateien, Builds, Logs und Abhängigkeiten aus.
- Die `.htaccess` verweigert unter Apache den Zugriff auf Env-Dateien, Git-Metadaten, Quellcode, Source Maps, Schlüssel und Konfigurationsdateien und deaktiviert Directory Listings.
- `.htaccess` wirkt ausschließlich bei Apache mit erlaubtem `AllowOverride`; Next.js und Vercel ignorieren sie.
- `next.config.ts` setzt deshalb unabhängig vom Webserver CSP, Frame-, MIME-, Referrer-, Permissions- und Cross-Origin-Header. API-Antworten sind `no-store`.
- Jede API-Route blockiert fremde Browser-Origins, zu große Requests und übermäßige Aufrufe pro Minute.
- Das eingebaute Rate Limit ist pro Node.js-Instanz und reicht nur als lokale Basissicherung. Öffentlich betriebene Serverless-Deployments benötigen zusätzlich ein persistentes, vorgeschaltetes Rate Limit und Authentifizierung.

Auf Vercel müssen `OPENAI_API_KEY` und `TAVILY_API_KEY` im Dashboard als **Sensitive** für Production und Preview hinterlegt werden. Keine lokale `.env.local` hochladen.

## Daten

- Keine Roh-PDPs, Screenshots, Bilddaten oder Keys dauerhaft speichern.
- Keine echten Kundendaten als Testfixture committen.
- Keine Login-, CAPTCHA- oder Bot-Schutzmechanismen umgehen.
- Exporte vor dem Teilen auf vertrauliche Produkt- oder Wettbewerbsdaten prüfen.

## Meldung

Sicherheitsprobleme nicht als öffentliches Issue mit Schlüsseln, Logs oder Exploit-Daten veröffentlichen. Repository-Owner direkt und ohne Geheimnisse im Nachrichtentext kontaktieren.
