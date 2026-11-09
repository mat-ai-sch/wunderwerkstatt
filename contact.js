(() => {
  const CONTACT_EMAIL = "info@wunderwerkstatt.nrw";

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

        <p class="contact-eyebrow">DEINE NACHRICHT AN UNS</p>
        <h2 id="contact-dialog-title">Feedback geben.</h2>
        <p class="contact-intro">
          Eine Frage, eine Idee oder etwas, das nicht funktioniert? Schreib uns.
        </p>

        <p class="contact-note">
          Beim Senden öffnet sich dein E-Mail-Programm. Die Nachricht wird erst
          dort verschickt.
        </p>

        <form class="contact-form">
          <label class="form-field">
            <span>Worum geht es?</span>
            <select name="reason" required>
              <option value="Kontaktanfrage">Kontaktanfrage</option>
              <option value="Bestellung">Bestellung</option>
              <option value="Hochzeit und Floristik">Hochzeit und Floristik</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </label>

          <div class="form-grid">
            <label class="form-field">
              <span>Name (optional)</span>
              <input name="name" type="text" autocomplete="name" />
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

          <p class="form-privacy">
            Deine Angaben werden in deinem E-Mail-Programm vorbereitet. Erst wenn
            du die E-Mail dort sendest, werden sie an uns übermittelt.
            <a href="datenschutz.html#kontaktformular">Datenschutz</a>
          </p>

          <button class="form-submit" type="submit">Nachricht senden</button>
        </form>
      </div>
    `;

    document.body.append(dialog);

    const closeButton = dialog.querySelector(".contact-dialog-close");
    const form = dialog.querySelector(".contact-form");

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      const data = new FormData(form);
      const reason = String(data.get("reason") || "Kontaktanfrage").trim();
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const message = String(data.get("message") || "").trim();

      const subject = `${reason} – WUNDERWERKstatt`;
      const bodyParts = [
        name ? `Name: ${name}` : "",
        `E-Mail: ${email}`,
        "",
        message,
      ].filter((part, index, array) => {
        if (part !== "") {
          return true;
        }

        return index > 0 && array[index - 1] !== "";
      });

      const mailto =
        `mailto:${CONTACT_EMAIL}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(bodyParts.join("\n"))}`;

      window.location.href = mailto;
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
