import { products } from "./products.js";

export function startGuest(access) {
  const byId = new Map(products.map(product => [product.id, product]));
  const $ = id => document.getElementById(id);
  const form = $("contact-form");
  const contactKeys = Array.from(form.elements).map(input => input.name).filter(Boolean);
  const key = access.dataKey;
  const timeout = 30 * 60 * 1000;
  const sections = ["auswahl", "favoriten", "kontakt", "warenkorb", "kasse"];
  let timer, completed = false, checkoutEditing = false, storageAvailable = true;
  const blank = () => ({
    lists: [{ name: "Meine Merkliste", ids: [] }], active: 0, cart: {}, contact: {}, updated: Date.now()
  });
  let state = blank();

  function restore() {
    try {
      const value = sessionStorage.getItem(key);
      if (!value) return;
      const data = JSON.parse(value);
      if (data.sessionId !== access.sessionId || !Number.isFinite(data.updated) || data.updated + timeout <= Date.now() ||
          !Array.isArray(data.lists) || !data.lists.length || !data.cart || !data.contact) {
        erase();
        return;
      }
      state.lists = data.lists.map(list => ({
        name: String(list.name).slice(0,45),
        ids: [...new Set(list.ids.filter(id => byId.has(id)))]
      }));
      state.active = state.lists[data.active] ? Number(data.active) : 0;
      state.cart = Object.fromEntries(Object.entries(data.cart).filter(([id, n]) => byId.has(id) && Number.isInteger(n) && n >= 1 && n <= 99));
      state.contact = Object.fromEntries(contactKeys.filter(k => typeof data.contact[k] === "string")
        .map(k => [k, data.contact[k].slice(0,form.elements[k].maxLength)]));
      state.updated = data.updated;
    } catch {
      erase();
    }
  }

  function erase() {
    state = blank();
    completed = false;
    checkoutEditing = false;
    clearTimeout(timer);
    try { sessionStorage.removeItem(key); } catch { storageAvailable = false; }
    form.reset();
    $("create-list").reset();
    $("review-contact").textContent = "";
    for (const id of ["catalog","favorites","list","cart-items","review-items"]) $(id).replaceChildren();
    if ($("end-dialog").open) $("end-dialog").close();
  }

  function persist() {
    try { sessionStorage.setItem(key, JSON.stringify({ ...state, sessionId: access.sessionId })); }
    catch {
      storageAvailable = false;
      $("storage-note").hidden = false;
      try { sessionStorage.removeItem(key); } catch {}
    }
  }

  function expire() {
    erase();
    access.exit();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(expire, Math.max(0, state.updated + timeout - Date.now()));
  }

  function touch() {
    if (Date.now() >= state.updated + timeout) { expire(); return false; }
    state.updated = Date.now();
    if (!access.touch()) return false;
    schedule();
    return true;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, action, id, secondary = true) {
    const node = element("button", text, secondary ? "secondary" : "");
    node.type = "button"; node.dataset.action = action; node.dataset.id = id;
    return node;
  }

  function picture(product) {
    const node = document.createElement("img");
    node.src = product.image; node.alt = ""; node.loading = "lazy"; node.decoding = "async";
    return node;
  }

  function productCard(product, inList) {
    const article = element("article", undefined, "product"), fig = element("figure");
    fig.append(picture(product));
    const controls = element("div", undefined, "product-controls");
    const marked = state.lists[state.active].ids.includes(product.id);
    const mark = button(inList ? "Entfernen" : marked ? "Gemerkt" : "Merken", "favorite", product.id);
    mark.setAttribute("aria-label", product.name + (marked ? " aus Merkliste entfernen" : " merken"));
    if (!inList) mark.setAttribute("aria-pressed", String(marked));
    const add = button("In den Warenkorb", "add", product.id, false);
    add.setAttribute("aria-label", product.name + " in den Warenkorb");
    add.disabled = state.cart[product.id] === 99;
    controls.append(mark, add);
    article.append(fig, element("small", product.category + " · Demoartikel"), element("h3", product.name),
      element("p", product.description,"description"), controls);
    return article;
  }

  function empty(text) {
    const box = element("div", undefined, "empty");
    const link = element("a", "Produkte entdecken");
    link.href = "#auswahl";
    box.append(element("p",text),link);
    return box;
  }

  function renderCart(items) {
    const rows = items.map(([product, count]) => {
      const row = element("article", undefined, "item-line"), name = element("div", undefined, "item-name");
      name.append(element("small","Demoartikel"), element("strong",product.name));
      const qty = element("div", undefined, "quantity");
      const less = button("−","less",product.id), more = button("+","add",product.id);
      less.setAttribute("aria-label", product.name + " einmal weniger");
      more.setAttribute("aria-label", product.name + " einmal mehr");
      more.disabled = count >= 99; less.disabled = count <= 1;
      qty.append(less,element("span",String(count)),more);
      const remove = button("Entfernen","remove",product.id);
      remove.setAttribute("aria-label",product.name + " aus dem Warenkorb entfernen");
      row.append(picture(product),name,qty,remove); return row;
    });
    $("cart-items").replaceChildren(...(rows.length ? rows : [empty("Dein Warenkorb ist noch leer.")]));
    $("cart-next").hidden = !rows.length;
  }

  function route() {
    const name = location.hash.slice(1);
    if (name === "kasse" && !Object.keys(state.cart).length) return "warenkorb";
    return sections.includes(name) ? name : "auswahl";
  }

  function render(focus = false) {
    const current = route();
    sections.forEach(id => { $(id).hidden = id !== current; });
    document.querySelectorAll(".sections a").forEach(link => {
      if (link.hash === "#" + (current === "kasse" ? "warenkorb" : current)) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
    const items = products.filter(p => state.cart[p.id]).map(p => [p, state.cart[p.id]]);
    const total = items.reduce((sum,[,qty]) => sum+qty,0);
    $("cart-count").textContent = $("header-count").textContent = String(total);
    $("header-count").hidden = total === 0;
    $("header-count").closest("a").setAttribute("aria-label", "Gast-Warenkorb, " + total + " Artikel");
    const list = state.lists[state.active];
    $("fav-count").textContent = String(new Set(state.lists.flatMap(l => l.ids)).size);
    if (current === "auswahl") {
      const category = $("category").value;
      const query = $("produktsuche").value.trim().toLocaleLowerCase("de");
      const matches = products.filter(p => (!category || p.category === category) &&
        (p.name + " " + p.category).toLocaleLowerCase("de").includes(query));
      $("catalog").replaceChildren(...(matches.length ? matches.map(p => productCard(p,false))
        : [element("p", "Keine passenden Produkte gefunden.")]));
    } else if (current === "favoriten") {
      $("list").replaceChildren(...state.lists.map((l,i) => new Option(l.name,String(i))));
      $("list").value = String(state.active);
      $("favorites").replaceChildren(...(list.ids.length ? list.ids.map(id => productCard(byId.get(id),true)) : [empty("Diese Merkliste ist noch leer.")]));
    } else if (current === "kontakt") {
      for (const k of contactKeys) form.elements[k].value = state.contact[k] || "";
      $("confirmed-email").value = access.email;
    } else if (current === "warenkorb") {
      renderCart(items);
    } else if (current === "kasse") {
      $("review-items").replaceChildren(...items.map(([p,qty]) => element("li",qty + " × " + p.name)));
      const c = state.contact;
      $("review-contact").textContent = [[c.first,c.last].filter(Boolean).join(" "), access.email, c.phone, c.street,
        [c.zip,c.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || "Keine Kontaktdaten angegeben.";
    }
    if (focus && location.hash === "#produktsuche") $("produktsuche").focus();
    else if (focus) $(current).querySelector("h2").focus();
  }

  document.addEventListener("click", event => {
    const ctrl = event.target.closest("button[data-action]");
    if (!ctrl || !touch()) return;
    const {action,id} = ctrl.dataset, p = byId.get(id);
    if (!p) return;
    const container = ctrl.closest("section");
    const list = state.lists[state.active]; let feedback;
    if (action === "favorite") {
      const wasMarked = list.ids.includes(id);
      list.ids = wasMarked ? list.ids.filter(i => i !== id) : [...list.ids,id];
      feedback = p.name + (wasMarked ? " aus der Merkliste entfernt." : " für später gemerkt.");
    } else if (action === "remove") {
      delete state.cart[id]; feedback = p.name + " aus dem Warenkorb entfernt.";
    } else {
      const qty = Math.max(1, Math.min(99,(state.cart[id] || 0) + (action === "add" ? 1 : -1)));
      state.cart[id] = qty;
      feedback = p.name + " liegt " + qty + " × im Warenkorb.";
    }
    persist(); render();
    const next = container.querySelector('[data-action="' + action + '"][data-id="' + id + '"]:not(:disabled)') ||
      container.querySelector('button[data-id="' + id + '"]:not(:disabled)') ||
      container.querySelector("button[data-action]:not(:disabled),.empty a") || container.querySelector("h2");
    next?.focus({preventScroll:true});
    $("feedback").textContent = feedback;
  });

  $("category").onchange = () => render();
  $("produktsuche").oninput = () => render();
  $("list").onchange = () => { state.active = Number($("list").value); persist(); render(); };
  $("create-list").onsubmit = event => {
    event.preventDefault();
    const input = event.target.elements.listName, name = input.value.trim();
    if (!name) { input.focus(); return; }
    const existing = state.lists.findIndex(l => l.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de"));
    if (existing === -1) state.lists.push({ name, ids: [] });
    state.active = existing === -1 ? state.lists.length - 1 : existing;
    persist(); input.value = ""; render();
    $("feedback").textContent = "Aktive Merkliste: " + name;
  };

  form.onsubmit = event => {
    event.preventDefault();
    state.contact = Object.fromEntries(contactKeys.map(k => [k,form.elements[k].value.trim()]));
    persist();
    if (checkoutEditing) { checkoutEditing = false; location.hash = "kasse"; }
    else $("feedback").textContent = "Deine Kontaktdaten wurden für diese Sitzung übernommen.";
  };
  $("clear-contact").onclick = () => {
    state.contact = {}; form.reset(); $("confirmed-email").value = access.email; persist(); $("review-contact").textContent = "";
    $("feedback").textContent = "Deine freiwilligen Kontaktdaten wurden gelöscht.";
  };
  $("end").onclick = () => $("end-dialog").showModal();
  $("cancel-end").onclick = () => $("end-dialog").close();
  $("confirm-end").onclick = expire;
  $("finish").onclick = async () => {
    if (route() !== "kasse" || !Object.keys(state.cart).length) return;
    $("finish").disabled = true;
    try {
      await access.finish();
      erase(); completed = true;
      $("guest-workspace").hidden = $("guest-links").hidden = true;
      $("abschluss").hidden = false;
      history.replaceState(null,"","#abschluss");
      $("done-heading").focus();
    } catch {
      $("feedback").textContent = "Der Abschluss konnte nicht bestätigt werden. Bitte versuche es erneut.";
    } finally { $("finish").disabled = false; }
  };

  for (const category of new Set(products.map(p => p.category))) $("category").add(new Option(category,category));
  restore();
  try { sessionStorage.setItem(key + ".probe","1"); sessionStorage.removeItem(key + ".probe"); }
  catch { storageAvailable = false; }
  schedule(); $("storage-note").hidden = storageAvailable;
  render();

  window.addEventListener("hashchange", event => {
    if (completed || !touch()) return;
    checkoutEditing = new URL(event.oldURL).hash === "#kasse" && route() === "kontakt";
    $("feedback").textContent = "";
    render(true);
  });
  for (const event of ["pointerdown","keydown","submit","input"]) {
    document.addEventListener(event, e => {
      if (completed) return;
      if (!touch()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (Date.now() - lastStored > 15000 && !completed) { persist(); lastStored = Date.now(); }
    },true);
  }
  let lastStored = 0;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.updated + timeout <= Date.now()) expire();
  });
  window.addEventListener("pagehide", () => {
    if (!completed && access.active() && state.updated + timeout > Date.now() && (Object.keys(state.contact).length || Object.keys(state.cart).length || state.lists.some(l=>l.ids.length) || state.lists.length>1)) persist();
    clearTimeout(timer);
    form.reset(); $("review-contact").textContent = ""; state = blank();
  });
}
