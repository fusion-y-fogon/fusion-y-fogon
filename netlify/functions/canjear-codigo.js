// Función serverless: valida un código de acceso y lo marca como usado para
// siempre — así, aunque alguien comparta el código con más personas, solo
// la primera persona que lo escriba logra desbloquear la app.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  try {
    const { code } = await req.json();
    if (!code || !code.trim()) {
      return new Response(JSON.stringify({ error: "Escribe un código." }), { status: 400 });
    }

    const store = getStore("codigos-acceso");
    const codigoLimpio = code.trim().toUpperCase();
    const registro = await store.get(codigoLimpio, { type: "json" });

    if (!registro) {
      return new Response(JSON.stringify({ error: "Ese código no existe. Revisa que esté bien escrito." }), { status: 404 });
    }
    if (registro.usado) {
      return new Response(JSON.stringify({ error: "Este código ya fue usado antes en otro dispositivo." }), { status: 409 });
    }

    await store.setJSON(codigoLimpio, { ...registro, usado: true, usadoEn: new Date().toISOString() });

    // El token que regresamos (no el código en sí) es lo que el navegador
    // guarda para no volver a pedirlo — así, aunque alguien vea el código
    // usado, no le sirve de nada.
    const token = crypto.randomUUID();

    return new Response(JSON.stringify({ ok: true, token, tipo: registro.tipo }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error al validar el código: " + err.message }), { status: 500 });
  }
};

