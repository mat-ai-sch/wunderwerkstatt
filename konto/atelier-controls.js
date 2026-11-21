(() => {
  const login = document.getElementById("login");
  const form = document.getElementById("email-login");
  const toggles = Array.from(form.querySelectorAll("[data-password-target]"), button => ({
    button,
    input: document.getElementById(button.dataset.passwordTarget),
  }));

  function setVisibility(control, visible) {
    control.input.type = visible ? "text" : "password";
    control.button.setAttribute("aria-pressed", String(visible));
  }

  function resetVisibility() {
    toggles.forEach(control => setVisibility(control, false));
  }

  toggles.forEach(control => {
    control.button.addEventListener("click", () => {
      setVisibility(control, control.input.type === "password");
    });
  });

  form.addEventListener("reset", resetVisibility);
  new MutationObserver(resetVisibility).observe(login, { attributes: true, attributeFilter: ["data-mode"] });
})();
