const $ = id => document.getElementById(id);
const endpoint = "https://lvereygccmzxdkdagwmu.supabase.co/functions/v1/gastzugang";
const sessionKey = "ww.gast.zugang", pendingKey = "ww.gast.anforderung", dataKey = "ww.gast.auswahl";
function read(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* The in-memory session remains usable in this tab. */ }
}
save("ww-gast.sitzung.v1", null);
let session = read(sessionKey), pending = read(pendingKey);
let busy = false, lastCheck = 0, checking = false, idleTimer;
const status = message => { $("gate-status").textContent = message; };
async function call(action, values) {
  let response;
  try {
    response = await fetch(endpoint, {method:"POST", headers:{"Content-Type":"application/json"},
      credentials:"omit", cache:"no-store", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(18000),
      body:JSON.stringify({action,...values})});
  } catch { throw new Error("Verbindung unterbrochen. Bitte versuche es erneut."); }
  if (!response.ok) {
    const message = response.status === 429 ? "Bitte warte mit einer neuen Anforderung. Zum Schutz vor zu vielen E-Mails ist der Versand begrenzt."
      : response.status === 401 ? "Der Code ist ungültig, abgelaufen oder bereits verwendet."
      : "Der Gastzugang ist gerade nicht erreichbar. Bitte versuche es später erneut.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function updateForms() {
  $("mail-form").hidden = !!pending;
  $("code-form").hidden = !pending;
  $("gate-intro").hidden = !!pending;
  if (pending) {
    $("sent-to").textContent = pending.email;
    const seconds = Math.max(0,Math.ceil((pending.retryAt-Date.now())/1000));
    $("resend").disabled = busy || seconds > 0;
    $("resend").textContent = seconds ? "Neuer Code in " + seconds + " s" : "Neuen Code anfordern";
  }
}
function expirePending() {
  if (!session && pending && pending.expires <= Date.now() && !busy) {
    $("guest-email").value = pending.email;
    pending = null; save(pendingKey,null); $("guest-code").value = "";
    updateForms(); status("Dein Code ist abgelaufen. Fordere einen neuen Code an.");
  } else if (pending) updateForms();
}
setInterval(expirePending,1000);
async function run(action) {
  if (busy) return;
  busy = true; status("");
  $("guest-gate").setAttribute("aria-busy","true");
  for (const el of $("guest-gate").querySelectorAll("button,input")) el.disabled = true;
  try { await action(); } catch (error) { status(error.message); }
  finally {
    busy = false; $("guest-gate").removeAttribute("aria-busy");
    for (const el of $("guest-gate").querySelectorAll("button,input")) el.disabled = false;
    updateForms();
    if (!$("guest-gate").hidden) (pending ? $("guest-code") : $("guest-email")).focus();
  }
}
async function sendCode() {
  const email = pending?.email || $("guest-email").value.trim().toLowerCase();
  const result = await call("request",{email,previous:pending?.id});
  pending = {email,id:result.id,expires:result.expires,retryAt:result.retryAt};
  save(pendingKey,pending); $("guest-code").value = ""; updateForms();
  status("Code versendet. Prüfe bei Bedarf auch deinen Spam-Ordner.");
}
$("mail-form").onsubmit = e => { e.preventDefault(); run(sendCode); };
$("resend").onclick = () => run(sendCode);
$("change-email").onclick = () => {
  $("guest-email").value = pending.email; pending = null; save(pendingKey,null);
  $("guest-code").value = ""; updateForms(); status(""); $("guest-email").focus();
};
function forget() {
  clearTimeout(idleTimer);
  save(sessionKey,null); save(pendingKey,null); save(dataKey,null);
  session = null; pending = null;
}
function returnToGate() {
  $("guest-workspace").hidden = $("guest-links").hidden = true;
  forget(); location.replace(location.pathname + "?erneut");
}
function reschedule() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(returnToGate,Math.max(0,session.expires-Date.now()));
}
function sessionValues() { return {email:session.email,token:session.token}; }
async function refresh() {
  const current = session;
  const result = await call("session",sessionValues());
  if (!session || current.token !== session.token) return;
  session.expires = result.expires; lastCheck = Date.now(); save(sessionKey,session); reschedule();
}
async function enter() {
  const {startGuest} = await import("./gast.js?v=gastcode-1");
  lastCheck = Date.now(); reschedule();
  const access = {
    dataKey, email:session.email, sessionId:session.token.slice(0,20),
    active: () => Boolean(session && session.expires > Date.now()),
    touch() {
      if (!session || Date.now() >= session.expires) { returnToGate(); return false; }
      if (!checking && Date.now()-lastCheck >= 15000) {
        checking = true;
        refresh().catch(e => {
          if (e.status === 401) returnToGate();
          else $("feedback").textContent = e.message;
        }).finally(()=>{ checking = false; });
      }
      return true;
    },
    exit() {
      if (session) {
        // Keep the request alive across navigation. Server expiry also covers offline sign-out.
        fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
          credentials:"omit",body:JSON.stringify({action:"end",...sessionValues()})}).catch(()=>{});
      }
      returnToGate();
    },
    async finish() {
      try { await call("finish",sessionValues()); }
      catch (e) { if (e.status === 401) returnToGate(); throw e; }
      forget();
    }
  };
  startGuest(access);
  $("guest-gate").hidden = true; $("guest-workspace").hidden = $("guest-links").hidden = false;
  document.querySelector("#guest-workspace section:not([hidden]) h2")?.focus();
}
$("code-form").onsubmit = e => {
  e.preventDefault(); run(async () => {
    const result = await call("verify",{email:pending.email,id:pending.id,code:$("guest-code").value});
    save(dataKey,null); session = {email:pending.email,token:result.token,expires:result.expires};
    save(sessionKey,session); pending = null; save(pendingKey,null);
    $("guest-code").value = ""; $("guest-email").value = "";
    await enter();
  });
};
async function boot() {
  $("retry-session").hidden = true;
  if (session && Number.isFinite(session.expires) && session.expires > Date.now()) {
    status("Gastsitzung wird geprüft …");
    try { await refresh(); await enter(); return; }
    catch (e) {
      if (e.status !== 401) { status(e.message); $("retry-session").hidden = false; return; }
    }
  }
  if (session) forget();
  if (!pending) save(dataKey,null);
  updateForms(); expirePending();
  if (location.search === "?erneut") {
    status("Deine Gastsitzung ist beendet. Für einen weiteren Einkauf kannst du einen neuen Code anfordern.");
    history.replaceState(null,"",location.pathname);
  } else if (!pending) status("");
}
$("retry-session").onclick = boot;
window.addEventListener("pagehide",()=>{ $("guest-workspace").hidden = $("guest-links").hidden = true; });
window.addEventListener("pageshow",e=>{ if(e.persisted) location.reload(); });
boot();
