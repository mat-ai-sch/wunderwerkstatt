// Public guest endpoint. Only the server can issue and consume challenges and sessions.
const originList = new Set(["https://wunderwerkstatt.nrw", "https://www.wunderwerkstatt.nrw"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");
const enc = new TextEncoder();
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const base = Deno.env.get("SUPABASE_URL")!;
const digestKey = crypto.subtle.importKey("raw", enc.encode(key), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
async function tag(scope: string, value: string) {
  return hex(await crypto.subtle.sign("HMAC", await digestKey, enc.encode("ww-guest-v1:" + scope + ":" + value)));
}
async function rpc(name: string, data: Record<string, unknown>) {
  const response = await fetch(base + "/rest/v1/rpc/ww_guest_" + name, {
    method:"POST", headers:{apikey:key, Authorization:"Bearer " + key, "Content-Type":"application/json"},
    body:JSON.stringify(data), signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("Guest database unavailable");
  const value = await response.text();
  return value ? JSON.parse(value) : null;
}
function newCode() {
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= 4294000000);
  return String(random[0] % 1000000).padStart(6, "0");
}
Deno.serve(async request => {
  const origin = request.headers.get("Origin") || "";
  const local = /^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(origin);
  const allowed = originList.has(origin) || local;
  const headers = {
    "Content-Type":"application/json", "Cache-Control":"no-store", "Vary":"Origin",
    "Access-Control-Allow-Origin":allowed ? origin : "https://wunderwerkstatt.nrw",
    "Access-Control-Allow-Methods":"POST, OPTIONS", "Access-Control-Allow-Headers":"Content-Type"
  };
  const reply = (status: number, body: object = {}) => Response.json(body, {status, headers});
  if (origin && !allowed) return reply(403);
  if (request.method === "OPTIONS") return new Response(null, {status:204,headers});
  if (request.method !== "POST") return reply(405);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);
  if (Number(request.headers.get("content-length")) > 2048) return reply(413);
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const decoder = new TextDecoder(); let raw = "", size = 0;
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return reply(413); }
      raw += decoder.decode(value,{stream:true});
    }
    let b;
    try { b = JSON.parse(raw + decoder.decode()); } catch { return reply(400); }
    if (typeof b?.email !== "string") return reply(400);
    const email = b.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/u.test(email)) return reply(400);
    const p_mail = await tag("mail",email);
    if (b.action === "request") {
      const mailKey = Deno.env.get("WW_GUEST_RESEND_KEY");
      if (!mailKey) return reply(503);
      const id = crypto.randomUUID(), code = newCode();
      const p_network = await tag("network",request.headers.get("cf-connecting-ip") || "shared");
      const p_proof = await tag("otp",id + ":" + code);
      if (!await rpc("issue",{p_id:id,p_mail,p_network,p_proof})) return reply(429);
      let sent = false;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method:"POST",headers:{Authorization:"Bearer " + mailKey,"Content-Type":"application/json","Idempotency-Key":id},
          signal:AbortSignal.timeout(9000),
          body:JSON.stringify({from:"WUNDERWERKstatt <gast@gast.wunderwerkstatt.nrw>",to:[email],
            subject:"Dein Gastcode für die WUNDERWERKstatt",
            text:"Dein Gastcode lautet " + code + ".\n\nGib ihn innerhalb von 10 Minuten im geöffneten Gastzugang ein. Er gilt einmal für diesen Einkauf. Falls du keinen Code angefordert hast, kannst du diese Nachricht ignorieren."})
        });
        sent = r.ok && typeof (await r.json()).id === "string";
      } finally { if (!sent) await rpc("discard",{p_id:id,p_mail}); }
      if (!sent) return reply(502);
      if (typeof b.previous === "string" && uuid.test(b.previous)) await rpc("discard",{p_id:b.previous,p_mail});
      return reply(200,{id, expires:Date.now()+600000, retryAt:Date.now()+60000});
    }
    if (b.action === "verify") {
      if (!uuid.test(b.id || "") || typeof b.code !== "string" || !/^\d{6}$/.test(b.code)) return reply(400);
      const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const expires = await rpc("verify",{p_id:b.id,p_mail,p_proof:await tag("otp",b.id+":"+b.code),p_token:await tag("session",token)});
      return expires ? reply(200,{token,expires:Date.parse(expires)}) : reply(401);
    }
    if (["session","end","finish"].includes(b.action)) {
      if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token)) return reply(401);
      const expires = await rpc("session",{p_token:await tag("session",b.token),p_mail,p_end:b.action!=="session"});
      return expires ? reply(200,{expires:Date.parse(expires)}) : reply(401);
    }
    return reply(400);
  } catch { return reply(503); }
});
