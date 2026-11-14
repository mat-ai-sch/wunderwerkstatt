# WUNDERWERKstatt Auth Setup

Die Website nutzt Supabase Auth im Projekt `lvereygccmzxdkdagwmu`.

## Produktivdaten

- Supabase URL: `https://lvereygccmzxdkdagwmu.supabase.co`
- Website: `https://wunderwerkstatt.nrw/`
- Supabase OAuth Callback URL:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`

Die Site URL und Redirect URL im Supabase-Dashboard sind auf
`https://wunderwerkstatt.nrw/` gesetzt.

## Bereits aktiv

- E-Mail + Passwort
- E-Mail-Bestätigung
- Passwort-Reset
- Passwortloser Login per E-Mail-Link
- persistente Supabase-Session

## Google

Supabase Provider: `google`

Benötigt im Google Cloud Projekt:

- OAuth 2.0 Client vom Typ **Web application**
- Authorized JavaScript origin:
  `https://wunderwerkstatt.nrw`
- Authorized redirect URI:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`

Danach Client ID und Client Secret in Supabase unter
**Authentication → Sign In / Providers → Google** eintragen und Google aktivieren.

Anschließend in `auth-config.js`:

```js
google: true
```

## Apple

Supabase Provider: `apple`

Benötigt im Apple Developer Account:

- App ID mit **Sign in with Apple**
- Services ID für die Web-Anmeldung
- Sign in with Apple Key
- Team ID
- Key ID
- daraus erzeugter Apple Client Secret JWT

Return URL:

`https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`

Website Domain:

`wunderwerkstatt.nrw`

Danach Services ID / Client ID und Client Secret in Supabase unter
**Authentication → Sign In / Providers → Apple** eintragen und Apple aktivieren.

Anschließend in `auth-config.js`:

```js
apple: true
```

## Amazon

Amazon ist kein eingebauter Supabase-Provider. Die Integration ist als
Supabase **Custom OAuth 2.0 Provider** vorbereitet.

Provider Identifier:

`custom:amazon`

Login-with-Amazon Security Profile benötigt:

- Client ID
- Client Secret
- Allowed Return URL:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`
- Privacy Notice URL:
  `https://wunderwerkstatt.nrw/datenschutz.html`

Custom OAuth Provider in Supabase:

- Name: `Amazon`
- Identifier: `custom:amazon`
- Provider type: `OAuth2`
- Authorization URL: `https://www.amazon.com/ap/oa`
- Token URL: `https://api.amazon.com/auth/o2/token`
- Userinfo URL: `https://api.amazon.com/user/profile`
- Scope: `profile`

Danach in `auth-config.js`:

```js
amazon: true
```

## Sicherheit

- Niemals einen Supabase `service_role` oder Secret Key in GitHub Pages,
  `auth-config.js` oder anderem Browser-Code hinterlegen.
- Im Browser wird ausschließlich der Supabase Publishable Key verwendet.
- Google-, Apple- und Amazon-Client-Secrets gehören ausschließlich in die
  jeweiligen Provider-/Supabase-Backend-Einstellungen.
- Social-Login-Schaltflächen und Passkeys werden über die Supabase Edge Function
  `auth-capabilities` automatisch erkannt. Nach der Provider-Aktivierung in
  Supabase ist keine weitere Änderung in `auth-config.js` erforderlich.


## Passkeys (optional)

Die Website ist für Supabase Passkeys vorbereitet. Die Client-Integration nutzt
`@supabase/supabase-js@2.105.0` mit explizitem Passkey-Opt-in.

Im Supabase-Dashboard unter **Authentication → Passkeys** aktivieren:

- Enable Passkey authentication: **On**
- Relying Party Display Name: `WUNDERWERKstatt`
- Relying Party ID: `wunderwerkstatt.nrw`
- Relying Party Origins: `https://wunderwerkstatt.nrw`

Wichtig: Die RP ID nach dem produktiven Start nicht ändern. Bereits registrierte
Passkeys sind kryptografisch an diese Domain gebunden.

Nach Aktivierung erkennt die Website den Supabase-Status automatisch:

- Nicht angemeldet: **Mit Passkey anmelden**
- Angemeldet: Abschnitt **Passkeys** mit
  - Passkey hinzufügen
  - vorhandene Passkeys anzeigen
  - Passkey entfernen

Passkeys bleiben optional. E-Mail/Passwort und E-Mail-Link funktionieren
unabhängig davon weiter.
