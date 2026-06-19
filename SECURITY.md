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

## Daten

- Keine Roh-PDPs, Screenshots, Bilddaten oder Keys dauerhaft speichern.
- Keine echten Kundendaten als Testfixture committen.
- Keine Login-, CAPTCHA- oder Bot-Schutzmechanismen umgehen.
- Exporte vor dem Teilen auf vertrauliche Produkt- oder Wettbewerbsdaten prüfen.

## Meldung

Sicherheitsprobleme nicht als öffentliches Issue mit Schlüsseln, Logs oder Exploit-Daten veröffentlichen. Repository-Owner direkt und ohne Geheimnisse im Nachrichtentext kontaktieren.
