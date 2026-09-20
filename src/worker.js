const DATA_KEY = "spa_data";
const SESSION_PREFIX = "spa_session:";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";");

  for (const part of parts) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}

async function isAuthenticated(request, env) {
  const sessionId = getCookie(request, "SPA_SESSION");

  if (!sessionId || !env.SPA_KV) {
    return false;
  }

  const session = await env.SPA_KV.get(
    SESSION_PREFIX + sessionId
  );

  return !!session;
}

function loginPage(error = "") {
  return new Response(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FATMA BAKR GLOW SPA</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #f7eee8, #ead8ce);
}

.box {
  width: min(92%, 420px);
  background: rgba(255,255,255,.96);
  border-radius: 24px;
  padding: 35px 28px;
  box-shadow: 0 15px 45px rgba(0,0,0,.15);
  text-align: center;
}

.logo {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 50%;
  margin-bottom: 18px;
}

h1 {
  margin: 0 0 8px;
  font-size: 25px;
}

.subtitle {
  color: #777;
  margin-bottom: 25px;
}

input {
  width: 100%;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 17px;
  outline: none;
  text-align: center;
  margin-bottom: 15px;
}

button {
  width: 100%;
  padding: 15px;
  border: 0;
  border-radius: 12px;
  background: #222;
  color: white;
  font-size: 17px;
  cursor: pointer;
}

.error {
  color: #c62828;
  margin-bottom: 15px;
}
</style>
</head>

<body>

<div class="box">

  <img
    class="logo"
    src="/logo.jpg"
    onerror="this.style.display='none'"
  >

  <h1>FATMA BAKR GLOW SPA</h1>

  <div class="subtitle">
    تسجيل الدخول إلى نظام إدارة السبا
  </div>

  ${error ? `<div class="error">${error}</div>` : ""}

  <form method="POST" action="/api/login">

    <input
      type="password"
      name="password"
      placeholder="أدخل كلمة المرور"
      autocomplete="current-password"
      required
      autofocus
    >

    <button type="submit">
      دخول
    </button>

  </form>

</div>

</body>
</html>
`, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    // ==============================
    // CORS / OPTIONS
    // ==============================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": url.origin,
          "access-control-allow-methods":
            "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers":
            "Content-Type"
        }
      });
    }

    // ==============================
    // LOGIN
    // ==============================

    if (
      url.pathname === "/api/login" &&
      request.method === "POST"
    ) {

      if (!env.SPA_PASSWORD) {
        return json({
          ok: false,
          error: "SPA_PASSWORD secret is missing"
        }, 500);
      }

      let password = "";

      try {

        const contentType =
          request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {

          const body = await request.json();
          password = String(body.password || "");

        } else {

          const form = await request.formData();
          password = String(form.get("password") || "");

        }

      } catch (error) {

        return loginPage("بيانات الدخول غير صحيحة");

      }

      if (password !== env.SPA_PASSWORD) {
        return loginPage("كلمة المرور غير صحيحة");
      }

      const sessionId = crypto.randomUUID();

      await env.SPA_KV.put(
        SESSION_PREFIX + sessionId,
        JSON.stringify({
          createdAt: Date.now()
        }),
        {
          expirationTtl: SESSION_TTL
        }
      );

      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie":
            `SPA_SESSION=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`
        }
      });
    }

    // ==============================
    // LOGOUT
    // ==============================

    if (
      url.pathname === "/api/logout" &&
      request.method === "POST"
    ) {

      const sessionId =
        getCookie(request, "SPA_SESSION");

      if (sessionId && env.SPA_KV) {
        await env.SPA_KV.delete(
          SESSION_PREFIX + sessionId
        );
      }

      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie":
            "SPA_SESSION=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
        }
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
    // HEALTH CHECK
    // ==============================

    if (url.pathname === "/api/health") {

      return json({
        ok: true,
        service: "FATMA BAKR GLOW SPA",
        kv: !!env.SPA_KV,
        whatsapp: !!env.WHATSAPP_ACCESS_TOKEN
      });
    }

    // ==============================
    // PROTECT SPA + DATA API
    // ==============================

    const authenticated =
      await isAuthenticated(request, env);

    // ==============================
    // DATA API
    // ==============================

    if (url.pathname === "/api/data") {

      if (!authenticated) {
        return json({
          ok: false,
          error: "Unauthorized"
        }, 401);
      }

      if (!env.SPA_KV) {
        return json({
          ok: false,
          error: "SPA_KV binding is missing"
        }, 500);
      }

      // GET DATA
      if (request.method === "GET") {

        const saved =
          await env.SPA_KV.get(DATA_KEY);

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

      // SAVE DATA
      if (
        request.method === "POST" ||
        request.method === "PUT"
      ) {

        try {

          const body =
            await request.json();

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

      // DELETE DATA
      if (request.method === "DELETE") {

        await env.SPA_KV.delete(DATA_KEY);

        return json({
          ok: true,
          deleted: true
        });
      }

      return json({
        ok: false,
        error: "Method not allowed"
      }, 405);
    }

    // ==============================
    // PROTECT WEBSITE
    // ==============================

    if (!authenticated) {
      return loginPage();
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
  console.log("FATMA BAKR GLOW SPA reminder worker running");

  if (!env.SPA_KV) {
    console.log("SPA_KV is missing");
    return;
  }

  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log("WhatsApp credentials are missing");
    return;
  }

  // Read all bookings
  const saved = await env.SPA_KV.get(DATA_KEY);

  if (!saved) {
    console.log("No spa data found");
    return;
  }

  const data = JSON.parse(saved);
  const appointments = Array.isArray(data.appointments)
    ? data.appointments
    : [];

  if (!appointments.length) {
    console.log("No appointments found");
    return;
  }

  // Egypt local date/time
  const now = new Date();

  const cairoParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  const getPart = (name) =>
    cairoParts.find(x => x.type === name)?.value || "";

  const today =
    `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

  const currentHour = Number(getPart("hour"));
  const currentMinute = Number(getPart("minute"));

  // Send WhatsApp template
  async function sendWhatsApp(appointment) {
    let phone = String(appointment.phone || "").replace(/\D/g, "");

    // Egypt numbers: 01xxxxxxxxx -> 201xxxxxxxxx
    if (phone.startsWith("01") && phone.length === 11) {
      phone = "2" + phone;
    }

    if (!phone) {
      console.log("No phone for appointment:", appointment.id);
      return false;
    }

    const url =
      `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization":
          `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "appointment_reminder",
          language: {
            code: "ar_EG"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: String(appointment.name || "عميلنا")
                },
                {
                  type: "text",
                  text: String(appointment.service || "")
                },
                {
                  type: "text",
                  text: String(appointment.date || "")
                    .split("-")
                    .reverse()
                    .join("/")
                },
                {
                  type: "text",
                  text: String(appointment.time || "")
                }
              ]
            }
          ]
        }
      })
    });

    const result = await response.text();

    console.log(
      "WhatsApp response:",
      response.status,
      result
    );

    return response.ok;
  }

  // Check every appointment
  for (const appointment of appointments) {
    if (!appointment || !appointment.date || !appointment.phone) {
      continue;
    }

    // Number of days selected by the customer
 const reminderDays = Number(
  appointment.reminder ??
  appointment.days ??
  appointment.reminderDays ??
  appointment.fDays ??
  0
);

    if (!reminderDays) {
      continue;
    }

    // Calculate reminder date
    const appointmentDate = new Date(
      `${appointment.date}T12:00:00`
    );

    if (Number.isNaN(appointmentDate.getTime())) {
      continue;
    }

    appointmentDate.setDate(
      appointmentDate.getDate() - reminderDays
    );

    const reminderDate =
      `${appointmentDate.getFullYear()}-${String(
        appointmentDate.getMonth() + 1
      ).padStart(2, "0")}-${String(
        appointmentDate.getDate()
      ).padStart(2, "0")}`;

    if (reminderDate !== today) {
      continue;
    }

    // Prevent duplicate messages
    const reminderKey =
      `spa_reminder_sent:${appointment.id}:${reminderDays}`;

    const alreadySent =
      await env.SPA_KV.get(reminderKey);

    if (alreadySent) {
      continue;
    }

    // Send around the appointment time.
    const appointmentTime =
      String(appointment.time || "10:00")
        .trim();

    const timeMatch =
      appointmentTime.match(/^(\d{1,2}):(\d{2})/);

    if (!timeMatch) {
      continue;
    }

    const appointmentHour =
      Number(timeMatch[1]);

    const appointmentMinute =
      Number(timeMatch[2]);

    const appointmentMinutes =
      appointmentHour * 60 +
      appointmentMinute;

    const currentMinutes =
      currentHour * 60 +
      currentMinute;

    // Run within the same minute as the reminder time.
    if (
      Math.abs(
        currentMinutes - appointmentMinutes
      ) > 5
    ) {
      continue;
    }

    const sent =
      await sendWhatsApp(appointment);

    if (sent) {
      await env.SPA_KV.put(
        reminderKey,
        JSON.stringify({
          sentAt: new Date().toISOString(),
          appointmentId: appointment.id
        }),
        {
          expirationTtl: 60 * 60 * 24 * 90
        }
      );

      console.log(
        "Reminder sent:",
        appointment.name,
        appointment.date,
        appointment.time
      );
    }
  }
}
};
