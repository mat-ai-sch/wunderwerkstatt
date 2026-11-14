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
- Social-Login-Schaltflächen werden nur angezeigt, wenn ihr Provider in
  `auth-config.js` ausdrücklich aktiviert wurde.
