(() => {
  const $ = id => document.getElementById(id);
  const menu = document.querySelector(".site-menu");
  document.addEventListener("pointerdown", event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) {
      event.preventDefault();
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
  const message = (id, text, kind = "") => {
    $(id).textContent = text;
    $(id).className = kind;
  };
  const config = window.WW_AUTH_CONFIG;
  if (!window.supabase || !config?.supabasePublishableKey) {
    message("status", "Die Anmeldung konnte nicht geladen werden. Bitte lade die Seite erneut.", "error");
    return;
  }
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const authError = url.searchParams.get("error") || hash.get("error");
  const supa = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { flowType: "pkce", storageKey: "wunderwerkstatt-kontotest", experimental: { passkey: true } },
  });
  const supportsPasskeys = location.origin === "https://wunderwerkstatt.nrw" &&
    window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;
  const fields = [
    ["first_name","Vorname","text","given-name"], ["last_name","Nachname","text","family-name"],
    ["street","Adresse","text","street-address"], ["postal_code","Postleitzahl","text","postal-code"],
    ["city","Stadt","text","address-level2"], ["country","Land","text","country-name"],
    ["phone","Telefon","tel","tel"], ["birthdate","Geburtsdatum","date","bday"],
  ];
  let session;
  let profile;
  let generation = 0;
  let appleEnabled = false;
  let emailMode = "password";
  let recoveryUser = null;
  const setupApple = url.searchParams.get("verknuepfen") === "apple";
  let oauthReturn = !authError && url.searchParams.has("code");
  const providerNames = new Map([["custom:amazon", "Amazon"], ["google", "Google"], ["apple", "Apple"]]);
  const pendingKey = "ww-konto-oauth-start";
  const sessionKey = "ww-konto-oauth-sitzung";

  async function startProviderLogin(options) {
    // Der Hinweis gilt erst nach einer erfolgreichen OAuth-Rückkehr in diesem Tab.
    try { sessionStorage.setItem(pendingKey, JSON.stringify({provider:options.provider, time:Date.now()})); } catch {}
    return supa.auth.signInWithOAuth(options);
  }

  function oauthName(claim, sessionId, identities) {
    if (providerNames.has(claim.provider)) return providerNames.get(claim.provider);
    if (!sessionId) return null;
    try {
      if (oauthReturn) {
        oauthReturn = false;
        const pending = JSON.parse(sessionStorage.getItem(pendingKey));
        sessionStorage.removeItem(pendingKey);
        if (pending && providerNames.has(pending.provider) && identities.includes(pending.provider) &&
            claim.timestamp >= Math.floor(pending.time / 1000) && Date.now() - pending.time < 60 * 60 * 1000) {
          localStorage.setItem(sessionKey, JSON.stringify({sessionId, provider:pending.provider}));
          return providerNames.get(pending.provider);
        }
      }
      const cached = JSON.parse(localStorage.getItem(sessionKey));
      if (cached?.sessionId === sessionId) return providerNames.get(cached.provider);
    } catch { /* Ohne Browserspeicher bleibt der Anmeldehinweis allgemein. */ }
    return null;
  }

  async function showSignInMethod() {
    if (!profile || !session) return;
    const current = session;
    const identities = (current.user.identities || []).map(identity => identity.provider);
    const names = [...providerNames].filter(([provider]) => identities.includes(provider)).map(([,name]) => name);
    $("linked-names").textContent = names.join(", ");
    $("linked-accounts").hidden = !names.length;
    $("session-login").textContent = "Du bist angemeldet.";
    try {
      const {data, error} = await supa.auth.getClaims(current.access_token);
      if (error || session !== current || !profile) return;
      const claims = data?.claims;
      const labels = {magiclink:"Per E-Mail-Link angemeldet.", passkey:"Mit Passkey angemeldet.",
        password:"Mit Passwort angemeldet.", otp:"Mit Einmalcode angemeldet."};
      const entry = claims?.amr?.find(item => item.method === "oauth" || Object.hasOwn(labels, item.method));
      if (!entry) return;
      if (entry.method === "oauth") {
        const name = oauthName(entry, claims.session_id, identities);
        $("session-login").textContent = name ? "Mit " + name + " angemeldet." : "Über einen Anmeldedienst angemeldet.";
      } else {
        oauthReturn = false;
        $("session-login").textContent = labels[entry.method];
      }
    } catch { /* Das Profil bleibt auch ohne Methodenangabe benutzbar. */ }
  }

  function showAppleOptions() {
    const linked = session?.user.identities?.some(identity => identity.provider === "apple");
    const canLink = Boolean(profile && appleEnabled && setupApple && !linked);
    $("apple").hidden = !appleEnabled;
    $("apple-account").hidden = !canLink;
    $("apple-link").hidden = !canLink;
    $("apple-state").textContent = canLink ? "Wähle den Apple Account, mit dem du dieses Profil künftig öffnen möchtest." : "";
  }

  async function loadAppleSetting() {
    try {
      const response = await fetch(config.supabaseUrl + "/auth/v1/settings", {
        headers:{apikey:config.supabasePublishableKey}, cache:"no-store", signal:AbortSignal.timeout(6000),
      });
      if (response.ok) appleEnabled = (await response.json()).external?.apple === true;
    } catch {
      // Die übrigen Anmeldewege funktionieren auch ohne diese Auskunft.
    }
    showAppleOptions();
  }

  function clearProfile() {
    profile = null;
    $("email-login").reset();
    setEmailMode("password");
    $("new-password-form").reset();
    $("password-settings").open = false;
    message("password-feedback", "");
    $("profile").hidden = true;
    $("details").replaceChildren();
    $("fields").replaceChildren();
    $("email").textContent = "";
    $("session-login").textContent = "";
    $("linked-names").textContent = "";
    $("linked-accounts").hidden = true;
    showAppleOptions();
    $("passkey-state").textContent = "";
    message("passkey-feedback", "");
  }

  async function profileRequest(method, body) {
    const response = await fetch(config.supabaseUrl + "/functions/v1/kontotest-profil", {
      method, cache:"no-store",
      headers: { Authorization:"Bearer " + session.access_token, apikey:config.supabasePublishableKey,
        ...(body ? {"Content-Type":"application/json"} : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = new Error(response.status === 403 ? "Dieses Konto ist für den Test nicht freigegeben."
        : response.status === 401 ? "Bitte melde dich erneut an."
        : "Deine Angaben konnten nicht verarbeitet werden. Bitte versuche es erneut.");
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  function showProfile(editing) {
    $("profile").hidden = false;
    $("title").textContent = editing ? "Meine Angaben" : "Mein Profil";
    $("email").textContent = profile.email || "";
    $("details").hidden = $("edit").hidden = editing;
    $("form").hidden = !editing;
    $("details").replaceChildren();
    $("fields").replaceChildren();
    for (const [key, label, type, autocomplete] of fields) {
      const value = profile.fields[key] || "";
      if (editing) {
        const row = document.createElement("label"), input = document.createElement("input");
        row.textContent = label;
        input.name = key; input.type = type; input.autocomplete = autocomplete;
        input.maxLength = 500; input.value = value;
        row.append(input); $("fields").append(row);
      } else {
        const row = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? value.split("-").reverse().join(".") : value || "Nicht angegeben";
        row.append(dt, dd); $("details").append(row);
      }
    }
  }

  async function showKeys(version) {
    if (!supportsPasskeys) {
      $("register").hidden = true;
      $("passkey-state").textContent = "Öffne diese Seite in einem Browser mit Passkey-Unterstützung.";
      return;
    }
    const { data, error } = await supa.auth.passkey.list();
    if (version !== generation || !profile) return;
    $("passkey-state").textContent = error ? "Die Passkey-Liste konnte nicht geladen werden."
      : data?.length ? (data.length === 1 ? "Ein Passkey ist hinterlegt." : data.length + " Passkeys sind hinterlegt.")
      : "Noch kein Passkey hinterlegt.";
  }

  async function authorize(version) {
    try {
      const approved = await profileRequest("GET");
      if (version !== generation) return;
      profile = approved;
      message("status", authError ? "Der letzte Anmeldevorgang wurde nicht abgeschlossen." : "",
        authError ? "error" : "");
      showProfile(!approved.saved);
      $("title").focus();
      openRecovery();
      void showSignInMethod();
      showAppleOptions();
      await showKeys(version);
    } catch (error) {
      if (version !== generation) return;
      clearProfile();
      message("status", error.message, "error");
    }
  }

  supa.auth.onAuthStateChange((event, next) => {
    const sameUser = session && next && session.user.id === next.user.id;
    session = next;
    if (event === "PASSWORD_RECOVERY") recoveryUser = next?.user.id;
    if (!next) recoveryUser = null;
    if (sameUser) {
      openRecovery();
      showAppleOptions();
      setTimeout(showSignInMethod, 0);
      return;
    }
    const version = ++generation;
    clearProfile();
    $("logout").hidden = !session;
    $("login").hidden = !!session;
    $("guest-fallback").hidden = true;
    $("title").textContent = session ? "Kundenkonto" : "Anmelden";
    $("passkey-login").hidden = !supportsPasskeys;
    if (!session) {
      message("status", authError ? "Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut." : "", authError ? "error" : "");
    } else {
      message("status", "Zugang wird geprüft …");
      // Weitere Auth-Aufrufe erst nach Abschluss des SDK-Ereignisses ausführen.
      setTimeout(() => { if (version === generation) authorize(version); }, 0);
    }
    if (location.search || location.hash) history.replaceState(null, "", location.pathname);
  });

  function action(id, run, feedback = "status") {
    $(id).addEventListener("click", async () => {
      const version = generation;
      $(id).disabled = true;
      message(feedback, "");
      try {
        const { error } = await run();
        if (error) throw error;
      } catch (error) {
        if (version === generation) message(feedback,
          error.name === "NotAllowedError" ? "Die Gerätebestätigung wurde abgebrochen oder ist abgelaufen."
          : "Der Vorgang konnte nicht abgeschlossen werden. Bitte versuche es erneut.", "error");
      } finally {
        $(id).disabled = false;
      }
    });
  }
  function openRecovery() {
    if (!profile || !recoveryUser || session?.user.id !== recoveryUser) return;
    recoveryUser = null;
    $("password-settings").open = true;
    $("new-password").focus();
  }

  function setEmailMode(mode, focus = false) {
    emailMode = mode;
    const password = mode === "password";
    $("login-password-field").hidden = !password;
    $("login-password").disabled = !password;
    $("login-password").value = "";
    $("forgot").hidden = $("without-password").hidden = !password;
    $("back-to-password").hidden = password;
    if (!session) $("title").textContent = password ? "Anmelden" : mode === "link" ? "Mit E-Mail-Link anmelden" : "Passwort zurücksetzen";
    $("email-submit").textContent = password ? "Mit E-Mail anmelden" : mode === "link" ? "Anmeldelink senden" : "Link zum Zurücksetzen senden";
    message("email-feedback", "");
    if (focus) $("login-address").focus();
  }
  $("forgot").onclick = () => setEmailMode("reset", true);
  $("without-password").onclick = () => setEmailMode("link", true);
  $("back-to-password").onclick = () => setEmailMode("password", true);

  $("email-login").addEventListener("submit", async event => {
    event.preventDefault();
    const mode = emailMode;
    const send = $("email-submit");
    const address = $("login-address");
    if (send.disabled || session || !address.reportValidity()) return;
    const version = generation;
    send.disabled = true;
    address.readOnly = true;
    message("email-feedback", mode === "password" ? "Anmeldung wird geprüft …" : "Link wird angefordert …");
    try {
      const email = address.value.trim();
      const redirectTo = "https://wunderwerkstatt.nrw/konto/";
      let result;
      if (mode === "password") result = await supa.auth.signInWithPassword({ email, password: $("login-password").value });
      else if (mode === "reset") result = await supa.auth.resetPasswordForEmail(email, {redirectTo});
      else result = await supa.auth.signInWithOtp({email, options: {shouldCreateUser: false, emailRedirectTo: redirectTo}});
      if (version !== generation || mode !== emailMode) return;
      if (result.error && (mode === "password" || !["signup_disabled", "user_not_found"].includes(result.error.code))) throw result.error;
      if (mode !== "password") message("email-feedback", "Wenn die Adresse zu einem bestehenden Konto gehört, erhältst du einen Link. Öffne ihn auf diesem Gerät im selben Browser.", "success");
    } catch (error) {
      if (version !== generation || mode !== emailMode) return;
      message("email-feedback", error?.status === 429
        ? "Bitte warte einen Moment und versuche es erneut."
        : mode === "password" ? "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort."
        : "Der Link konnte nicht angefordert werden. Bitte versuche es später erneut.", "error");
    } finally {
      send.disabled = false;
      address.readOnly = false;
    }
  });

  $("new-password-form").onsubmit = async event => {
    event.preventDefault();
    if (!profile || $("save-password").disabled) return;
    const password = $("new-password").value;
    if (password !== $("repeat-password").value) {
      message("password-feedback", "Die beiden Passwörter stimmen nicht überein.", "error");
      $("repeat-password").focus();
      return;
    }
    const version = generation;
    $("save-password").disabled = true;
    try {
      const {error} = await supa.auth.updateUser({password});
      if (error) throw error;
      if (version !== generation) return;
      $("new-password-form").reset();
      message("password-feedback", "Dein Passwort wurde gespeichert.", "success");
    } catch {
      if (version === generation) message("password-feedback", "Das Passwort konnte nicht gespeichert werden. Fordere bei Bedarf einen neuen Link an.", "error");
    } finally { $("save-password").disabled = false; }
  };

  action("amazon", () => startProviderLogin({provider:"custom:amazon",
    options:{scopes:"profile", redirectTo:"https://wunderwerkstatt.nrw/konto/"}}));
  const googleOAuth = {provider:"google", options:{
    scopes:"openid email profile", redirectTo:"https://wunderwerkstatt.nrw/konto/",
    queryParams:{prompt:"select_account"},
  }};
  action("google", () => startProviderLogin(googleOAuth));
  const appleOAuth = {provider:"apple", options:{redirectTo:"https://wunderwerkstatt.nrw/konto/"}};
  action("apple", () => startProviderLogin(appleOAuth));
  action("apple-link", () => supa.auth.linkIdentity(appleOAuth), "apple-state");
  loadAppleSetting();
  action("passkey-login", () => supa.auth.signInWithPasskey());
  action("logout", () => supa.auth.signOut({scope:"local"}));
  action("register", async () => {
    const version = generation;
    const result = await supa.auth.registerPasskey();
    if (!result.error && version === generation) {
      message("passkey-feedback", "✓ Passkey angelegt. Zum Testen abmelden und „Mit Passkey anmelden“ wählen.", "success");
      await showKeys(version);
    }
    return result;
  }, "passkey-feedback");
  $("edit").onclick = () => { message("status",""); showProfile(true); $("fields").querySelector("input").focus(); };
  $("cancel").onclick = () => { showProfile(false); $("edit").focus(); };
  $("form").onsubmit = async event => {
    event.preventDefault();
    const version = generation, first = !profile.saved;
    const body = Object.fromEntries(new FormData($("form")));
    const inputs = Array.from($("form").querySelectorAll("input,button"));
    inputs.forEach(el=>el.disabled=true);
    try {
      const result = await profileRequest("PATCH", body);
      if (version !== generation) return;
      profile = result;
      showProfile(false);
      message("status", first ? "✓ Profil erfolgreich angelegt." : "✓ Änderungen gespeichert.", "success");
      $("title").focus();
    } catch (error) {
      if (version !== generation) return;
      if ([401,403].includes(error.status)) clearProfile();
      message("status",error.message,"error");
    } finally { inputs.forEach(el=>el.disabled=false); }
  };
})();
