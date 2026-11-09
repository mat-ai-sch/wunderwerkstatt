(() => {
  const CONTACT_EMAIL = "info@wunderwerkstatt.nrw";
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const CONSENT_VERSION = "2026-11-09";

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

        <h2 class="contact-eyebrow" id="contact-dialog-title">Kontakt</h2>
        <p class="contact-intro">
          Lob, Kritik oder einfach ein paar nette Worte? Schreib uns.
        </p>

        <form
          class="contact-form"
          method="post"
          enctype="multipart/form-data"
        >
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
              <span>Name<sup class="required-mark" aria-hidden="true">*</sup></span>
              <input name="name" type="text" autocomplete="name" required />
            </label>

            <label class="form-field">
              <span>E-Mail-Adresse<sup class="required-mark" aria-hidden="true">*</sup></span>
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
            <span>Deine Nachricht<sup class="required-mark" aria-hidden="true">*</sup></span>
            <textarea name="message" rows="6" required></textarea>
          </label>

          <div class="image-upload">
            <div class="image-upload-heading">
              <span>Foto hinzufügen</span>
              <span class="image-upload-limit">optional · max. 10 MB</span>
            </div>

            <label class="image-upload-button">
              <span class="image-upload-symbol" aria-hidden="true">+</span>
              <span>Foto auswählen oder aufnehmen</span>
              <input
                class="image-upload-input"
                name="attachment"
                type="file"
                accept="image/*"
              />
            </label>

            <div class="image-preview" hidden>
              <div class="image-preview-thumb">
                <img alt="Vorschau des ausgewählten Bildes" />
              </div>
              <div class="image-preview-copy">
                <strong class="image-preview-name"></strong>
                <span class="image-preview-size"></span>
              </div>
              <button
                class="image-preview-remove"
                type="button"
                aria-label="Ausgewähltes Bild entfernen"
              >
                ×
              </button>
            </div>

            <p class="image-upload-error" role="alert" hidden></p>
          </div>

          <fieldset class="image-consents" hidden>
            <legend>Einwilligung zum Bildmaterial</legend>

            <label class="consent-row">
              <input class="service-consent" type="checkbox" />
              <span>
                <sup class="required-mark required-mark-consent" aria-hidden="true">*</sup>
                Ich willige ein, dass das Bildmaterial für Servicezwecke genutzt
                wird, um das Produkt zu verbessern.
              </span>
            </label>

            <label class="consent-row">
              <input class="marketing-consent" type="checkbox" />
              <span>
                Ich willige ein, dass das Bildmaterial für Marketing- und
                Werbezwecke weiterverarbeitet werden darf.
                <a class="privacy-link" href="datenschutz.html#bildmaterial">Datenschutz</a>
              </span>
            </label>
          </fieldset>

          <label class="form-honey" aria-hidden="true">
            Bitte leer lassen
            <input name="_honey" type="text" tabindex="-1" autocomplete="off" />
          </label>

          <div class="form-privacy-block">
            <p class="form-privacy">
              Mit dem Absenden werden deine Angaben über FormSubmit an uns
              übermittelt.
              <a class="privacy-link" href="datenschutz.html#kontaktformular">Datenschutz</a>
            </p>
            <p class="required-note">
              <sup class="required-mark" aria-hidden="true">*</sup>
              Pflichtfelder
            </p>
          </div>

          <div class="form-actions">
            <button class="form-submit" type="submit" disabled>
              Nachricht senden
            </button>
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
    const imageInput = form.querySelector(".image-upload-input");
    const imagePreview = form.querySelector(".image-preview");
    const imagePreviewImg = form.querySelector(".image-preview img");
    const imagePreviewName = form.querySelector(".image-preview-name");
    const imagePreviewSize = form.querySelector(".image-preview-size");
    const imageRemoveButton = form.querySelector(".image-preview-remove");
    const imageError = form.querySelector(".image-upload-error");
    const consentGroup = form.querySelector(".image-consents");
    const serviceConsent = form.querySelector(".service-consent");
    const serviceConsentRow = serviceConsent.closest(".consent-row");
    const marketingConsent = form.querySelector(".marketing-consent");
    const submitButton = dialog.querySelector(".form-submit");
    const status = dialog.querySelector(".form-status");

    let previewUrl = "";

    const selectedImage = () => imageInput.files?.[0] || null;

    const clearPreviewUrl = () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
    };

    const resetImageState = () => {
      clearPreviewUrl();
      imageInput.value = "";
      imagePreview.hidden = true;
      imagePreviewImg.removeAttribute("src");
      imagePreviewName.textContent = "";
      imagePreviewSize.textContent = "";
      imageError.hidden = true;
      imageError.textContent = "";
      consentGroup.hidden = true;
      serviceConsent.checked = false;
      serviceConsent.required = false;
      serviceConsent.removeAttribute("aria-invalid");
      serviceConsentRow.classList.remove("is-invalid");
      marketingConsent.checked = false;
    };

    const updateSubmitState = () => {
      const hasName = nameInput.value.trim().length > 0;
      const hasEmail =
        emailInput.value.trim().length > 0 && emailInput.checkValidity();
      const hasMessage = messageInput.value.trim().length > 0;
      const ready = hasName && hasEmail && hasMessage;

      submitButton.disabled = !ready;
      submitButton.classList.toggle("is-ready", ready);
    };

    const showSelectedImage = (file) => {
      clearPreviewUrl();
      previewUrl = URL.createObjectURL(file);
      imagePreviewImg.src = previewUrl;
      imagePreviewName.textContent = file.name;
      imagePreviewSize.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
      imagePreview.hidden = false;
      imageError.hidden = true;
      imageError.textContent = "";
      consentGroup.hidden = false;
      serviceConsent.required = true;
      serviceConsent.checked = false;
      serviceConsent.removeAttribute("aria-invalid");
      serviceConsentRow.classList.remove("is-invalid");
      marketingConsent.checked = false;
    };

    imageInput.addEventListener("change", () => {
      const file = selectedImage();

      if (!file) {
        resetImageState();
        updateSubmitState();
        return;
      }

      if (!file.type.startsWith("image/")) {
        resetImageState();
        imageError.textContent = "Bitte wähle eine Bilddatei aus.";
        imageError.hidden = false;
        updateSubmitState();
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        resetImageState();
        imageError.textContent = "Das Bild darf maximal 10 MB groß sein.";
        imageError.hidden = false;
        updateSubmitState();
        return;
      }

      showSelectedImage(file);
      updateSubmitState();
    });

    imageRemoveButton.addEventListener("click", () => {
      resetImageState();
      updateSubmitState();
    });

    [nameInput, emailInput, messageInput, serviceConsent, marketingConsent].forEach(
      (field) => {
        field.addEventListener("input", updateSubmitState);
        field.addEventListener("change", updateSubmitState);
      }
    );

    serviceConsent.addEventListener("change", () => {
      if (serviceConsent.checked) {
        serviceConsent.removeAttribute("aria-invalid");
        serviceConsentRow.classList.remove("is-invalid");
      }
    });

    updateSubmitState();

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("close", () => {
      resetImageState();
      updateSubmitState();
    });

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

      const image = selectedImage();

      if (image && !serviceConsent.checked) {
        serviceConsent.setAttribute("aria-invalid", "true");
        serviceConsentRow.classList.add("is-invalid");
        serviceConsent.focus();
        return;
      }

      const data = new FormData(form);
      const reason = String(data.get("reason") || "Feedback").trim();
      const email = String(data.get("email") || "").trim();
      const honey = String(data.get("_honey") || "").trim();

      if (honey) {
        form.reset();
        resetImageState();
        updateSubmitState();
        status.textContent = "Nachricht wurde gesendet.";
        status.className = "form-status is-success";
        return;
      }

      if (!image || image.size === 0) {
        data.delete("attachment");
      }

      data.set("_subject", `${reason} – WUNDERWERKstatt`);
      data.set("_template", "table");
      data.set("_captcha", "false");
      data.set("_replyto", email);
      data.set("_url", window.location.href);
      if (image) {
        data.set(
          "Einwilligung Service Bildmaterial",
          "Ja – Ich willige ein, dass das Bildmaterial für Servicezwecke genutzt wird, um das Produkt zu verbessern."
        );
        data.set("Einwilligungsstand", CONSENT_VERSION);
        data.set("Einwilligungszeitpunkt", new Date().toISOString());

        if (marketingConsent.checked) {
          data.set(
            "Einwilligung Marketing Bildmaterial",
            "Ja – Ich willige ein, dass das Bildmaterial für Marketing- und Werbezwecke weiterverarbeitet werden darf."
          );
        }
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
            Accept: "application/json",
          },
          body: data,
        });

        const result = await response.json();
        const success =
          result.success === true ||
          String(result.success).toLowerCase() === "true" ||
          result.ok === true;

        if (!response.ok || !success) {
          const activationRequired = /activat/i.test(
            String(result.message || "")
          );

          if (activationRequired) {
            throw new Error("activation");
          }

          throw new Error("submit");
        }

        form.reset();
        resetImageState();
        updateSubmitState();
        status.textContent = "Nachricht wurde gesendet.";
        status.className = "form-status is-success";
      } catch (error) {
        if (error instanceof Error && error.message === "activation") {
          status.innerHTML =
            "Der Direktversand muss einmalig freigeschaltet werden. " +
            '<a href="mailto:' +
            CONTACT_EMAIL +
            '">Alternativ per E-Mail schreiben</a>.';
        } else {
          status.innerHTML =
            "Die Nachricht konnte nicht gesendet werden. " +
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
