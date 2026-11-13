const ALLOWED_ORIGINS = new Set([
  "https://wunderwerkstatt.nrw",
  "https://www.wunderwerkstatt.nrw",
]);

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors,
    },
  });
}

function normalizeAmount(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 1) return null;
  return Math.round(amount * 100) / 100;
}

async function sumupRequest(path, apiKey, init = {}) {
  return fetch("https://api.sumup.com" + path, {
    ...init,
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (!cors) {
      return jsonResponse({ error: "Origin not allowed." }, 403, {});
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (!env.SUMUP_API_KEY || !env.SUMUP_MERCHANT_CODE) {
      return jsonResponse({ error: "Payment service is not configured." }, 503, cors);
    }

    if (request.method === "POST" && url.pathname === "/api/create-checkout") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid request." }, 400, cors);
      }

      const amount = normalizeAmount(payload?.amount);
      if (amount === null) {
        return jsonResponse({ error: "Bitte geben Sie einen gültigen Betrag ab 1,00 € ein." }, 400, cors);
      }

      const checkoutReference = "WW-" + crypto.randomUUID();
      const validUntil = new Date(Date.now() + 20 * 60 * 1000).toISOString();

      try {
        const response = await sumupRequest("/v0.1/checkouts", env.SUMUP_API_KEY, {
          method: "POST",
          body: JSON.stringify({
            checkout_reference: checkoutReference,
            amount,
            currency: "EUR",
            merchant_code: env.SUMUP_MERCHANT_CODE,
            description: "WUNDERWERKstatt Kaufbetrag",
            valid_until: validUntil,
          }),
        });

        if (!response.ok) {
          console.warn("SumUp checkout creation returned HTTP", response.status);
          return jsonResponse(
            { error: "Der Checkout konnte nicht erstellt werden. Bitte prüfen Sie den Betrag oder versuchen Sie es später erneut." },
            502,
            cors
          );
        }

        const checkout = await response.json();
        if (!checkout?.id) {
          console.warn("SumUp checkout response did not contain an id.");
          return jsonResponse({ error: "SumUp hat keine Checkout-ID zurückgegeben." }, 502, cors);
        }

        return jsonResponse({ checkoutId: checkout.id }, 201, cors);
      } catch {
        return jsonResponse({ error: "SumUp ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut." }, 502, cors);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/checkout-status") {
      const checkoutId = url.searchParams.get("id") || "";
      if (!/^[0-9a-f-]{36}$/i.test(checkoutId)) {
        return jsonResponse({ error: "Invalid checkout id." }, 400, cors);
      }

      try {
        const response = await sumupRequest(
          "/v0.1/checkouts/" + encodeURIComponent(checkoutId),
          env.SUMUP_API_KEY,
          { method: "GET" }
        );

        if (!response.ok) {
          console.warn("SumUp checkout status returned HTTP", response.status);
          return jsonResponse({ error: "Status konnte nicht geprüft werden." }, 502, cors);
        }

        const checkout = await response.json();
        return jsonResponse({ status: checkout?.status || "PENDING" }, 200, cors);
      } catch {
        return jsonResponse({ error: "Status konnte nicht geprüft werden." }, 502, cors);
      }
    }

    return jsonResponse({ error: "Not found." }, 404, cors);
  },
};
