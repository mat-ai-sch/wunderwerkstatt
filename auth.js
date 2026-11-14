(() => {
  const config = window.WW_AUTH_CONFIG || {};
  const trigger = document.querySelector("[data-auth-open]");

  const configured =
    typeof config.supabaseUrl === "string" &&
    /^https:\/\/.+\.supabase\.co\/?$/i.test(config.supabaseUrl.trim()) &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.trim().length > 20 &&
    window.supabase &&
    typeof window.supabase.createClient === "function";

  if (!trigger || !configured) {
    if (trigger) trigger.hidden = true;
    return;
  }

  trigger.hidden = false;

  const client = window.supabase.createClient(
    config.supabaseUrl.trim(),
    config.supabasePublishableKey.trim(),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  const providerConfig = config.providers || {};
  const providers = [
    { key: "google", provider: "google", label: "Mit Google fortfahren" },
    { key: "apple", provider: "apple", label: "Mit Apple fortfahren" },
    {
      key: "amazon",
      provider: "custom:amazon",
      label: "Mit Amazon fortfahren",
      scopes: "profile",
    },
    {
      key: "azure",
      provider: "azure",
      label: "Mit Microsoft fortfahren",
      scopes: "email",
    },
  ].filter((item) => providerConfig[item.key] === true);

  let dialog;
  let currentUser = null;
  let authMode = "signin";
  let recoveryMode = false;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const cleanAuthUrl = () => {
    const url = new URL(window.location.href);
    const authParams = [
      "access_token",
      "refresh_token",
      "expires_in",
      "expires_at",
      "provider_token",
      "provider_refresh_token",
      "token_type",
      "type",
      "code",
    ];

    let changed = false;
    for (const key of authParams) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (window.location.hash && /access_token|refresh_token|type=recovery/.test(window.location.hash)) {
      url.hash = "";
      changed = true;
    }

    if (changed) {
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  };

  const userInitials = (user) => {
    const meta = user?.user_metadata || {};
    const first = String(meta.first_name || "").trim();
    const last = String(meta.last_name || "").trim();

    if (first || last) {
      return ((first[0] || "") + (last[0] || "")).toUpperCase();
    }

    const email = String(user?.email || "").trim();
    return email ? email[0].toUpperCase() : "K";
  };

  const updateTrigger = () => {
    trigger.classList.toggle("is-authenticated", Boolean(currentUser));
    trigger.setAttribute(
      "aria-label",
      currentUser ? "Konto öffnen" : "Anmelden oder registrieren"
    );

    const badge = trigger.querySelector(".brand-home-account-badge");
    if (badge) {
      badge.textContent = currentUser ? userInitials(currentUser) : "";
      badge.hidden = !currentUser;
    }
  };

  const setStatus = (message = "", type = "") => {
    if (!dialog) return;
    const node = dialog.querySelector(".auth-status");
    if (!node) return;
    node.textContent = message;
    node.className = "auth-status" + (type ? " is-" + type : "");
  };

  const setBusy = (busy) => {
    if (!dialog) return;
    dialog
      .querySelectorAll("button, input, select")
      .forEach((element) => {
        if (element.classList.contains("auth-dialog-close")) return;
        element.disabled = busy;
      });
    dialog.classList.toggle("is-busy", busy);
  };

  const profileFields = (user) => {
    const meta = user?.user_metadata || {};
    return {
      first_name: meta.first_name || "",
      last_name: meta.last_name || "",
      street: meta.street || "",
      postal_code: meta.postal_code || "",
      city: meta.city || "",
      country: meta.country || "",
      phone: meta.phone || "",
      birthdate: meta.birthdate || "",
    };
  };

  const authFormMarkup = () => {
    const registering = authMode === "signup";
    const socialMarkup = providers.length
      ? `
        <div class="auth-divider"><span>oder</span></div>
        <div class="auth-social-list">
          ${providers
            .map(
              (item) => `
                <button
                  class="auth-social-button"
                  type="button"
                  data-auth-provider="${escapeHtml(item.key)}"
                >
                  <span class="auth-social-mark" aria-hidden="true">
                    ${item.key === "google"
                      ? "G"
                      : item.key === "apple"
                        ? "A"
                        : item.key === "amazon"
                          ? "a"
                          : item.key === "azure"
                            ? "M"
                            : "●"}
                  </span>
                  <span>${escapeHtml(item.label)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="auth-dialog-panel">
        <button class="auth-dialog-close" type="button" aria-label="Fenster schließen">×</button>

        <div class="auth-dialog-brand">
          <span class="auth-dialog-overline">Dein Konto</span>
          <h2>${registering ? "Registrieren" : "Anmelden"}</h2>
          <p>
            ${registering
              ? "Erstelle dein Konto mit deiner E-Mail-Adresse."
              : "Melde dich an, um auf dein Konto zuzugreifen."}
          </p>
        </div>

        <div class="auth-mode-switch" role="tablist" aria-label="Konto">
          <button
            type="button"
            role="tab"
            data-auth-mode="signin"
            aria-selected="${!registering}"
            class="${!registering ? "is-active" : ""}"
          >
            Anmelden
          </button>
          <button
            type="button"
            role="tab"
            data-auth-mode="signup"
            aria-selected="${registering}"
            class="${registering ? "is-active" : ""}"
          >
            Registrieren
          </button>
        </div>

        <form class="auth-form" data-auth-form>
          <label class="auth-field">
            <span>E-Mail-Adresse</span>
            <input
              type="email"
              name="email"
              autocomplete="email"
              inputmode="email"
              required
            />
          </label>

          <label class="auth-field">
            <span>Passwort</span>
            <input
              type="password"
              name="password"
              autocomplete="${registering ? "new-password" : "current-password"}"
              minlength="8"
              required
            />
          </label>

          ${registering
            ? `
              <label class="auth-field">
                <span>Passwort wiederholen</span>
                <input
                  type="password"
                  name="password_confirm"
                  autocomplete="new-password"
                  minlength="8"
                  required
                />
              </label>
              <p class="auth-password-hint">Mindestens 8 Zeichen.</p>
            `
            : `
              <button class="auth-text-button" type="button" data-auth-forgot>
                Passwort vergessen?
              </button>
            `}

          <button class="auth-primary-button" type="submit">
            ${registering ? "Konto erstellen" : "Anmelden"}
          </button>

          ${!registering ? `
            <button class="auth-secondary-button" type="button" data-auth-magic-link>
              Ohne Passwort per E-Mail-Link anmelden
            </button>
          ` : ""}
        </form>

        ${socialMarkup}

        <p class="auth-privacy">
          Mit der Anmeldung gelten unsere
          <a href="/datenschutz.html">Datenschutzhinweise</a>.
        </p>

        <p class="auth-status" role="status" aria-live="polite"></p>
      </div>
    `;
  };

  const accountMarkup = (user) => {
    const fields = profileFields(user);
    return `
      <div class="auth-dialog-panel auth-account-panel">
        <button class="auth-dialog-close" type="button" aria-label="Fenster schließen">×</button>

        <div class="auth-account-header">
          <div class="auth-account-avatar" aria-hidden="true">
            ${escapeHtml(userInitials(user))}
          </div>
          <div>
            <span class="auth-dialog-overline">Dein Konto</span>
            <h2>Meine Angaben</h2>
            <p>${escapeHtml(user.email || "")}</p>
          </div>
        </div>

        <form class="auth-profile-form" data-profile-form>
          <div class="auth-profile-grid">
            <label class="auth-field">
              <span>Vorname</span>
              <input name="first_name" autocomplete="given-name" value="${escapeHtml(fields.first_name)}" />
            </label>
            <label class="auth-field">
              <span>Nachname</span>
              <input name="last_name" autocomplete="family-name" value="${escapeHtml(fields.last_name)}" />
            </label>
          </div>

          <label class="auth-field">
            <span>Adresse</span>
            <input name="street" autocomplete="street-address" value="${escapeHtml(fields.street)}" />
          </label>

          <div class="auth-profile-grid auth-profile-grid-city">
            <label class="auth-field">
              <span>Postleitzahl</span>
              <input name="postal_code" autocomplete="postal-code" value="${escapeHtml(fields.postal_code)}" />
            </label>
            <label class="auth-field">
              <span>Stadt</span>
              <input name="city" autocomplete="address-level2" value="${escapeHtml(fields.city)}" />
            </label>
          </div>

          <label class="auth-field">
            <span>Land <small>optional</small></span>
            <input name="country" autocomplete="country-name" value="${escapeHtml(fields.country)}" />
          </label>

          <div class="auth-profile-grid">
            <label class="auth-field">
              <span>Telefon <small>optional</small></span>
              <input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(fields.phone)}" />
            </label>
            <label class="auth-field">
              <span>Geburtsdatum <small>optional</small></span>
              <input name="birthdate" type="date" value="${escapeHtml(fields.birthdate)}" />
            </label>
          </div>

          <button class="auth-primary-button" type="submit">Angaben speichern</button>
        </form>

        <div class="auth-account-actions">
          <button class="auth-text-button" type="button" data-auth-change-password>
            Passwort ändern
          </button>
          <button class="auth-text-button auth-signout" type="button" data-auth-signout>
            Abmelden
          </button>
        </div>

        <p class="auth-status" role="status" aria-live="polite"></p>
      </div>
    `;
  };

  const recoveryMarkup = () => `
    <div class="auth-dialog-panel">
      <button class="auth-dialog-close" type="button" aria-label="Fenster schließen">×</button>
      <div class="auth-dialog-brand">
        <span class="auth-dialog-overline">Dein Konto</span>
        <h2>Neues Passwort</h2>
        <p>Lege ein neues Passwort für dein Konto fest.</p>
      </div>

      <form class="auth-form" data-auth-recovery-form>
        <label class="auth-field">
          <span>Neues Passwort</span>
          <input type="password" name="password" minlength="8" autocomplete="new-password" required />
        </label>
        <label class="auth-field">
          <span>Passwort wiederholen</span>
          <input type="password" name="password_confirm" minlength="8" autocomplete="new-password" required />
        </label>
        <button class="auth-primary-button" type="submit">Passwort speichern</button>
      </form>

      <p class="auth-status" role="status" aria-live="polite"></p>
    </div>
  `;

  const buildDialog = () => {
    const node = document.createElement("dialog");
    node.className = "auth-dialog";
    node.setAttribute("aria-labelledby", "auth-dialog-title");
    document.body.append(node);
    return node;
  };

  const render = () => {
    if (!dialog) dialog = buildDialog();

    if (recoveryMode) {
      dialog.innerHTML = recoveryMarkup();
    } else if (currentUser) {
      dialog.innerHTML = accountMarkup(currentUser);
    } else {
      dialog.innerHTML = authFormMarkup();
    }

    const heading = dialog.querySelector("h2");
    if (heading) heading.id = "auth-dialog-title";

    bindDialogEvents();
  };

  const open = () => {
    render();
    if (!dialog.open) dialog.showModal();
  };

  const close = () => {
    if (dialog?.open) dialog.close();
  };

  const oauthSignIn = async (providerKey) => {
    const item = providers.find((entry) => entry.key === providerKey);
    if (!item) return;

    setBusy(true);
    setStatus("");

    try {
      const options = {
        redirectTo: window.location.origin + "/",
      };
      if (item.scopes) options.scopes = item.scopes;

      const { error } = await client.auth.signInWithOAuth({
        provider: item.provider,
        options,
      });
      if (error) throw error;
    } catch (error) {
      setBusy(false);
      setStatus(
        error?.message || "Die Anmeldung konnte nicht gestartet werden.",
        "error"
      );
    }
  };

  const bindDialogEvents = () => {
    const closeButton = dialog.querySelector(".auth-dialog-close");
    closeButton?.addEventListener("click", close);

    dialog.onclick = (event) => {
      if (event.target === dialog) close();
    };

    dialog.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode === "signup" ? "signup" : "signin";
        setStatus("");
        render();
      });
    });

    dialog.querySelectorAll("[data-auth-provider]").forEach((button) => {
      button.addEventListener("click", () =>
        oauthSignIn(button.dataset.authProvider)
      );
    });

    const authForm = dialog.querySelector("[data-auth-form]");
    authForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!authForm.reportValidity()) return;

      const formData = new FormData(authForm);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");

      if (authMode === "signup") {
        const confirm = String(formData.get("password_confirm") || "");
        if (password !== confirm) {
          setStatus("Die beiden Passwörter stimmen nicht überein.", "error");
          return;
        }
      }

      setBusy(true);
      setStatus("");

      try {
        if (authMode === "signup") {
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin + "/",
            },
          });
          if (error) throw error;

          if (data?.session) {
            currentUser = data.user;
            render();
            setStatus("Dein Konto wurde erstellt.", "success");
          } else {
            setBusy(false);
            setStatus(
              "Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte bestätige deine E-Mail-Adresse.",
              "success"
            );
          }
        } else {
          const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;

          currentUser = data.user;
          updateTrigger();
          render();
          setStatus("Du bist angemeldet.", "success");
        }
      } catch (error) {
        setBusy(false);
        setStatus(
          error?.message || "Anmeldung nicht möglich. Bitte prüfe deine Angaben.",
          "error"
        );
      }
    });

    dialog.querySelector("[data-auth-forgot]")?.addEventListener("click", async () => {
      const emailInput = dialog.querySelector('input[name="email"]');
      const email = String(emailInput?.value || "").trim().toLowerCase();

      if (!email || !emailInput.checkValidity()) {
        emailInput?.focus();
        setStatus("Bitte gib zuerst deine E-Mail-Adresse ein.", "error");
        return;
      }

      setBusy(true);
      setStatus("");

      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/",
        });
        if (error) throw error;
        setBusy(false);
        setStatus(
          "Wir haben dir einen Link zum Zurücksetzen des Passworts geschickt.",
          "success"
        );
      } catch (error) {
        setBusy(false);
        setStatus(
          error?.message || "Die E-Mail konnte nicht gesendet werden.",
          "error"
        );
      }
    });


    dialog.querySelector("[data-auth-magic-link]")?.addEventListener("click", async () => {
      const emailInput = dialog.querySelector('input[name="email"]');
      const email = String(emailInput?.value || "").trim().toLowerCase();

      if (!email || !emailInput.checkValidity()) {
        emailInput?.focus();
        setStatus("Bitte gib zuerst deine E-Mail-Adresse ein.", "error");
        return;
      }

      setBusy(true);
      setStatus("");

      try {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: window.location.origin + "/",
          },
        });
        if (error) throw error;

        setBusy(false);
        setStatus(
          "Wir haben dir einen Anmeldelink per E-Mail geschickt.",
          "success"
        );
      } catch (error) {
        setBusy(false);
        setStatus(
          error?.message || "Der Anmeldelink konnte nicht gesendet werden.",
          "error"
        );
      }
    });

    const profileForm = dialog.querySelector("[data-profile-form]");
    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      setBusy(true);
      setStatus("");

      const data = new FormData(profileForm);
      const metadata = {};
      for (const key of [
        "first_name",
        "last_name",
        "street",
        "postal_code",
        "city",
        "country",
        "phone",
        "birthdate",
      ]) {
        metadata[key] = String(data.get(key) || "").trim();
      }

      try {
        const { data: result, error } = await client.auth.updateUser({
          data: metadata,
        });
        if (error) throw error;

        currentUser = result.user;
        updateTrigger();
        setBusy(false);
        setStatus("Deine Angaben wurden gespeichert.", "success");
      } catch (error) {
        setBusy(false);
        setStatus(
          error?.message || "Die Angaben konnten nicht gespeichert werden.",
          "error"
        );
      }
    });

    dialog.querySelector("[data-auth-signout]")?.addEventListener("click", async () => {
      setBusy(true);
      setStatus("");

      const { error } = await client.auth.signOut();
      if (error) {
        setBusy(false);
        setStatus(error.message || "Abmelden nicht möglich.", "error");
        return;
      }

      currentUser = null;
      updateTrigger();
      close();
    });

    dialog
      .querySelector("[data-auth-change-password]")
      ?.addEventListener("click", async () => {
        const email = currentUser?.email;
        if (!email) return;

        setBusy(true);
        setStatus("");

        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/",
        });

        setBusy(false);
        if (error) {
          setStatus(error.message || "Die E-Mail konnte nicht gesendet werden.", "error");
          return;
        }

        setStatus(
          "Wir haben dir einen Link zum Ändern des Passworts geschickt.",
          "success"
        );
      });

    const recoveryForm = dialog.querySelector("[data-auth-recovery-form]");
    recoveryForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!recoveryForm.reportValidity()) return;

      const data = new FormData(recoveryForm);
      const password = String(data.get("password") || "");
      const confirm = String(data.get("password_confirm") || "");

      if (password !== confirm) {
        setStatus("Die beiden Passwörter stimmen nicht überein.", "error");
        return;
      }

      setBusy(true);
      setStatus("");

      try {
        const { data: result, error } = await client.auth.updateUser({
          password,
        });
        if (error) throw error;

        recoveryMode = false;
        currentUser = result.user;
        cleanAuthUrl();
        updateTrigger();
        render();
        setStatus("Dein Passwort wurde geändert.", "success");
      } catch (error) {
        setBusy(false);
        setStatus(
          error?.message || "Das Passwort konnte nicht geändert werden.",
          "error"
        );
      }
    });
  };

  trigger.addEventListener("click", open);

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryMode = true;
      currentUser = session?.user || currentUser;
      updateTrigger();
      open();
      return;
    }

    currentUser = session?.user || null;
    updateTrigger();

    if (dialog?.open && event !== "INITIAL_SESSION") {
      render();
    }

    if (event === "SIGNED_IN") {
      cleanAuthUrl();
    }
  });

  (async () => {
    const { data } = await client.auth.getSession();
    currentUser = data?.session?.user || null;
    updateTrigger();

    // Password recovery is opened through Supabase's PASSWORD_RECOVERY
    // auth event. No query parameter is required on the production URL.
  })();
})();
