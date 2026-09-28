// Función serverless: recibe la misma petición que antes se mandaba directo
// a Anthropic desde el navegador, y la reenvía usando la llave secreta
// guardada en Netlify (variable de entorno ANTHROPIC_API_KEY) — el navegador
// de quien usa la app nunca ve esa llave.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Falta configurar ANTHROPIC_API_KEY en Netlify" }), { status: 500 });
  }

  try {
    const body = await req.text();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    });
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error al conectar con Anthropic: " + err.message }), { status: 500 });
  }
};

