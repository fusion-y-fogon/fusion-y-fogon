// Función serverless: genera la foto del platillo con la API de imágenes de
// OpenAI (Anthropic no tiene generador de imágenes propio). Necesita su
// propia llave secreta guardada en Netlify (variable de entorno
// OPENAI_API_KEY) — se crea aparte, en platform.openai.com, es una cuenta
// distinta a la de Anthropic.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Falta configurar OPENAI_API_KEY en Netlify" }), { status: 500 });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Falta el texto (prompt) de la imagen" }), { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      // Por defecto: gpt-image-1-mini en calidad "medium" (buen balance de
      // calidad y precio para fotos de comida). Se puede cambiar SIN tocar el
      // código, con dos variables de entorno opcionales en Netlify:
      //   IMAGE_QUALITY = low | medium | high
      //   IMAGE_MODEL   = gpt-image-1-mini | gpt-image-1.5 | ...
      body: JSON.stringify({
        model: process.env.IMAGE_MODEL || "gpt-image-1-mini",
        prompt: prompt.slice(0, 1400),
        size: "1024x1024",
        quality: process.env.IMAGE_QUALITY || "medium",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "OpenAI respondió con error: " + errText.slice(0, 300) }), { status: 500 });
    }

    const data = await response.json();
    const base64 = data?.data?.[0]?.b64_json;
    if (!base64) {
      return new Response(JSON.stringify({ error: "OpenAI no regresó ninguna imagen" }), { status: 500 });
    }

    return new Response(JSON.stringify({ base64 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error al generar la imagen: " + err.message }), { status: 500 });
  }
};

