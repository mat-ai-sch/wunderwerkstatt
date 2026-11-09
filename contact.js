(() => {
  const CONTACT_EMAIL = "info@wunderwerkstatt.nrw";
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

  const buildDialog = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "contact-dialog";
    dialog.setAttribute("aria-labelledby", "contact-dialog-title");

    dialog.innerHTML = `
      <div class="contact-dialog-panel">
        <button
          class="contact-dialog-close"
          type="button"
          aria-label="Kontaktfenster schließen"
        >
          ×
        </button>

        <h2 class="contact-eyebrow" id="contact-dialog-title">
          Kontakt
        </h2>
        <p class="contact-intro">
          Dein Feedback oder etwas, das du uns mitteilen möchtest? Schreib uns.
        </p>

        <p class="contact-note">
          Deine Nachricht wird direkt über dieses Kontaktformular an uns gesendet.
        </p>

        <form class="contact-form">
          <label class="form-field">
            <span>Worum geht es?</span>
            <select name="reason" required>
              <option value="Feedback">Feedback</option>
              <option value="Kontaktanfrage">Kontaktanfrage</option>
              <option value="Technischer Support">Technischer Support</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </label>

          <div class="form-grid">
            <label class="form-field">
              <span>Name</span>
              <input name="name" type="text" autocomplete="name" required />
            </label>

            <label class="form-field">
              <span>E-Mail-Adresse</span>
              <input
                name="email"
                type="email"
                autocomplete="email"
                inputmode="email"
                required
              />
            </label>
          </div>

          <label class="form-field">
            <span>Deine Nachricht</span>
            <textarea name="message" rows="6" required></textarea>
          </label>

          <label class="form-honey" aria-hidden="true">
            Bitte leer lassen
            <input name="_honey" type="text" tabindex="-1" autocomplete="off" />
          </label>

          <p class="form-privacy">
            Mit dem Absenden werden deine Angaben über FormSubmit an uns
            übermittelt.
            <a href="datenschutz.html#kontaktformular">Datenschutz</a>
          </p>

          <div class="form-actions">
            <button class="form-submit" type="submit" disabled>Nachricht senden</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>
    `;

    document.body.append(dialog);

    const closeButton = dialog.querySelector(".contact-dialog-close");
    const form = dialog.querySelector(".contact-form");
    const nameInput = form.querySelector('input[name="name"]');
    const emailInput = form.querySelector('input[name="email"]');
    const messageInput = form.querySelector('textarea[name="message"]');
    const submitButton = dialog.querySelector(".form-submit");
    const status = dialog.querySelector(".form-status");

    const updateSubmitState = () => {
      const hasName = nameInput.value.trim().length > 0;
      const hasEmail =
        emailInput.value.trim().length > 0 && emailInput.checkValidity();
      const hasMessage = messageInput.value.trim().length > 0;
      const ready = hasName && hasEmail && hasMessage;

      submitButton.disabled = !ready;
      submitButton.classList.toggle("is-ready", ready);
    };

    [nameInput, emailInput, messageInput].forEach((field) => {
      field.addEventListener("input", updateSubmitState);
      field.addEventListener("change", updateSubmitState);
    });

    updateSubmitState();

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const data = new FormData(form);
      const reason = String(data.get("reason") || "Feedback").trim();
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const message = String(data.get("message") || "").trim();
      const honey = String(data.get("_honey") || "").trim();

      if (honey) {
        form.reset();
        updateSubmitState();
        status.textContent = "Nachricht wurde gesendet.";
        status.className = "form-status is-success";
        return;
      }

      submitButton.disabled = true;
      submitButton.classList.remove("is-ready");
      submitButton.classList.add("is-sending");
      submitButton.textContent = "Wird gesendet …";
      status.textContent = "";
      status.className = "form-status";

      try {
        const response = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            _subject: `${reason} – WUNDERWERKstatt`,
            _template: "table",
            _captcha: "false",
            _replyto: email,
            _url: window.location.href,
            reason,
            name,
            email,
            message,
          }),
        });

        const result = await response.json();
        const success =
          result.success === true ||
          String(result.success).toLowerCase() === "true" ||
          result.ok === true;

        if (!response.ok || !success) {
          const activationRequired = /activat/i.test(String(result.message || ""));

          if (activationRequired) {
            throw new Error("activation");
          }

          throw new Error("submit");
        }

        form.reset();
        status.textContent = "Nachricht wurde gesendet.";
        status.className = "form-status is-success";
      } catch (error) {
        if (error instanceof Error && error.message === "activation") {
          status.innerHTML =
            'Der Direktversand muss einmalig freigeschaltet werden. ' +
            '<a href="mailto:' +
            CONTACT_EMAIL +
            '">Alternativ per E-Mail schreiben</a>.';
        } else {
          status.innerHTML =
            'Die Nachricht konnte nicht gesendet werden. ' +
            '<a href="mailto:' +
            CONTACT_EMAIL +
            '">Alternativ per E-Mail schreiben</a>.';
        }
        status.className = "form-status is-error";
      } finally {
        submitButton.classList.remove("is-sending");
        submitButton.textContent = "Nachricht senden";
        updateSubmitState();
      }
    });

    return dialog;
  };

  let dialog;

  const openContact = (event) => {
    if (event) {
      event.preventDefault();
    }

    if (!("HTMLDialogElement" in window)) {
      window.location.href = `mailto:${CONTACT_EMAIL}`;
      return;
    }

    if (!dialog) {
      dialog = buildDialog();
    }

    if (!dialog.open) {
      dialog.showModal();
      const firstField = dialog.querySelector("select");
      if (firstField) {
        firstField.focus();
      }
    }
  };

  document.querySelectorAll("[data-contact-open]").forEach((link) => {
    link.addEventListener("click", openContact);
  });
})();
