# WUNDERWERKstatt

Statische Website von Damaris Schürmann: https://wunderwerkstatt.nrw

## Veröffentlichung

GitHub Pages veröffentlicht automatisch den Branch `main`, Verzeichnis `/` (root).
Die Datei `CNAME` legt `wunderwerkstatt.nrw` als Hauptdomain fest.
`www.wunderwerkstatt.nrw` soll auf die Hauptdomain weiterleiten.

Domainregistrierung und autoritative DNS-Verwaltung bleiben bei INWX.
Das Website-Hosting erfolgt über GitHub Pages.

## Dateien

- `index.html`: Startseite
- `impressum.html`: Impressum
- `datenschutz.html`: Datenschutz
- `styles.css`: Gestaltung
- `assets/logo.jpg`: Original-Logo

## DNS-Sollwerte bei INWX

Hauptdomain A: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

Hauptdomain AAAA: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

`www` CNAME: `mat-ai-sch.github.io` (ohne Repository-Pfad).

Die iCloud-Einträge für E-Mail (MX, SPF, DKIM und Apple-Verifizierung) sind unabhängig vom Website-Hosting.

## Migration

Am 25.10.2026 mit vollständiger Git-Versionsgeschichte aus `ms-schuermann/wunderwerkstatt` auf GitLab importiert.
