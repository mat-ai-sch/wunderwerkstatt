const origin = "https://wunderwerkstatt.nrw";
const fields = ["first_name", "last_name", "street", "postal_code", "city", "country", "phone", "birthdate"];
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Vary": "Origin",
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), {status, headers});

Deno.serve(async req => {
  if (req.headers.get("origin") !== origin) return reply(403, {error:"origin"});
  if (req.method === "OPTIONS") return new Response(null, {status:204, headers});
  if (!["GET", "PATCH"].includes(req.method)) return reply(405, {error:"method"});
  const bearer = req.headers.get("Authorization") || "";
  if (!/^Bearer [^\s]+$/.test(bearer)) return reply(401, {error:"login"});
  const authUrl = Deno.env.get("SUPABASE_URL") + "/auth/v1/user";
  const authHeaders = {Authorization: bearer, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type":"application/json"};
  try {
    const auth = await fetch(authUrl, {headers:authHeaders});
    if (!auth.ok) return reply(auth.status >= 500 ? 503 : 401, {error:"login"});
    let user = await auth.json();
    if (typeof user.id !== "string") return reply(401, {error:"login"});
    if (user.is_anonymous || !user.email || !user.email_confirmed_at) {
      return reply(403, {error:"confirmed_email_required"});
    }

    if (req.method === "PATCH") {
      const input = await req.json().catch(()=>null);
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).length !== fields.length ||
          !fields.every(key => typeof input[key] === "string" && input[key].length <= 500))
        return reply(400, {error:"fields"});
      const saved = await fetch(authUrl, {method:"PUT", headers:authHeaders,
        body:JSON.stringify({data:Object.fromEntries(fields.map(k=>[k,input[k].trim()]))})});
      if (!saved.ok) return reply(saved.status >= 500 ? 503 : 400, {error:"save"});
      user = await saved.json();
    }
    return reply(200, {
      email:user.email, saved:fields.every(key=>Object.hasOwn(user.user_metadata||{}, key)),
      fields:Object.fromEntries(fields.map(k=>[k,typeof user.user_metadata?.[k] === "string" ? user.user_metadata[k] : ""])),
    });
  } catch {
    return reply(503, {error:"unavailable"});
  }
});
