export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "FATMA BAKR GLOW SPA",
        whatsapp: !!env.WHATSAPP_ACCESS_TOKEN
      });
    }

    // WhatsApp Webhook verification
    if (url.pathname === "/webhook" && request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (
        mode === "subscribe" &&
        token &&
        token === env.WHATSAPP_VERIFY_TOKEN
      ) {
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // WhatsApp Webhook receiver
    if (url.pathname === "/webhook" && request.method === "POST") {
      const body = await request.text();

      console.log("WhatsApp webhook:", body);

      return Response.json({ ok: true });
    }

    // Serve the spa website
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("FATMA BAKR GLOW SPA", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  },

  async scheduled(event, env, ctx) {
    console.log("FATMA BAKR GLOW SPA reminder worker running");
  }
};
