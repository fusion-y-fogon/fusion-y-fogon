# Fusión & Fogón — proyecto real para Netlify

Este es el proyecto completo, listo para subir a Netlify. Aquí está todo lo
que ya funciona y lo que falta conectar.

## ✅ Ya funciona en cuanto pongas tus llaves

- Generar receta con foto o texto (usa tu llave de Anthropic).
- Generar la imagen del platillo (usa tu llave de OpenAI).
- Historial, favoritas, notas, "cociné esto" — ahora guardados con
  `localStorage` real del navegador (antes usaban un sistema especial que
  solo existe en la vista previa de Claude).
- El control de "10 recetas gratis o 1 mes, lo que se cumpla primero".

## ⚠️ Importante: limitación de este primer paso

El conteo del plan gratis vive en el navegador de cada quien (localStorage),
**no en una cuenta de usuario real**. Sirve perfecto para tu prueba con
familiares y amigos, pero:
- No hay todavía registro/inicio de sesión real.
- Alguien con conocimientos técnicos podría borrar sus datos del navegador
  y reiniciar su conteo.
- El mismo usuario en dos dispositivos distintos vería dos conteos
  separados (no se sincroniza).

Esto se resuelve en el **Paso 2 (Supabase)**, más abajo.

Los botones de "Suscribirme" y "Comprar solo esta receta" ya están en la
interfaz, pero por ahora solo muestran un mensaje — todavía no cobran nada
de verdad. Eso se conecta en el **Paso 3 (Stripe)**.

---

## Paso 0 — Requisitos antes de empezar

1. Cuenta de GitHub (gratis) — para subir el código.
2. Cuenta de Netlify (gratis) — para publicar la app.
3. Cuenta de Anthropic API en **console.anthropic.com** (distinta a tu
   Claude Pro) — con una llave (API key) y un tope de gasto mensual puesto.
4. Cuenta de OpenAI API en **platform.openai.com** — con una llave y también
   su propio tope de gasto.

## Paso 1 — Publicar el sitio en Netlify

1. Sube esta carpeta completa a un repositorio nuevo en GitHub (puedes
   arrastrar los archivos directo en github.com si no usas Git desde la
   terminal).
2. En Netlify: "Add new site" → "Import an existing project" → conecta tu
   repositorio de GitHub.
3. Netlify va a detectar solo que es un proyecto Vite (build command
   `npm run build`, publish directory `dist`) — ya está configurado en
   `netlify.toml`, no tienes que tocar nada ahí.
4. Antes de darle "Deploy", ve a **Site settings → Environment variables** y
   agrega estas dos:
   - `ANTHROPIC_API_KEY` → tu llave de console.anthropic.com
   - `OPENAI_API_KEY` → tu llave de platform.openai.com
   - `ADMIN_SECRET` → una contraseña que tú inventes (para generar códigos de acceso — ver sección "Códigos de acceso" más abajo)
   - *(Opcional)* `IMAGE_QUALITY` → `low`, `medium` o `high`. Si no la pones, usa `medium`. Más alta = foto más bonita pero cuesta más por imagen.
   - *(Opcional)* `IMAGE_MODEL` → si quieres probar otro modelo de imagen de OpenAI (por defecto `gpt-image-1-mini`).
5. Dale "Deploy site". En unos minutos tendrás un link tipo
   `algo-random.netlify.app` — ya funcional, con receta e imagen real.

## Códigos de acceso (mientras no está Supabase)

Ya está construido un sistema de códigos de un solo uso, para cuando alguien
pague por WhatsApp/Mercado Pago:

1. Toca 5 veces seguidas el texto **"by MMVL"** del encabezado de la app —
   se abre un panel oculto (solo tú sabes que existe).
2. Escribe tu contraseña de administración (la que pusiste en `ADMIN_SECRET`),
   el tipo de acceso (suscripción de 30 días o paquete de 5 recetas) y una nota para ti
   (ej. el nombre de quien pagó).
3. Te da un código de 8 letras/números — mándaselo por WhatsApp.
4. Esa persona lo escribe en la app, donde dice "¿Ya pagaste? Escribe el
   código". En cuanto lo usa, ese código queda marcado como usado **para
   siempre** — aunque lo comparta con alguien más, ya no funciona en otro
   dispositivo.

Esto usa **Netlify Blobs**, un almacenamiento simple que Netlify ya incluye
gratis — no necesitas crear ninguna cuenta aparte para esta parte.

## Paso 2 — Siguiente paso: Supabase (registro real + plan gratis a prueba de trampas)

Todavía no está construido, pero así es como se conecta cuando quieras
seguirle:

1. Crear cuenta gratis en **supabase.com** → nuevo proyecto.
2. Supabase te da automáticamente: login por correo, y una base de datos
   donde guardar, por cada usuario registrado: cuántas recetas lleva
   usadas, desde cuándo, y si tiene una suscripción activa.
3. Se reemplaza el `localStorage` del conteo del plan gratis por una
   consulta a esa base de datos — así el conteo ya no se puede burlar
   borrando datos del navegador, y se sincroniza entre dispositivos.
4. Se agrega una pantalla de "Iniciar sesión / Crear cuenta" al abrir la
   app.

## Paso 3 — Siguiente paso: Stripe (cobros reales)

1. Crear cuenta en **stripe.com** (te van a pedir datos de tu negocio para
   poder recibir pagos).
2. Se crean dos "productos" en Stripe: la suscripción mensual, y el pago
   por receta individual.
3. Se agrega una función serverless más (`crear-pago.js`) que le dice a
   Stripe "cobra $X a esta persona" y actualiza en Supabase que ya pagó.
4. Los botones "Suscribirme" y "Comprar solo esta receta" (que ya existen
   en la interfaz) se conectan a esa función en vez de solo mostrar un
   mensaje.

---

## Estructura del proyecto

```
fusion-fogon-web/
├── src/
│   ├── App.jsx              ← toda la app (el componente que ya conoces)
│   ├── main.jsx             ← punto de entrada
│   └── storagePolyfill.js   ← reemplazo de window.storage con localStorage
├── netlify/functions/
│   ├── anthropic-proxy.js   ← protege tu llave de Anthropic
│   └── generar-imagen.js    ← genera la foto del platillo (OpenAI)
├── index.html
├── package.json
├── vite.config.js
└── netlify.toml
```
