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
  const setupApple = url.searchParams.get("verknuepfen") === "apple";

  function showAppleOptions() {
    const linked = session?.user.identities?.some(identity => identity.provider === "apple");
    const canLink = Boolean(profile && appleEnabled && setupApple && !linked);
    $("apple").hidden = !appleEnabled;
    $("apple-account").hidden = !profile || !(linked || canLink);
    $("apple-link").hidden = !canLink;
    $("apple-state").textContent = linked ? "Dein Apple Account ist mit diesem Kundenkonto verknüpft."
      : canLink ? "Wähle den Apple Account, mit dem du dieses Profil künftig öffnen möchtest." : "";
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
    $("email-login").hidden = true;
    $("email-open").setAttribute("aria-expanded", "false");
    message("email-feedback", "");
    $("profile").hidden = true;
    $("details").replaceChildren();
    $("fields").replaceChildren();
    $("email").textContent = "";
    $("google-account").hidden = true;
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
      const googleLinked = session.user.identities?.some(identity => identity.provider === "google");
      $("google-account").hidden = !googleLinked;
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
    if (sameUser) { showAppleOptions(); return; }
    const version = ++generation;
    clearProfile();
    $("logout").hidden = !session;
    $("login").hidden = !!session;
    $("title").textContent = "Kundenkonto";
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
          : error.message || "Der Vorgang konnte nicht abgeschlossen werden.", "error");
      } finally {
        $(id).disabled = false;
      }
    });
  }
  $("email-open").addEventListener("click", () => {
    const form = $("email-login");
    form.hidden = !form.hidden;
    $("email-open").setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) $("login-address").focus();
  });

  $("email-login").addEventListener("submit", async event => {
    event.preventDefault();
    const send = $("send-link");
    const address = $("login-address");
    if (send.disabled || session || !address.reportValidity()) return;
    const version = generation;
    send.disabled = true;
    address.readOnly = true;
    message("email-feedback", "Anmeldelink wird angefordert …");
    try {
      const { error } = await supa.auth.signInWithOtp({
        email: address.value.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: "https://wunderwerkstatt.nrw/konto/" },
      });
      if (version !== generation) return;
      if (error && !["otp_disabled", "signup_disabled", "user_not_found"].includes(error.code)) throw error;
      message("email-feedback", "Wenn die Adresse zu einem bestehenden Konto gehört, erhältst du einen Anmeldelink. Öffne ihn auf diesem Gerät im selben Browser.", "success");
    } catch (error) {
      if (version !== generation) return;
      message("email-feedback", error?.status === 429
        ? "Bitte warte einen Moment, bevor du einen weiteren Link anforderst."
        : "Der Link konnte nicht angefordert werden. Bitte versuche es später erneut.", "error");
    } finally {
      send.disabled = false;
      address.readOnly = false;
    }
  });

  action("amazon", () => supa.auth.signInWithOAuth({provider:"custom:amazon",
    options:{scopes:"profile", redirectTo:"https://wunderwerkstatt.nrw/konto/"}}));
  const googleOAuth = {provider:"google", options:{
    scopes:"openid email profile", redirectTo:"https://wunderwerkstatt.nrw/konto/",
    queryParams:{prompt:"select_account"},
  }};
  action("google", () => supa.auth.signInWithOAuth(googleOAuth));
  const appleOAuth = {provider:"apple", options:{redirectTo:"https://wunderwerkstatt.nrw/konto/"}};
  action("apple", () => supa.auth.signInWithOAuth(appleOAuth));
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
