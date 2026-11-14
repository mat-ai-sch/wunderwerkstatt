# WUNDERWERKstatt Auth Setup

Die Frontend-Integration liegt in `auth.js` und `auth-config.js`.

## Aktivierung

1. Supabase-Projekt für WUNDERWERKstatt erstellen.
2. Site URL: `https://wunderwerkstatt.nrw/`
3. Redirect URL: `https://wunderwerkstatt.nrw/`
4. E-Mail/Passwort-Login aktivieren und E-Mail-Bestätigung aktiviert lassen.
5. Project URL und Publishable Key in `auth-config.js` eintragen.
6. Erst danach die tatsächlich eingerichteten OAuth-Anbieter in `auth-config.js` auf `true` setzen.

## Anbieter

- E-Mail/Passwort: funktioniert mit Supabase Auth ohne externen OAuth-Anbieter.
- Google: benötigt Google OAuth Client ID + Secret in Supabase.
- Microsoft: Supabase Provider `azure`; benötigt Microsoft Entra App Client ID + Secret und E-Mail-Scope.
- Apple: benötigt Apple Services ID / Sign in with Apple Konfiguration.

Provider-Schaltflächen werden im Frontend nur angezeigt, wenn der jeweilige Eintrag in `auth-config.js` auf `true` gesetzt ist.

## Kontodaten

Die folgenden persönlichen Angaben werden als Supabase Auth user metadata gespeichert:

- Vorname
- Nachname
- Adresse
- Postleitzahl
- Stadt
- Land optional
- Telefon optional
- Geburtsdatum optional

E-Mail ist die Login-Adresse und wird durch Supabase Auth verwaltet.

## Sicherheit

- Niemals einen Supabase `service_role` Key in Browser-Dateien oder GitHub Pages hinterlegen.
- Im Browser darf nur der Publishable/Anon-Key verwendet werden.
- Social Provider Secrets bleiben ausschließlich im Supabase-/Provider-Backend.
