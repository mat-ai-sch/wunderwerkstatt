(() => {
  const $ = id => document.getElementById(id);
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
  let authError = url.searchParams.get("error") || hash.get("error");
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
  let enabledProviders = {};
  let emailMode = "password";
  let recoveryUser = null;
  const setupApple = url.searchParams.get("verknuepfen") === "apple";
  let oauthReturn = !authError && url.searchParams.has("code");
  const socialProviders = [
    {id:"azure", name:"Microsoft", icon:"microsoft", scopes:"email", queryParams:{prompt:"select_account"}},
    {id:"facebook", name:"Facebook", icon:"facebook", scopes:"email,public_profile"},
    {id:"linkedin_oidc", name:"LinkedIn", icon:"linkedin", scopes:"openid profile email"},
  ];
  const providerNames = new Map([["custom:amazon", "Amazon"], ["google", "Google"], ["apple", "Apple"],
    ...socialProviders.map(p => [p.id,p.name])]);
  const pendingKey = "ww-konto-oauth-start";
  const sessionKey = "ww-konto-oauth-sitzung";
  const registrationKey = "ww-konto-registrierung";
  // Nur für die Rückmeldung nach dem Mailklick, auch wenn er einen neuen Tab öffnet.
  function isPendingRegistration(userId) {
    try { return Boolean(userId) && localStorage.getItem(registrationKey) === userId; }
    catch { return false; }
  }
  function forgetRegistration(userId) {
    try {
      if (isPendingRegistration(userId)) localStorage.removeItem(registrationKey);
    } catch { /* Der Status im Browser ist für die Anmeldung optional. */ }
  }

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

  function showProviderOptions() {
    const appleEnabled = enabledProviders.apple === true;
    const linked = session?.user.identities?.some(identity => identity.provider === "apple");
    const canLink = Boolean(profile && appleEnabled && setupApple && !linked);
    $("apple").hidden = !appleEnabled;
    $("apple-account").hidden = !canLink;
    $("apple-link").hidden = !canLink;
    $("apple-state").textContent = canLink ? "Wähle den Apple Account, mit dem du dieses Profil künftig öffnen möchtest." : "";
    let canAddProvider = false;
    for (const {id} of socialProviders) {
      const enabled = enabledProviders[id] === true;
      $(id).hidden = !enabled;
      const canAdd = enabled && id !== "facebook" && Boolean(profile && session) && !session.user.identities?.some(i => i.provider === id);
      $(id + "-link").hidden = !canAdd;
      canAddProvider ||= canAdd;
    }
    $("provider-linking").hidden = !canAddProvider;
  }

  async function loadProviderSettings() {
    try {
      const response = await fetch(config.supabaseUrl + "/auth/v1/settings", {
        headers:{apikey:config.supabasePublishableKey}, cache:"no-store", signal:AbortSignal.timeout(6000),
      });
      if (response.ok) enabledProviders = (await response.json()).external || {};
    } catch {
      // Die übrigen Anmeldewege funktionieren auch ohne diese Auskunft.
    }
    showProviderOptions();
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
    showProviderOptions();
    message("link-feedback", "");
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
      const err = new Error(response.status === 403 ? "Bitte bestätige deine E-Mail-Adresse und melde dich erneut an."
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
      if (authError) {
        message("status", "Der letzte Anmeldevorgang wurde nicht abgeschlossen.", "error");
      } else if (isPendingRegistration(session.user.id) && !recoveryUser) {
        message("status", "✓ Registrierung erfolgreich. Deine E-Mail-Adresse ist bestätigt und dein Kundenkonto ist bereit.", "success");
      } else if (!approved.saved && session.user.app_metadata?.provider === "email" && !recoveryUser) {
        message("status", "Deine E-Mail-Adresse ist bestätigt. Du kannst jetzt dein Profil ergänzen.");
      } else {
        message("status", "");
      }
      showProfile(!approved.saved);
      $("title").focus();
      openRecovery();
      void showSignInMethod();
      showProviderOptions();
      await showKeys(version);
    } catch (error) {
      if (version !== generation) return;
      clearProfile();
      message("status", error.message, "error");
    }
  }

  function createSocialButtons() {
    const methods = $("atelier-social-methods");
    const passkeyMethod = $("passkey-login").closest(".method");
    for (const {id,name,icon,scopes,queryParams} of socialProviders) {
      const method = document.createElement("div");
      method.className = "method";
      const button = document.createElement("button");
      button.type = "button"; button.id = id; button.className = "provider"; button.hidden = true;
      button.setAttribute("aria-label","Mit " + name + " anmelden");
      const img = document.createElement("img");
      img.src = "./icons/login/" + icon + ".svg?v=farbe-1"; img.alt = "";
      const label = document.createElement("label");
      label.htmlFor = id; label.textContent = name;
      if (id === "facebook") {
        label.textContent = "Facebook (Testzugang)";
        button.setAttribute("aria-label", "Mit Facebook anmelden – nur für von Meta freigegebene Testkonten");
      }
      button.append(img); method.append(button,label);
      if (methods) methods.append(method);
      else passkeyMethod.before(method);
      const link = document.createElement("button");
      link.type = "button"; link.className = "secondary"; link.id = id + "-link"; link.hidden = true;
      link.textContent = name + " verknüpfen";
      $("provider-link-buttons").append(link);
      const options = {provider:id, options:{scopes, redirectTo:"https://wunderwerkstatt.nrw/konto/", queryParams}};
      action(id, () => startProviderLogin(options));
      action(link.id, () => {
        if (!profile || !session || enabledProviders[id] !== true) throw new Error("Konto erforderlich");
        return supa.auth.linkIdentity(options);
      }, "link-feedback");
    }
  }

  createSocialButtons();
  supa.auth.onAuthStateChange((event, next) => {
    const sameUser = session && next && session.user.id === next.user.id;
    if (event === "SIGNED_OUT") forgetRegistration(session?.user.id);
    session = next;
    if (event === "PASSWORD_RECOVERY") recoveryUser = next?.user.id;
    if (!next) recoveryUser = null;
    if (sameUser) {
      openRecovery();
      showProviderOptions();
      setTimeout(showSignInMethod, 0);
      return;
    }
    const version = ++generation;
    clearProfile();
    $("logout").hidden = !session;
    $("login").hidden = !!session;
    $("guest-fallback").hidden = true;
    $("title").textContent = "Anmelden";
    $("passkey-login").hidden = !supportsPasskeys;
    if (!session) {
      const failedCode = event === "INITIAL_SESSION" && url.searchParams.has("code");
      const notice = authError ? "Der Anmelde- oder Bestätigungslink ist ungültig oder der Vorgang wurde abgebrochen."
        : failedCode ? "Der Link konnte hier nicht geöffnet werden. Öffne ihn im ursprünglichen Browser oder melde dich mit deinem Passwort an." : "";
      message("status", notice, notice ? "error" : "");
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
    $("login").dataset.mode = mode;
    const password = mode === "password";
    const register = mode === "register";
    const usesPassword = password || register;
    const pending = mode === "pending";
    $("email-login").hidden = pending;
    $("login-password-field").hidden = !usesPassword;
    $("login-password").disabled = !usesPassword;
    $("login-password").autocomplete = register ? "new-password" : "current-password";
    $("login-password").minLength = register ? 8 : 0;
    $("login-password").value = "";
    $("register-repeat-field").hidden = !register;
    $("register-repeat").disabled = !register;
    $("register-repeat").value = "";
    $("forgot").hidden = !password;
    $("without-password").hidden = $("email-register").hidden = Boolean(session) || !password;
    $("back-to-password").hidden = password;
    const titles = {password:"Anmelden", register:"Konto erstellen", pending:"E-Mail-Adresse bestätigen", link:"Mit E-Mail-Link fortfahren", reset:"Passwort zurücksetzen"};
    if (!session) $("title").textContent = titles[mode];
    $("email-submit").textContent = password ? "Anmelden" : register ? "Konto erstellen" : mode === "link" ? "Anmeldelink senden" : "Link zum Zurücksetzen senden";
    $("email-hint").textContent = register ? "Wähle ein Passwort mit mindestens acht Zeichen. Anschließend bestätigst du deine E-Mail-Adresse."
      : mode === "link" ? "Fordere einen Anmeldelink für dein bestehendes Kundenkonto an." : "";
    $("email-hint").hidden = !($("email-hint").textContent);
    message("email-feedback", "");
    if (focus) {
      document.querySelector(".site-menu").open = false;
      (pending ? $("title") : $("login-address")).focus();
    }
  }
  $("forgot").onclick = () => setEmailMode("reset", true);
  $("without-password").onclick = () => setEmailMode("link", true);
  $("email-register").onclick = () => setEmailMode("register", true);
  $("back-to-password").onclick = () => setEmailMode("password", true);

  $("email-login").addEventListener("submit", async event => {
    event.preventDefault();
    const mode = emailMode;
    const send = $("email-submit");
    const address = $("login-address");
    if (send.disabled || session || mode === "pending" || !$("email-login").reportValidity()) return;
    if (mode === "register" && $("login-password").value !== $("register-repeat").value) {
      message("email-feedback", "Die beiden Passwörter stimmen nicht überein.", "error");
      $("register-repeat").focus();
      return;
    }
    const version = generation;
    send.disabled = true;
    address.readOnly = true;
    authError = null;
    message("status", "");
    message("email-feedback", mode === "password" ? "Anmeldung wird geprüft …" : "Link wird angefordert …");
    try {
      const email = address.value.trim();
      const redirectTo = "https://wunderwerkstatt.nrw/konto/";
      let result;
      if (mode === "password") result = await supa.auth.signInWithPassword({ email, password: $("login-password").value });
      else if (mode === "register") result = await supa.auth.signUp({email, password: $("login-password").value, options:{emailRedirectTo:redirectTo}});
      else if (mode === "reset") result = await supa.auth.resetPasswordForEmail(email, {redirectTo});
      else result = await supa.auth.signInWithOtp({email, options: {shouldCreateUser: false, emailRedirectTo: redirectTo}});
      if (mode === "register" && !result.error && result.data.user?.id) {
        try { localStorage.setItem(registrationKey, result.data.user.id); } catch { /* Der Kontozugang funktioniert auch ohne diesen Hinweis. */ }
      }
      if (version !== generation || mode !== emailMode) return;
      if (result.error) throw result.error;
      if (mode === "register" && !result.data.session) {
        setEmailMode("pending", true);
        message("email-feedback", "Prüfe dein Postfach und gegebenenfalls den Spamordner. Öffne den Bestätigungslink auf diesem Gerät im selben Browser. Falls du schon ein Konto hast, kannst du dich direkt anmelden.");
      } else if (mode === "reset" || mode === "link") {
        const notice = mode === "reset" ? "Wenn ein Konto zu dieser Adresse besteht, erhältst du einen Link zum Zurücksetzen."
          : "Wenn ein Konto zu dieser Adresse besteht, erhältst du einen Anmeldelink.";
        $("login-password").value = "";
        message("email-feedback", notice + " Öffne den Link auf diesem Gerät im selben Browser.", "success");
      }
    } catch (error) {
      if (version !== generation || mode !== emailMode) return;
      message("email-feedback", error?.status === 429
        ? "Bitte warte einen Moment und versuche es erneut."
        : error?.code === "weak_password" ? "Bitte wähle ein stärkeres Passwort."
        : mode === "password" ? "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse, Passwort und E-Mail-Bestätigung."
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
  loadProviderSettings();
  action("passkey-login", () => supa.auth.signInWithPasskey());
  action("logout", () => supa.auth.signOut({scope:"local"}));
  action("register", async () => {
    const version = generation;
    const result = await supa.auth.registerPasskey();
    if (!result.error && version === generation) {
      message("passkey-feedback", "✓ Passkey angelegt. Bei deiner nächsten Anmeldung kannst du diesen Passkey verwenden.", "success");
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
      forgetRegistration(session.user.id);
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
