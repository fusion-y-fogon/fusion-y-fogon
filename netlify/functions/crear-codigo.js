// Función serverless: genera un código único de acceso para una persona que
// ya pagó. Protegida con una contraseña de administración (ADMIN_SECRET,
// variable de entorno en Netlify) — solo tú puedes generar códigos.
// Guarda el código en Netlify Blobs (almacenamiento incluido de Netlify,
// gratis en tu escala) como "sin usar".
import { getStore } from "@netlify/blobs";

function generarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusiones
  let codigo = "";
  for (let i = 0; i < 8; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return codigo;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return new Response(JSON.stringify({ error: "Falta configurar ADMIN_SECRET en Netlify" }), { status: 500 });
  }

  try {
    const { password, nota, tipo } = await req.json();
    if (password !== adminSecret) {
      return new Response(JSON.stringify({ error: "Contraseña incorrecta" }), { status: 401 });
    }

    const store = getStore("codigos-acceso");
    let codigo;
    // Nos aseguramos de no generar un código que por casualidad ya exista.
    do {
      codigo = generarCodigo();
    } while (await store.get(codigo) !== null);

    await store.setJSON(codigo, {
      usado: false,
      nota: nota || "",
      tipo: tipo || "suscripcion", // "suscripcion" o "paquete"
      creadoEn: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ codigo }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error al generar el código: " + err.message }), { status: 500 });
  }
};

