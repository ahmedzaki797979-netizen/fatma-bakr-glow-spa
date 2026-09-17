const DATA_KEY = "spa_data";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers": "Content-Type"
        }
      });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "FATMA BAKR GLOW SPA",
        kv: !!env.SPA_KV,
        whatsapp: !!env.WHATSAPP_ACCESS_TOKEN
      });
    }

    // ==============================
    // GET ALL SPA DATA
    // ==============================
    if (url.pathname === "/api/data" && request.method === "GET") {

      if (!env.SPA_KV) {
        return json({
          ok: false,
          error: "SPA_KV binding is missing"
        }, 500);
      }

      const saved = await env.SPA_KV.get(DATA_KEY);

      if (!saved) {
        return json({
          ok: true,
          data: {}
        });
      }

      try {
        return json({
          ok: true,
          data: JSON.parse(saved)
        });
      } catch (error) {
        return json({
          ok: false,
          error: "Stored data is invalid"
        }, 500);
      }
    }

    // ==============================
    // SAVE ALL SPA DATA
    // ==============================
    if (
      url.pathname === "/api/data" &&
      (request.method === "POST" || request.method === "PUT")
    ) {

      if (!env.SPA_KV) {
        return json({
          ok: false,
          error: "SPA_KV binding is missing"
        }, 500);
      }

      try {

        const body = await request.json();

        await env.SPA_KV.put(
          DATA_KEY,
          JSON.stringify(body)
        );

        return json({
          ok: true,
          saved: true
        });

      } catch (error) {

        return json({
          ok: false,
          error: "Could not save data"
        }, 400);
      }
    }

    // ==============================
    // DELETE ALL SPA DATA
    // ==============================
    if (
      url.pathname === "/api/data" &&
      request.method === "DELETE"
    ) {

      if (!env.SPA_KV) {
        return json({
          ok: false,
          error: "SPA_KV binding is missing"
        }, 500);
      }

      await env.SPA_KV.delete(DATA_KEY);

      return json({
        ok: true,
        deleted: true
      });
    }

    // ==============================
    // WHATSAPP WEBHOOK VERIFICATION
    // ==============================
    if (
      url.pathname === "/webhook" &&
      request.method === "GET"
    ) {

      const mode =
        url.searchParams.get("hub.mode");

      const token =
        url.searchParams.get("hub.verify_token");

      const challenge =
        url.searchParams.get("hub.challenge");

      if (
        mode === "subscribe" &&
        token &&
        token === env.WHATSAPP_VERIFY_TOKEN
      ) {

        return new Response(challenge, {
          status: 200
        });

      }

      return new Response("Forbidden", {
        status: 403
      });
    }

    // ==============================
    // WHATSAPP WEBHOOK RECEIVER
    // ==============================
    if (
      url.pathname === "/webhook" &&
      request.method === "POST"
    ) {

      const body = await request.text();

      console.log(
        "WhatsApp webhook:",
        body
      );

      return json({
        ok: true
      });
    }

    // ==============================
    // SERVE SPA WEBSITE
    // ==============================
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "FATMA BAKR GLOW SPA",
      {
        headers: {
          "content-type":
            "text/plain; charset=utf-8"
        }
      }
    );
  },

  // ==============================
  // CLOUDFLARE CRON
  // ==============================
  async scheduled(event, env, ctx) {

    console.log(
      "FATMA BAKR GLOW SPA reminder worker running"
    );

    // Reminder system will be connected here
    // after the database synchronization is completed.
  }

};
