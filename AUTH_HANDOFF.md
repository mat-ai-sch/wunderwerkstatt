# Auth-Handoff WUNDERWERKstatt

Stand: 14.11.2026

## Bereits technisch fertig

- Supabase-Projekt: `lvereygccmzxdkdagwmu`
- Supabase URL: `https://lvereygccmzxdkdagwmu.supabase.co`
- Website: `https://wunderwerkstatt.nrw/`
- OAuth Callback:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`
- E-Mail + Passwort
- E-Mail-Bestätigung
- Passwort-Reset
- Passwortloser Login per E-Mail-Link
- persistente Session
- Kundenkonto / Profildaten
- Google-Login Frontend
- Apple-Login Frontend
- Amazon-Login Frontend über `custom:amazon`
- Passkey-Anmeldung, Registrierung, Liste und Entfernen
- automatische Provider-Erkennung über Supabase Edge Function
  `auth-capabilities`

Die Website zeigt Social Login und Passkey automatisch erst dann an, wenn der
jeweilige Provider in Supabase wirklich aktiviert ist. Nach der Aktivierung ist
kein weiterer GitHub-Schalter notwendig.

## Supabase

Provider:
https://supabase.com/dashboard/project/lvereygccmzxdkdagwmu/auth/providers

Passkeys:
https://supabase.com/dashboard/project/lvereygccmzxdkdagwmu/auth/passkeys

URL Configuration:
https://supabase.com/dashboard/project/lvereygccmzxdkdagwmu/auth/url-configuration

## Google

Google Auth Platform:
https://console.cloud.google.com/auth/overview

Branding:
https://console.cloud.google.com/auth/branding

Audience:
https://console.cloud.google.com/auth/audience

Data Access:
https://console.cloud.google.com/auth/scopes

OAuth Clients:
https://console.cloud.google.com/auth/clients

Zu verwenden:

- Application type: Web application
- Authorized JavaScript origin:
  `https://wunderwerkstatt.nrw`
- Authorized redirect URI:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`
- Scopes:
  - `openid`
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`

Danach Client ID und Client Secret in Supabase → Auth Providers → Google
eintragen und aktivieren.

## Apple

Apple Developer Account:
https://developer.apple.com/account/

Identifiers:
https://developer.apple.com/account/resources/identifiers/list

Keys:
https://developer.apple.com/account/resources/authkeys/list

Anleitung Web-Konfiguration:
https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/

Supabase Apple-Doku:
https://supabase.com/docs/guides/auth/social-sign-in/auth-apple

Benötigt:

- Primary App ID mit Sign in with Apple
- Services ID
- Team ID
- Sign in with Apple Key (.p8)
- Key ID
- Apple Client Secret JWT

Für die Services ID:

- Domain:
  `lvereygccmzxdkdagwmu.supabase.co`
- Return URL:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`

Danach Services ID als Client ID und Apple Client Secret in
Supabase → Auth Providers → Apple eintragen und aktivieren.

Hinweis: Apple verlangt für den Web-OAuth-Flow eine regelmäßige Erneuerung des
Client Secrets. Die .p8-Datei sicher aufbewahren und nicht in GitHub speichern.

## Amazon

Login with Amazon Console:
https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html

Dokumentation:
https://developer.amazon.com/docs/login-with-amazon/web-docs.html

Security Profile:
https://developer.amazon.com/docs/login-with-amazon/security-profile.html

Authorization Code Grant:
https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html

Security Profile erstellen bzw. aktivieren und Web Settings konfigurieren.

- Privacy Notice:
  `https://wunderwerkstatt.nrw/datenschutz.html`
- Allowed Return URL:
  `https://lvereygccmzxdkdagwmu.supabase.co/auth/v1/callback`

Aus Amazon übernehmen:

- Client ID
- Client Secret

Danach in Supabase → Auth Providers → New Provider → Manual configuration:

- Name: `Amazon`
- Identifier: `custom:amazon`
- Type: OAuth2
- Client ID: aus Amazon
- Client Secret: aus Amazon
- Authorization URL: `https://www.amazon.com/ap/oa`
- Token URL: `https://api.amazon.com/auth/o2/token`
- UserInfo URL: `https://api.amazon.com/user/profile`
- Scope: `profile`

Dann **Create and enable provider**.

## Passkeys

Supabase:
https://supabase.com/dashboard/project/lvereygccmzxdkdagwmu/auth/passkeys

Eintragen:

- Enable Passkey authentication: On
- Relying Party Display Name: `WUNDERWERKstatt`
- Relying Party ID: `wunderwerkstatt.nrw`
- Relying Party Origins: `https://wunderwerkstatt.nrw`

Die RP ID danach nicht ändern. Bereits registrierte Passkeys sind
kryptografisch daran gebunden.

## Geheimnisse

Nicht in GitHub, Chat oder Browser-Code speichern:

- Google Client Secret
- Apple .p8 Key
- Apple Client Secret
- Amazon Client Secret
- Supabase service_role / secret key

Nur der Supabase Publishable Key gehört in die öffentliche Website.
