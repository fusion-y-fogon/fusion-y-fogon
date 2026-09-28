import { useState, useEffect, useRef } from "react";
import { ChefHat, Camera, Sparkles, Clock, Users, Loader2, X, Globe2, Flame, Heart, PlayCircle, PenLine, Copy, Check, Image as ImageIcon, ShoppingCart, Timer, Play, Pause, Minus, Plus, Info, RefreshCcw, Send, Printer, NotebookPen, ChefHat as ChefHatIcon, Maximize2, ArrowLeft, ArrowRight, CopyPlus, Volume2, VolumeX } from "lucide-react";

const PALETTE = {
  paper: "#F3ECDD",
  paperDark: "#E6DBBF",
  ink: "#2B1E17",
  inkSoft: "#6B5A4B",
  wine: "#5C2431",
  wineDeep: "#3D1620",
  saffron: "#D9A441",
  saffronDeep: "#B5822B",
  olive: "#6B7B4F",
  terracotta: "#B44B2C",
};

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');";

const HISTORY_KEY = "chef-recipes-history";
const FAVORITES_KEY = "chef-recipes-favorites";
const PREFS_KEY = "chef-recipes-prefs";
const NOTES_KEY = "chef-recipes-notes";
const COOKED_KEY = "chef-recipes-cooked-count";
const PLAN_KEY = "chef-recipes-plan-usage";
// Plan gratis: 10 recetas O 1 mes, lo que se cumpla primero.
// IMPORTANTE: este control vive en el navegador de cada quien (localStorage),
// así que sirve bien para tu prueba con familiares y amigos, pero alguien con
// conocimientos técnicos podría borrarlo y reiniciar su conteo. Para que sea
// a prueba de trampas de verdad, este conteo debe pasarse a Supabase (ligado
// a la cuenta de cada usuario) — ver README del proyecto.
const FREE_RECIPE_LIMIT = 10;
const FREE_DAYS_LIMIT = 30;
const UNLOCK_KEY = "chef-recipes-unlocked";
const DISHTHUMBS_KEY = "chef-recipes-dish-thumbs";
// Regla de recetas guardadas: lo guardado SIEMPRE se puede ver. Lo que se
// limita es cuántas favoritas puede guardar quien no tiene suscripción activa.
const FREE_FAVORITES_LIMIT = 10;
const SUBSCRIPTION_DAYS = 30;
const PACK_RECIPES = 5;
const MAX_DISH_THUMBS = 30;
// Cuando la app ya esté publicada en su propio dominio, cambia este link
// por el real — aparece al final de cada receta que se comparte, copia o
// imprime, como "publicidad" gratis hacia la app.
const APP_LINK = "https://fusionyfogon.app";
// Aviso de Privacidad — el nombre visible es "Fusión & Fogón" (nombre
// comercial); falta completar el correo/domicilio de contacto. El nombre
// legal y RFC quedan solo para trámites privados (SAT, banco, procesador
// de pagos), nunca se publican aquí.
const PRIVACY_NOTICE = `Responsable del tratamiento de tus datos: Fusión & Fogón, con domicilio/contacto en [CORREO PENDIENTE].

Datos que recabamos: fotos de ingredientes que subas, tus preferencias de receta, notas personales y tu historial de recetas generadas.

Para qué los usamos: crear las recetas personalizadas que pides, guardar tu historial y favoritas en tu propio dispositivo, y mejorar el funcionamiento de la app.

Con quién se comparten: las fotos e ingredientes que envías se procesan a través de Anthropic (proveedor de la tecnología de inteligencia artificial que genera las recetas), únicamente para ese fin. No vendemos ni compartimos tus datos con fines de publicidad de terceros.

Tus derechos (ARCO): puedes Acceder, Rectificar, Cancelar u Oponerte al uso de tus datos personales escribiendo a [CORREO PENDIENTE].

Cambios a este aviso: cualquier actualización se publicará en esta misma pantalla dentro de la app.`;
const MAX_HISTORY = 12;
const MAX_FAVORITES = 30;

// Palabras clave de la técnica: usa el campo corto "tecnica_busqueda" que
// genera la receta; en recetas guardadas antes de este cambio, toma las
// primeras palabras de la técnica destacada.
function techniqueKeywords(r) {
  if (r?.tecnica_busqueda && r.tecnica_busqueda.trim()) return r.tecnica_busqueda.trim();
  if (r?.tecnica_destacada) return r.tecnica_destacada.split(/\s+/).slice(0, 6).join(" ");
  return "";
}

function youtubeSearchUrl(r) {
  const query = `${techniqueKeywords(r)} técnica cocina`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function parseStepDurationSeconds(text) {
  if (!text) return null;
  let seconds = 0;
  let found = false;
  const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|h\b)/i);
  const minMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:minutos?|mins?|min\b)/i);
  if (hourMatch) { seconds += parseFloat(hourMatch[1].replace(",", ".")) * 3600; found = true; }
  if (minMatch) { seconds += parseFloat(minMatch[1].replace(",", ".")) * 60; found = true; }
  return found ? Math.round(seconds) : null;
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function scaleQuantityText(text, factor) {
  if (!text || !factor || Math.abs(factor - 1) < 0.001) return text;
  const match = text.match(/^(\d+(?:[.,]\d+)?)(\s*)(.*)$/);
  if (!match) return text;
  const num = parseFloat(match[1].replace(",", "."));
  if (Number.isNaN(num)) return text;
  const scaled = Math.round(num * factor * 100) / 100;
  const formatted = Number.isInteger(scaled) ? String(scaled) : String(scaled.toFixed(1)).replace(/\.0$/, "");
  return `${formatted}${match[2]}${match[3]}`;
}

function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function thumbFromDataUrl(dataUrl, size) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round((h * size) / w); w = size; }
      else { w = Math.round((w * size) / h); h = size; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.src = dataUrl;
  });
}

function ThumbOrFallback({ thumb, size }) {
  if (thumb) {
    return <img src={thumb} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: 10 }} />;
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10, background: "#E8DFC4",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <PenLine size={size * 0.32} color="#B5822B" strokeWidth={1.5} />
    </div>
  );
}

export default function ChefIngredientesApp() {
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [servings, setServings] = useState(2);
  const [servingsInput, setServingsInput] = useState("2");
  const [cuisinePref, setCuisinePref] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [onlyWhatIHave, setOnlyWhatIHave] = useState(false);
  const [recipeMode, setRecipeMode] = useState("autor");
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [ingredientsText, setIngredientsText] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [adjustedServings, setAdjustedServings] = useState(null);
  const [activeTimers, setActiveTimers] = useState({});
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [checkedShopping, setCheckedShopping] = useState({});
  const [showExcludeInput, setShowExcludeInput] = useState(false);
  const [excludeText, setExcludeText] = useState("");
  const [showFavoritesList, setShowFavoritesList] = useState(false);
  const [favoritesSearch, setFavoritesSearch] = useState("");
  const [ingredientHelp, setIngredientHelp] = useState(null);
  const [notes, setNotes] = useState({});
  const [cookedCounts, setCookedCounts] = useState({});
  const [cookingMode, setCookingMode] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [termQuery, setTermQuery] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [dishImage, setDishImage] = useState(null);
  const [planUsage, setPlanUsage] = useState({ count: 0, firstUsedAt: null });
  const [paywallMessage, setPaywallMessage] = useState(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [unlockInfo, setUnlockInfo] = useState(null); // { subEnd, credits, token }
  const [dishThumbs, setDishThumbs] = useState({});
  const [toast, setToast] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTaps, setAdminTaps] = useState(0);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminNota, setAdminNota] = useState("");
  const [adminTipo, setAdminTipo] = useState("suscripcion");
  const [adminResult, setAdminResult] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          const t = next[key];
          if (t.running && t.remaining > 0) {
            next[key] = { ...t, remaining: t.remaining - 1 };
            changed = true;
          } else if (t.running && t.remaining <= 0) {
            next[key] = { ...t, running: false };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (result) setAdjustedServings(result.porciones || servings);
  }, [result]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await window.storage.get(HISTORY_KEY, false);
        if (stored?.value) setHistory(JSON.parse(stored.value));
      } catch {
        setHistory([]);
      }
      try {
        const storedFav = await window.storage.get(FAVORITES_KEY, false);
        if (storedFav?.value) setFavorites(JSON.parse(storedFav.value));
      } catch {
        setFavorites([]);
      }
      try {
        const prefs = await window.storage.get(PREFS_KEY, false);
        if (prefs?.value) {
          const p = JSON.parse(prefs.value);
          if (p.servings) {
            setServings(p.servings);
            setServingsInput(String(p.servings));
          }
          if (p.cuisinePref) setCuisinePref(p.cuisinePref);
          if (p.restrictions) setRestrictions(p.restrictions);
          if (typeof p.onlyWhatIHave === "boolean") setOnlyWhatIHave(p.onlyWhatIHave);
          if (p.recipeMode === "autor" || p.recipeMode === "tradicional") setRecipeMode(p.recipeMode);
        }
      } catch {
        // no preferences saved yet
      }
      try {
        const storedNotes = await window.storage.get(NOTES_KEY, false);
        if (storedNotes?.value) setNotes(JSON.parse(storedNotes.value));
      } catch {
        setNotes({});
      }
      try {
        const storedCooked = await window.storage.get(COOKED_KEY, false);
        if (storedCooked?.value) setCookedCounts(JSON.parse(storedCooked.value));
      } catch {
        setCookedCounts({});
      }
      try {
        const storedPlan = await window.storage.get(PLAN_KEY, false);
        if (storedPlan?.value) setPlanUsage(JSON.parse(storedPlan.value));
      } catch {
        setPlanUsage({ count: 0, firstUsedAt: null });
      }
      try {
        const storedUnlock = await window.storage.get(UNLOCK_KEY, false);
        if (storedUnlock?.value) setUnlockInfo(JSON.parse(storedUnlock.value));
      } catch {
        setUnlockInfo(null);
      }
      try {
        const storedDish = await window.storage.get(DISHTHUMBS_KEY, false);
        if (storedDish?.value) setDishThumbs(JSON.parse(storedDish.value));
      } catch {
        setDishThumbs({});
      }
    })();
    try {
      document.title = "Fusión & Fogón";
    } catch {
      // el entorno no permite cambiar el título de la pestaña
    }
  }, []);

  const savePrefs = (next) => {
    window.storage.set(PREFS_KEY, JSON.stringify(next), false).catch(() => {});
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const toggleFavorite = (entry) => {
    const alreadyFav = favorites.some((f) => f.id === entry.id);
    if (!alreadyFav && !hasActiveSubscription() && favorites.length >= FREE_FAVORITES_LIMIT) {
      showToast(`Llegaste al límite de ${FREE_FAVORITES_LIMIT} favoritas gratis. Quita alguna o activa una suscripción para guardar más.`);
      return;
    }
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === entry.id);
      const next = exists ? prev.filter((f) => f.id !== entry.id) : [entry, ...prev].slice(0, MAX_FAVORITES);
      window.storage.set(FAVORITES_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const isFavorite = (id) => favorites.some((f) => f.id === id);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const previewData = await resizeImage(file, 900, 0.78);
      setPreview(previewData);
    } catch {
      setError("No pude leer esa imagen. Intenta con otra foto.");
    }
  };

  const hasActiveSubscription = () =>
    !!(unlockInfo?.subEnd && new Date(unlockInfo.subEnd).getTime() > Date.now());

  const hasPackCredits = () => (unlockInfo?.credits || 0) > 0;

  const freeTierUsedUp = () => {
    if (planUsage.count >= FREE_RECIPE_LIMIT) return true;
    if (planUsage.firstUsedAt) {
      const days = (Date.now() - new Date(planUsage.firstUsedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days >= FREE_DAYS_LIMIT) return true;
    }
    return false;
  };

  // "Agotado" = ya no puede crear recetas: se acabó lo gratis y no tiene
  // suscripción vigente ni recetas de paquete disponibles.
  const isFreeTierExhausted = () => {
    if (hasActiveSubscription() || hasPackCredits()) return false;
    return freeTierUsedUp();
  };

  const registerFreeUse = () => {
    // Si ya se acabó lo gratis y la persona usa recetas de un paquete, se
    // descuenta del paquete en vez del contador gratis.
    if (freeTierUsedUp() && !hasActiveSubscription() && hasPackCredits()) {
      const nextInfo = { ...unlockInfo, credits: unlockInfo.credits - 1 };
      setUnlockInfo(nextInfo);
      window.storage.set(UNLOCK_KEY, JSON.stringify(nextInfo), false).catch(() => {});
      return;
    }
    setPlanUsage((prev) => {
      const next = { count: prev.count + 1, firstUsedAt: prev.firstUsedAt || new Date().toISOString() };
      window.storage.set(PLAN_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  // Botones de pago: quedan listos en la interfaz, pero todavía no están
  // conectados a Stripe — por ahora solo explican qué va a pasar aquí.
  // Ver README del proyecto para el paso de conectar Stripe.
  const handleSubscribe = () => {
    setPaywallMessage("Escríbenos por WhatsApp para pagar tu suscripción — te mandamos un código de acceso para desbloquear la app.");
  };
  const handleBuyOneRecipe = () => {
    setPaywallMessage("Escríbenos por WhatsApp para comprar tu paquete de 5 recetas — te mandamos un código de acceso para desbloquear la app.");
  };

  const redeemAccessCode = async () => {
    if (!accessCodeInput.trim()) return;
    setRedeemingCode(true);
    setPaywallMessage(null);
    try {
      const response = await fetch("/.netlify/functions/canjear-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCodeInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPaywallMessage(data.error || "No se pudo validar el código.");
        return;
      }
      const now = Date.now();
      const prevInfo = unlockInfo || { subEnd: null, credits: 0 };
      const nextInfo = { ...prevInfo, token: data.token };
      if (data.tipo === "paquete") {
        nextInfo.credits = (prevInfo.credits || 0) + PACK_RECIPES;
      } else {
        // Suscripción: dura 30 días. Si renueva antes de vencer, se suman
        // los 30 días a la fecha de vencimiento actual (no pierde días).
        const currentEnd = prevInfo.subEnd ? new Date(prevInfo.subEnd).getTime() : 0;
        const base = currentEnd > now ? currentEnd : now;
        nextInfo.subEnd = new Date(base + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      }
      await window.storage.set(UNLOCK_KEY, JSON.stringify(nextInfo), false);
      setUnlockInfo(nextInfo);
      showToast(data.tipo === "paquete" ? `¡Listo! Se agregaron ${PACK_RECIPES} recetas.` : `¡Listo! Suscripción activa por ${SUBSCRIPTION_DAYS} días.`);
      setAccessCodeInput("");
      setPaywallMessage(null);
    } catch {
      setPaywallMessage("No hay conexión para validar el código. Intenta de nuevo.");
    } finally {
      setRedeemingCode(false);
    }
  };

  const generarCodigoAdmin = async () => {
    if (!adminPassword.trim()) return;
    setAdminLoading(true);
    setAdminResult(null);
    try {
      const response = await fetch("/.netlify/functions/crear-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, nota: adminNota, tipo: adminTipo }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAdminResult({ error: data.error || "No se pudo generar el código." });
        return;
      }
      setAdminResult({ codigo: data.codigo });
      setAdminNota("");
    } catch {
      setAdminResult({ error: "No hay conexión para generar el código." });
    } finally {
      setAdminLoading(false);
    }
  };

  const saveDishThumb = (id, dataUrl) => {
    setDishThumbs((prev) => {
      const next = { ...prev, [id]: dataUrl };
      const favIds = new Set(favorites.map((f) => f.id));
      const keys = Object.keys(next);
      let excess = keys.length - MAX_DISH_THUMBS;
      for (const k of keys) {
        if (excess <= 0) break;
        if (k !== id && !favIds.has(k)) { delete next[k]; excess -= 1; }
      }
      window.storage.set(DISHTHUMBS_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const generateDishImage = async (recipe, entryId) => {
    if (!recipe) return;
    setDishImage({ loading: true, error: null, base64: null });
    try {
      const ingredientes = [...(recipe.ingredientes_detectados || []), ...(recipe.ingredientes_por_comprar || [])]
        .map((i) => String(i).replace(/^\s*[\d.,\/]+\s*(g|kg|ml|l|tazas?|cucharadas?|cucharaditas?|piezas?|dientes?)?\s*(de\s+)?/i, "").trim())
        .filter(Boolean)
        .slice(0, 10)
        .join(", ");
      const prompt = `Fotografía gastronómica profesional de revista del platillo "${recipe.nombre_receta}". Ingredientes visibles: ${ingredientes}. ${recipe.tip_presentacion ? `Emplatado: ${recipe.tip_presentacion}` : ""} Vista en ángulo de 45 grados, luz cálida lateral, plato de cerámica oscura sobre superficie de piedra oscura, poca profundidad de campo, colores ricos y apetitosos. Sin texto, sin logotipos, sin personas.`;
      const response = await fetch("/.netlify/functions/generar-imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error("La función de imagen respondió con error");
      const data = await response.json();
      if (!data.base64) throw new Error("Sin imagen en la respuesta");
      setDishImage({ loading: false, error: null, base64: data.base64 });
      if (entryId) {
        try {
          const small = await thumbFromDataUrl(`data:image/png;base64,${data.base64}`, 420);
          saveDishThumb(entryId, small);
        } catch {
          // si no se puede reducir, la receta se guarda igual, solo sin foto del platillo
        }
      }
    } catch {
      setDishImage({ loading: false, error: "No se pudo generar la imagen del platillo esta vez.", base64: null });
    }
  };

  const analyze = async (extraInstruction) => {
    if (!preview && !ingredientsText.trim()) return;
    if (recipeMode === "tradicional" && !cuisinePref.trim()) {
      setError("Para una receta tradicional, primero escribe de qué cocina (ej. colombiana, mexicana...).");
      return;
    }
    if (isFreeTierExhausted()) {
      setPaywallMessage("exceeded");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      // Si es un ajuste sobre una receta que ya se generó (excluir o sustituir
      // un ingrediente), no hace falta volver a enviar la foto — ya tenemos
      // la lista de ingredientes detectados en texto, y eso es mucho más barato.
      const isRefinement = !!(extraInstruction && result);
      // La foto solo se envía si la persona la puso a propósito (se ve en
      // pantalla con su botón de quitar). Sin foto, nunca se manda imagen.
      const usePhoto = !!preview;
      const content = [];
      if (usePhoto && !isRefinement) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: preview.split(",")[1] },
        });
      }
      const ingredientsLine = isRefinement
        ? `Ingredientes disponibles (ya identificados en la receta anterior): ${(result.ingredientes_detectados || []).join(", ")}.`
        : usePhoto
          ? ingredientsText.trim()
            ? `Ingredientes visibles en la foto, más estos que el usuario escribió aparte: ${ingredientsText.trim()}.`
            : "Ingredientes visibles en la foto."
          : `El usuario no tiene foto (o eligió no usarla), escribió estos ingredientes disponibles: ${ingredientsText.trim()}.`;
      content.push({
        type: "text",
        text: `${ingredientsLine} Porciones deseadas: ${servings}. Preferencia de cocina: ${cuisinePref.trim() || "sorpréndeme, la que mejor combine"}. Restricciones o alergias: ${restrictions.trim() || "ninguna"}.${extraInstruction && extraInstruction.trim() ? ` ${extraInstruction.trim()}` : ""}`,
      });

      const response = await fetch("/.netlify/functions/anthropic-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system:
            `${recipeMode === "tradicional"
              ? `Eres un chef experto en cocina tradicional del mundo, con profundo conocimiento de recetas auténticas y sus técnicas originales. El usuario quiere una receta TRADICIONAL Y AUTÉNTICA de la cocina "${cuisinePref.trim()}" — NO inventes una fusión, NO mezcles técnicas ni sabores de otras cocinas, NO seas creativo con el concepto: da el platillo tradicional real de esa cocina que mejor se pueda preparar con lo disponible. Identifica los ingredientes disponibles (en la foto, en el texto del usuario, o ambos). Si tiene ingredientes que no son parte de esa receta tradicional, simplemente no los uses — prioriza la autenticidad sobre aprovechar todo lo que tiene. Si falta algún ingrediente esencial y típico de la receta tradicional, inclúyelo en ingredientes_por_comprar.`
              : `Eres un chef con formación de alta cocina, inspirado en chefs galardonados con estrellas Michelin y premios por técnicas de vanguardia. Identifica los ingredientes disponibles (en la foto, en el texto del usuario, o ambos) y crea UNA receta original y deliciosa que combine sabores y técnicas de distintas cocinas del mundo (italiana, marroquí, griega, colombiana, peruana, mexicana, española, francesa, suiza, u otras si el maridaje resulta mejor), priorizando la fusión de sabores más deliciosa posible con lo disponible.`
            } En ninguna parte de la receta (pasos, técnica, tip, nombre o inspiración) menciones el nombre de ningún chef, persona, restaurante o marca real — describe técnicas y estilos siempre de forma genérica (ej. "alta cocina de vanguardia", "cocina nórdica contemporánea") sin nombrar a nadie. Considera las porciones, la preferencia de cocina y las restricciones que indique el usuario si las hay. Calcula y especifica la cantidad exacta de cada ingrediente (gramos, mililitros, piezas, cucharadas, etc.) ajustada al número de porciones solicitado — nunca dejes un ingrediente sin cantidad.${onlyWhatIHave ? " IMPORTANTE: el usuario solo quiere usar lo que ya tiene — no propongas ingredientes adicionales que deba comprar, salvo sal, aceite, agua o especias básicas que casi cualquier cocina ya tiene; en ese caso ingredientes_por_comprar debe ir vacío." : ""} Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks, con exactamente estas claves: nombre_receta (string, nombre evocador del platillo${recipeMode === "tradicional" ? ", usa el nombre tradicional real del platillo" : ""}), inspiracion (string breve, ${recipeMode === "tradicional" ? "origen o historia breve del platillo tradicional — NO menciones fusión ni mezcla de cocinas" : "qué cocinas o técnicas se fusionan y por qué combinan bien"}), tiempo_total (string breve, ej '35 min'), porciones (number), ingredientes_detectados (arreglo de strings, cada uno con su cantidad exacta ajustada a las porciones, ej. '250 g de pechuga de pollo', ingredientes identificados ya sea de la foto o del texto), ingredientes_por_comprar (arreglo de strings con cantidad exacta ajustada a las porciones, ingredientes adicionales necesarios; arreglo vacío si no falta nada), pasos (arreglo de 4 a 7 strings cortos y claros, pasos de preparación), tecnica_destacada (string, 1-2 frases sobre una técnica ${recipeMode === "tradicional" ? "tradicional y auténtica de esa cocina" : "de alta cocina o vanguardia"} que se usa y por qué eleva el platillo — descríbela de forma genérica, por ejemplo "una técnica de sellado usada en la alta cocina de vanguardia"; NO menciones el nombre de ningún chef, persona o restaurante real, ni real ni inventado, bajo ninguna circunstancia), tip_presentacion (string, 1 frase sobre cómo emplatar o servir, tampoco menciones nombres de chefs o personas reales), tecnica_busqueda (string de 2 a 5 palabras en español para buscar en YouTube cómo se hace la técnica destacada, ej. "sellar carne en sartén caliente" o "emulsionar una vinagreta"; SOLO la técnica, sin el nombre del platillo ni de personas), terminos_tecnicos (arreglo de 0 a 5 objetos {termino, significado} — SOLO para palabras de jerga de chef que usaste en tecnica_destacada, tip_presentacion o pasos que una persona sin formación culinaria (ej. un ama de casa o alguien de servicio doméstico) probablemente no entienda, como "quenelle", "reacción de Maillard", "emulsionar", "blanquear", "desglasar", nombres de chefs, técnicas francesas, etc. — el campo "termino" debe ser exactamente la palabra o frase tal como aparece en el texto (para poder resaltarla), y "significado" una explicación de 1 frase en español sencillo y cotidiano, sin más jerga; si no usaste ningún término difícil, deja el arreglo vacío).`,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await response.json();
      const textBlock = data?.content?.find((b) => b.type === "text")?.text || "";
      let cleaned = textBlock.replace(/```json|```/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(cleaned);
      const entryId = `${Date.now()}`;
      setResult(parsed);
      generateDishImage(parsed, entryId);
      registerFreeUse();

      const thumb = preview ? await thumbFromDataUrl(preview, 160) : null;
      const entry = { id: entryId, date: new Date().toISOString(), thumb, result: parsed };
      setCurrentEntryId(entry.id);
      const next = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      window.storage.set(HISTORY_KEY, JSON.stringify(next), false).catch(() => {});
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("La receta se generó incompleta. Intenta de nuevo.");
      } else if (err instanceof TypeError) {
        setError("No hay conexión con el servicio. Revisa tu internet e intenta de nuevo.");
      } else {
        setError("No se pudo crear la receta. Intenta de nuevo en un momento.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const removePhoto = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reset = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPreview(null);
    setIngredientsText("");
    setResult(null);
    setDishImage(null);
    setError(null);
    setCurrentEntryId(null);
    setShowExcludeInput(false);
    setExcludeText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const commitServings = (raw) => {
    if (raw === "" || Number.isNaN(Number(raw))) {
      setServingsInput(String(servings));
      return;
    }
    const clamped = Math.max(1, Math.min(12, Number(raw)));
    setServings(clamped);
    setServingsInput(String(clamped));
    savePrefs({ servings: clamped, cuisinePref, restrictions, onlyWhatIHave, recipeMode });
  };

  const buildRecipeText = (r) => {
    if (!r) return "";
    const lines = [];
    lines.push(r.nombre_receta || "Receta");
    if (r.inspiracion) lines.push(r.inspiracion);
    lines.push("");
    const meta = [r.tiempo_total, r.porciones ? `${r.porciones} porciones` : null].filter(Boolean).join(" · ");
    if (meta) lines.push(meta);
    if (r.ingredientes_detectados?.length) {
      lines.push("");
      lines.push("Ingredientes:");
      r.ingredientes_detectados.forEach((ing) => lines.push(`- ${ing}`));
    }
    if (r.ingredientes_por_comprar?.length) {
      lines.push("");
      lines.push("Necesitas conseguir:");
      r.ingredientes_por_comprar.forEach((ing) => lines.push(`- ${ing}`));
    }
    if (r.pasos?.length) {
      lines.push("");
      lines.push("Preparación paso a paso:");
      r.pasos.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    }
    if (r.tecnica_destacada) {
      lines.push("");
      lines.push(`Técnica: ${r.tecnica_destacada}`);
    }
    if (r.tip_presentacion) {
      lines.push("");
      lines.push(`Tip: ${r.tip_presentacion}`);
    }
    lines.push("");
    lines.push("—");
    lines.push(`Hecha con Fusión & Fogón 🍳 Crea la tuya en ${APP_LINK}`);
    return lines.join("\n");
  };

  const buildSpokenText = (r) => {
    if (!r) return "";
    const parts = [];
    parts.push(r.nombre_receta || "Receta");
    if (r.inspiracion) parts.push(r.inspiracion);
    if (r.ingredientes_detectados?.length) {
      parts.push("Ingredientes: " + r.ingredientes_detectados.join(", ") + ".");
    }
    if (r.pasos?.length) {
      parts.push("Preparación. " + r.pasos.map((p, i) => `Paso ${i + 1}: ${p}`).join(" "));
    }
    if (r.tip_presentacion) parts.push("Tip: " + r.tip_presentacion);
    return parts.join(" ");
  };

  const speakRecipe = (r) => {
    if (!("speechSynthesis" in window)) {
      setError("Tu navegador no soporta lectura en voz alta.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildSpokenText(r));
    utterance.lang = "es-MX";
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const copyRecipe = async (r, id) => {
    const text = buildRecipeText(r);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2500);
      return;
    } catch {
      // el navegador bloqueó el portapapeles moderno, probamos el método de respaldo
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        setCopiedId(id);
        setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2500);
        return;
      }
      throw new Error("execCommand falló");
    } catch {
      setError("Tu navegador no permitió copiar aquí. Usa el botón de WhatsApp para enviarla directo.");
    }
  };

  const shareWhatsApp = (r) => {
    const text = buildRecipeText(r);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const escapeHtmlText = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const printStylesAndWatermark = `
    @page { margin: 28px; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #2B1E17; margin: 0; position: relative; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 0 24px 40px; position: relative; z-index: 1; }
    .watermark {
      position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
      display: flex; flex-wrap: wrap; align-content: space-around; justify-content: space-around;
      transform: rotate(-28deg) scale(1.4); opacity: 0.06;
    }
    .watermark span { font-family: Georgia, serif; font-size: 26px; font-weight: bold; color: #5C2431; white-space: nowrap; margin: 22px 30px; }
    .brandbar { background: #3D1620; color: #F3ECDD; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .brandbar .name { font-size: 20px; font-weight: bold; margin: 0; }
    .brandbar .name em { color: #D9A441; font-style: italic; }
    .brandbar .badge { font-size: 11px; background: #D9A441; color: #3D1620; padding: 3px 9px; border-radius: 999px; font-weight: bold; letter-spacing: 0.5px; }
    h2.recipe-title { font-size: 22px; margin: 22px 0 4px; color: #2B1E17; }
    .meta { color: #6B5A4B; font-size: 13px; margin: 0 0 16px; }
    h3.section { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #B44B2C; margin: 20px 0 8px; }
    ul, ol { margin: 0; padding-left: 20px; }
    li { margin-bottom: 6px; line-height: 1.5; }
    .note { font-style: italic; color: #6B5A4B; margin-top: 14px; }
    .footer-link { margin-top: 28px; padding-top: 14px; border-top: 1px solid #E6DBBF; font-size: 12px; color: #6B5A4B; }
    hr.divider { border: none; border-top: 1px dashed #D8C4AE; margin: 34px 0; }
  `;

  const watermarkHtml = () =>
    `<div class="watermark">${Array.from({ length: 30 }).map(() => "<span>Fusión & Fogón</span>").join("")}</div>`;

  const brandBarHtml = () =>
    `<div class="brandbar"><p class="name">Fusión <em>&amp;</em> Fogón</p><span class="badge">MMVL</span></div>`;

  const recipeBodyHtml = (r) => {
    if (!r) return "";
    const meta = [r.tiempo_total, r.porciones ? `${r.porciones} porciones` : null].filter(Boolean).join(" · ");
    let html = `<h2 class="recipe-title">${escapeHtmlText(r.nombre_receta)}</h2>`;
    if (r.inspiracion) html += `<p class="meta" style="font-style:italic;">${escapeHtmlText(r.inspiracion)}</p>`;
    if (meta) html += `<p class="meta">${escapeHtmlText(meta)}</p>`;
    if (r.ingredientes_detectados?.length) {
      html += `<h3 class="section">Ingredientes</h3><ul>${r.ingredientes_detectados.map((i) => `<li>${escapeHtmlText(i)}</li>`).join("")}</ul>`;
    }
    if (r.ingredientes_por_comprar?.length) {
      html += `<h3 class="section">Necesitas conseguir</h3><ul>${r.ingredientes_por_comprar.map((i) => `<li>${escapeHtmlText(i)}</li>`).join("")}</ul>`;
    }
    if (r.pasos?.length) {
      html += `<h3 class="section">Preparación paso a paso</h3><ol>${r.pasos.map((p) => `<li>${escapeHtmlText(p)}</li>`).join("")}</ol>`;
    }
    if (r.tecnica_destacada) html += `<p class="note">Técnica: ${escapeHtmlText(r.tecnica_destacada)}</p>`;
    if (r.tip_presentacion) html += `<p class="note">Tip: ${escapeHtmlText(r.tip_presentacion)}</p>`;
    return html;
  };

  const printRecipe = (r) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlText(r?.nombre_receta || "Receta")}</title>
      <style>${printStylesAndWatermark}</style></head>
      <body>${watermarkHtml()}${brandBarHtml()}<div class="wrap">${recipeBodyHtml(r)}
      <div class="footer-link">Hecha con Fusión &amp; Fogón · ${escapeHtmlText(APP_LINK)}</div></div>
      <script>window.onload=function(){window.print();}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) setError("Tu navegador bloqueó la ventana de impresión. Prueba copiar la receta o enviarla por WhatsApp.");
  };

  const saveNote = (entryId, text) => {
    setNotes((prev) => {
      const next = { ...prev, [entryId]: text };
      window.storage.set(NOTES_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const markCooked = (entryId) => {
    setCookedCounts((prev) => {
      const next = { ...prev, [entryId]: (prev[entryId] || 0) + 1 };
      window.storage.set(COOKED_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };

  const duplicateAndAdjust = (entry) => {
    const list = entry.result?.ingredientes_detectados || [];
    setPreview(null);
    setIngredientsText(list.join(", "));
    setResult(null);
    setCurrentEntryId(null);
    setError(null);
    setSelectedHistoryItem(null);
    setShowFavoritesList(false);
  };

  const printAllFavorites = () => {
    const body = favorites.map((f) => recipeBodyHtml(f.result)).join('<hr class="divider"/>');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recetario · Fusión & Fogón</title>
      <style>${printStylesAndWatermark}</style></head>
      <body>${watermarkHtml()}${brandBarHtml()}<div class="wrap"><p class="meta" style="margin-top:20px;">Mi recetario personal</p>${body}
      <div class="footer-link">Hecho con Fusión &amp; Fogón · ${escapeHtmlText(APP_LINK)}</div></div>
      <script>window.onload=function(){window.print();}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) setError("Tu navegador bloqueó la ventana. Intenta de nuevo o revisa el bloqueador de ventanas emergentes.");
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  const scalingFactor = result ? (adjustedServings || result.porciones || servings) / (result.porciones || servings) : 1;

  const getScaledResult = (r) => {
    if (!r) return r;
    const base = r.porciones || servings;
    const target = adjustedServings || base;
    if (!target || Math.abs(target - base) < 0.001) return r;
    const factor = target / base;
    return {
      ...r,
      porciones: target,
      ingredientes_detectados: (r.ingredientes_detectados || []).map((x) => scaleQuantityText(x, factor)),
      ingredientes_por_comprar: (r.ingredientes_por_comprar || []).map((x) => scaleQuantityText(x, factor)),
    };
  };

  const toggleStepTimer = (key, totalSeconds) => {
    setActiveTimers((prev) => {
      const existing = prev[key];
      if (existing && existing.running) {
        return { ...prev, [key]: { ...existing, running: false } };
      }
      const remaining = existing && existing.remaining > 0 ? existing.remaining : totalSeconds;
      return { ...prev, [key]: { remaining, total: totalSeconds, running: true } };
    });
  };

  const resetStepTimer = (key, totalSeconds) => {
    setActiveTimers((prev) => ({ ...prev, [key]: { remaining: totalSeconds, total: totalSeconds, running: false } }));
  };

  const buildShoppingList = () => {
    const seen = new Map();
    history.forEach((h) => {
      (h.result?.ingredientes_por_comprar || []).forEach((item) => {
        if (!seen.has(item)) seen.set(item, []);
        const names = seen.get(item);
        const name = h.result?.nombre_receta || "Receta";
        if (!names.includes(name)) names.push(name);
      });
    });
    return Array.from(seen.entries()).map(([item, recipes]) => ({ item, recipes }));
  };

  const explainIngredient = async (term) => {
    setIngredientHelp({ name: term, loading: true, error: null, explicacion: null, sustitutos: [] });
    try {
      const response = await fetch("/.netlify/functions/anthropic-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: `Eres un chef que le explica a alguien sin formación culinaria (puede ser un ama de casa o una persona de servicio doméstico que nunca ha ido a la escuela de cocina). El usuario tiene la receta "${result?.nombre_receta || ""}" y no entiende esta palabra o frase: "${term}". Puede ser un ingrediente, una técnica, un utensilio o un término de chef. Explica en máximo 2 frases, en español muy sencillo y cotidiano, sin usar más jerga de cocina, qué significa o qué es. Si es un INGREDIENTE, sugiere exactamente 3 sustitutos comunes y fáciles de conseguir que funcionen en esta receta. Si es una TÉCNICA, utensilio, o término (no un ingrediente), deja el arreglo de sustitutos vacío. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown: {"explicacion": string, "sustitutos": [string, string, string]}.`,
          messages: [{ role: "user", content: [{ type: "text", text: `Palabra o frase: ${term}` }] }],
        }),
      });
      const data = await response.json();
      const textBlock = data?.content?.find((b) => b.type === "text")?.text || "";
      let cleaned = textBlock.replace(/```json|```/g, "").trim();
      const fb = cleaned.indexOf("{");
      const lb = cleaned.lastIndexOf("}");
      if (fb !== -1 && lb !== -1 && lb > fb) cleaned = cleaned.slice(fb, lb + 1);
      const parsed = JSON.parse(cleaned);
      setIngredientHelp({ name: term, loading: false, error: null, explicacion: parsed.explicacion, sustitutos: parsed.sustitutos || [] });
    } catch {
      setIngredientHelp({ name: term, loading: false, error: "No pude buscar información de esto. Intenta de nuevo.", explicacion: null, sustitutos: [] });
    }
  };

  const showKnownTerm = (termino, significado) => {
    setIngredientHelp({ name: termino, loading: false, error: null, explicacion: significado, sustitutos: [] });
  };

  const substituteIngredient = async (original, replacement) => {
    setIngredientHelp(null);
    await analyze(`El usuario quiere sustituir "${original}" por "${replacement}" en esta receta. Ajusta la receta con ese cambio, manteniendo el resto de los ingredientes y pasos lo más parecido posible.`);
  };

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", background: "transparent" }}>
      <style>{FONT_IMPORT}</style>
      <div
        style={{
          background: PALETTE.paper,
          borderRadius: 20,
          overflow: "hidden",
          maxWidth: 480,
          margin: "0 auto",
          border: `1px solid ${PALETTE.paperDark}`,
        }}
      >
        {/* Header */}
        <div style={{ background: PALETTE.wineDeep, padding: "28px 20px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <ChefHat size={24} color={PALETTE.saffron} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 28,
                fontWeight: 600,
                color: PALETTE.paper,
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Fusión <span style={{ fontStyle: "italic", fontWeight: 500, color: PALETTE.saffron }}>&</span> Fogón
            </h1>
          </div>
          <p
            onClick={() => {
              setAdminTaps((n) => {
                const next = n + 1;
                if (next >= 5) { setShowAdmin(true); return 0; }
                return next;
              });
            }}
            style={{
              color: PALETTE.saffron, fontSize: 12, margin: "6px 0 0",
              letterSpacing: "2px", textTransform: "uppercase", fontWeight: 500, cursor: "default",
            }}
          >
            by MMVL
          </p>
          <div
            style={{
              background: PALETTE.paper,
              border: `1.5px solid ${PALETTE.saffron}`,
              borderRadius: 12,
              padding: "11px 16px",
              margin: "16px auto 0",
              maxWidth: 340,
              boxShadow: "0 0 0 3px rgba(217,164,65,0.18)",
            }}
          >
            <p
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: "italic",
                fontSize: 15,
                fontWeight: 500,
                color: PALETTE.wine,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Una receta de autor, fusión de sabores del mundo
            </p>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {favorites.length > 0 && (
            <button
              onClick={() => setShowFavoritesList(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
                background: "#F1E4CE", border: `1.3px solid ${PALETTE.saffronDeep}`, borderRadius: 12,
                padding: "11px 0", fontSize: 13, color: PALETTE.wine, fontWeight: 500, cursor: "pointer", marginBottom: 16,
              }}
            >
              <Heart size={15} color={PALETTE.terracotta} fill={PALETTE.terracotta} /> ¿Buscas una receta que ya te gustó? Ver mis favoritas
            </button>
          )}

          {/* Preferences */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, marginBottom: 5 }}>
                <Users size={12} color={PALETTE.terracotta} /> Porciones
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={servingsInput}
                onChange={(e) => setServingsInput(e.target.value)}
                onBlur={(e) => commitServings(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{
                  width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                  borderRadius: 10, padding: "9px 10px", fontSize: 15, color: PALETTE.ink,
                  background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif",
                }}
              />
            </div>
          </div>

          <label
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              marginBottom: 12, cursor: "pointer", background: "#FBF3E4", borderRadius: 10, padding: "9px 12px",
            }}
          >
            <span style={{ fontSize: 13, color: PALETTE.ink }}>Solo con lo que tengo (no comprar nada más)</span>
            <span
              onClick={() => {
                const v = !onlyWhatIHave;
                setOnlyWhatIHave(v);
                savePrefs({ servings, cuisinePref, restrictions, onlyWhatIHave: v, recipeMode });
              }}
              style={{
                width: 38, height: 22, borderRadius: 999, flexShrink: 0,
                background: onlyWhatIHave ? PALETTE.olive : PALETTE.paperDark,
                position: "relative", transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 2, left: onlyWhatIHave ? 18 : 2,
                  width: 18, height: 18, borderRadius: 999, background: "#fff",
                  transition: "left 0.15s",
                }}
              />
            </span>
          </label>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, marginBottom: 5 }}>
              Tipo de receta
            </label>
            <div style={{ display: "flex", gap: 4, background: "#EBE0C4", borderRadius: 10, padding: 3 }}>
              <button
                onClick={() => { setRecipeMode("autor"); savePrefs({ servings, cuisinePref, restrictions, onlyWhatIHave, recipeMode: "autor" }); }}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: recipeMode === "autor" ? PALETTE.wine : "transparent",
                  color: recipeMode === "autor" ? PALETTE.paper : PALETTE.inkSoft,
                  fontSize: 13, fontWeight: 500,
                }}
              >
                Receta de autor (fusión)
              </button>
              <button
                onClick={() => { setRecipeMode("tradicional"); savePrefs({ servings, cuisinePref, restrictions, onlyWhatIHave, recipeMode: "tradicional" }); }}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: recipeMode === "tradicional" ? PALETTE.wine : "transparent",
                  color: recipeMode === "tradicional" ? PALETTE.paper : PALETTE.inkSoft,
                  fontSize: 13, fontWeight: 500,
                }}
              >
                Receta tradicional
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, marginBottom: 5 }}>
              <Globe2 size={12} color={PALETTE.terracotta} />
              {recipeMode === "tradicional" ? "¿De qué cocina quieres la receta tradicional? (requerido)" : "¿Se te antoja alguna cocina? (opcional)"}
            </label>
            <input
              type="text"
              value={cuisinePref}
              onChange={(e) => { setCuisinePref(e.target.value); savePrefs({ servings, cuisinePref: e.target.value, restrictions, onlyWhatIHave, recipeMode }); }}
              placeholder={recipeMode === "tradicional" ? "ej. colombiana, mexicana, italiana..." : "ej. marroquí, peruana... o déjalo vacío y sorpréndeme"}
              style={{
                width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                borderRadius: 10, padding: "9px 10px", fontSize: 13, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif",
              }}
            />
            {recipeMode === "tradicional" && (
              <p style={{ fontSize: 11, color: PALETTE.inkSoft, margin: "5px 0 0" }}>
                La receta será auténtica de esa cocina, sin mezclar técnicas ni sabores de otras.
              </p>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, marginBottom: 5 }}>
              Restricciones o alergias (opcional)
            </label>
            <input
              type="text"
              value={restrictions}
              onChange={(e) => { setRestrictions(e.target.value); savePrefs({ servings, cuisinePref, restrictions: e.target.value, onlyWhatIHave, recipeMode }); }}
              placeholder="ej. sin gluten, vegetariano..."
              style={{
                width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                borderRadius: 10, padding: "9px 10px", fontSize: 13, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif",
              }}
            />
          </div>

          {/* Ingredientes: escribir es lo principal; la foto es opcional */}
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="ingredientes-texto"
              style={{ display: "block", fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: PALETTE.ink, marginBottom: 2, letterSpacing: "-0.2px" }}
            >
              ¿Qué ingredientes tienes?
            </label>
            <p style={{ fontSize: 12, color: PALETTE.inkSoft, margin: "0 0 8px", lineHeight: 1.4 }}>
              Escribe aquí lo que hay en tu cocina, separado por comas.
            </p>
            <textarea
              id="ingredientes-texto"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="ej. pechuga de pollo, arroz, cebolla, pimiento rojo, yogurt natural..."
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", border: `1.5px solid ${PALETTE.saffronDeep}`,
                borderRadius: 12, padding: "12px 14px", fontSize: 15, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", resize: "vertical", lineHeight: 1.45,
              }}
            />
          </div>

          {!preview ? (
            <label
              htmlFor="ingredients-photo-input"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: `1.3px dashed ${PALETTE.terracotta}`, borderRadius: 12, padding: "11px 12px",
                cursor: "pointer", background: "#FBF3E4", fontSize: 13, color: PALETTE.wine, fontWeight: 500, textAlign: "center",
              }}
            >
              <Camera size={17} color={PALETTE.saffronDeep} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              ¿Prefieres tomar una foto de tus ingredientes?
              <input
                id="ingredients-photo-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </label>
          ) : (
            <div>
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                <img src={preview} alt="Ingredientes" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover" }} />
                {!analyzing && (
                  <button
                    onClick={removePhoto}
                    style={{
                      position: "absolute", top: 8, right: 8, background: "rgba(61,22,32,0.75)",
                      border: "none", borderRadius: 999, width: 30, height: 30, display: "flex",
                      alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}
                    aria-label="Quitar foto"
                  >
                    <X size={16} color="#fff" />
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: PALETTE.inkSoft, margin: "6px 0 0", textAlign: "center" }}>
                La foto se enviará junto con lo que escribiste. Toca la X para quitarla.
              </p>
            </div>
          )}

          {(preview || ingredientsText.trim()) && !result && !isFreeTierExhausted() && (
            <button
              onClick={() => analyze()}
              disabled={analyzing}
              style={{
                marginTop: 14, width: "100%", background: analyzing ? PALETTE.inkSoft : PALETTE.wine,
                color: PALETTE.paper, border: "none", borderRadius: 12, padding: "13px 0",
                fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8, cursor: analyzing ? "default" : "pointer",
              }}
            >
              {analyzing ? (<><Loader2 size={17} className="animate-spin" /> Creando receta...</>) : (<><Sparkles size={16} /> Crear receta</>)}
            </button>
          )}

          {(preview || ingredientsText.trim()) && !result && !isFreeTierExhausted() && (
            <p style={{ fontSize: 11, color: PALETTE.inkSoft, textAlign: "center", margin: "8px 0 0" }}>
              Te quedan {Math.max(0, FREE_RECIPE_LIMIT - planUsage.count)} recetas gratis este mes · Verifica siempre la cocción y temperatura de los alimentos antes de consumirlos.
            </p>
          )}

          {(preview || ingredientsText.trim()) && !result && isFreeTierExhausted() && (
            <div style={{ marginTop: 14, background: "#F1E4CE", borderRadius: 14, padding: 18, textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: PALETTE.ink, margin: "0 0 4px" }}>Se acabaron tus recetas gratis</p>
              <p style={{ fontSize: 12.5, color: PALETTE.inkSoft, margin: "0 0 14px" }}>Elige cómo quieres seguir creando recetas:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={handleSubscribe} style={{ background: PALETTE.wine, color: PALETTE.paper, border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
                  Suscribirme por mes
                </button>
                <button onClick={handleBuyOneRecipe} style={{ background: "transparent", color: PALETTE.wine, border: `1.3px solid ${PALETTE.wine}`, borderRadius: 10, padding: "11px 0", fontSize: 13.5, cursor: "pointer" }}>
                  Comprar 5 recetas sueltas
                </button>
              </div>
              {paywallMessage && paywallMessage !== "exceeded" && (
                <p style={{ fontSize: 11.5, color: PALETTE.inkSoft, fontStyle: "italic", margin: "12px 0 0" }}>{paywallMessage}</p>
              )}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${PALETTE.paperDark}` }}>
                <p style={{ fontSize: 11.5, color: PALETTE.inkSoft, margin: "0 0 8px" }}>¿Ya pagaste? Escribe el código que te mandaron:</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") redeemAccessCode(); }}
                    placeholder="ej. 7X4K9PQR"
                    disabled={redeemingCode}
                    style={{
                      flex: 1, boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                      borderRadius: 10, padding: "8px 10px", fontSize: 13, color: PALETTE.ink,
                      background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", textTransform: "uppercase",
                    }}
                  />
                  <button
                    onClick={redeemAccessCode}
                    disabled={redeemingCode || !accessCodeInput.trim()}
                    style={{ background: PALETTE.olive, color: PALETTE.paper, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13, cursor: redeemingCode ? "default" : "pointer" }}
                  >
                    {redeemingCode ? <Loader2 size={14} className="animate-spin" /> : "Entrar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <p style={{ color: PALETTE.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}

          {/* Result */}
          {result && (
            <div style={{ marginTop: 16 }}>
              {analyzing && (
                <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: PALETTE.inkSoft, margin: "0 0 8px" }}>
                  <Loader2 size={13} className="animate-spin" /> Ajustando tu receta...
                </p>
              )}
              {(dishImage?.loading || dishImage?.base64) && (
                <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 12, background: "#E8DFC4", aspectRatio: "4 / 3", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {dishImage.loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: PALETTE.inkSoft, fontSize: 12 }}>
                      <Loader2 size={20} className="animate-spin" /> Generando imagen del platillo... (tarda unos segundos)
                    </div>
                  ) : (
                    <>
                      <img src={`data:image/png;base64,${dishImage.base64}`} alt={result.nombre_receta} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <span style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(61,22,32,0.72)", color: PALETTE.paper, fontSize: 11, padding: "3px 9px", borderRadius: 999 }}>
                        Imagen ilustrativa
                      </span>
                    </>
                  )}
                </div>
              )}
              {dishImage?.error && (
                <p style={{ fontSize: 12, color: PALETTE.inkSoft, fontStyle: "italic", margin: "0 0 10px" }}>{dishImage.error}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: PALETTE.ink, margin: "0 0 4px", letterSpacing: "-0.2px" }}>
                  {result.nombre_receta}
                </h2>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => (speaking ? stopSpeaking() : speakRecipe(getScaledResult(result)))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    aria-label={speaking ? "Detener lectura" : "Escuchar receta"}
                  >
                    {speaking ? <VolumeX size={18} color={PALETTE.terracotta} /> : <Volume2 size={18} color={PALETTE.wine} />}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(getScaledResult(result))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    aria-label="Enviar por WhatsApp"
                  >
                    <Send size={18} color={PALETTE.olive} />
                  </button>
                  <button
                    onClick={() => printRecipe(getScaledResult(result))}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    aria-label="Imprimir receta"
                  >
                    <Printer size={18} color={PALETTE.wine} />
                  </button>
                  <button
                    onClick={() => copyRecipe(getScaledResult(result), currentEntryId || "current")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    aria-label="Copiar receta"
                  >
                    {copiedId === (currentEntryId || "current") ? (
                      <Check size={20} color={PALETTE.olive} />
                    ) : (
                      <Copy size={20} color={PALETTE.wine} />
                    )}
                  </button>
                  <button
                    onClick={() => currentEntryId && toggleFavorite({ id: currentEntryId, date: new Date().toISOString(), thumb: (history.find((h) => h.id === currentEntryId) || {}).thumb || null, result })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    aria-label="Marcar como favorita"
                  >
                    <Heart
                      size={22}
                      color={PALETTE.terracotta}
                      fill={currentEntryId && isFavorite(currentEntryId) ? PALETTE.terracotta : "none"}
                    />
                  </button>
                </div>
              </div>
              {copiedId === (currentEntryId || "current") && (
                <p style={{ fontSize: 12, color: PALETTE.olive, margin: "0 0 8px" }}>Receta copiada, ya la puedes pegar y enviar.</p>
              )}
              {result.inspiracion && (
                <p style={{ fontSize: 13, color: PALETTE.wine, fontStyle: "italic", margin: "0 0 10px" }}>
                  {result.inspiracion}
                </p>
              )}

              <div style={{ marginBottom: 12 }}>
                <a
                  href={youtubeSearchUrl(result)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
                    color: PALETTE.wine, textDecoration: "none",
                    border: `1.3px solid ${PALETTE.wine}`, borderRadius: 999, padding: "6px 14px",
                  }}
                >
                  <PlayCircle size={15} /> Ver la técnica en YouTube
                </a>
                <p style={{ fontSize: 12, color: PALETTE.inkSoft, margin: "6px 0 0", lineHeight: 1.4 }}>
                  {techniqueKeywords(result) ? <>Técnica: <b style={{ fontWeight: 500 }}>{techniqueKeywords(result)}</b>. </> : null}
                  Son videos de la técnica, no de esta receta exacta.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
                {result.tiempo_total && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: PALETTE.inkSoft }}>
                    <Clock size={13} color={PALETTE.terracotta} /> {result.tiempo_total}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: PALETTE.inkSoft }}>
                  <Users size={13} color={PALETTE.terracotta} />
                  <button
                    onClick={() => setAdjustedServings((s) => Math.max(1, (s || result.porciones || 1) - 1))}
                    style={{ background: "#E8E1CC", border: "none", borderRadius: 999, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    aria-label="Menos porciones"
                  >
                    <Minus size={11} color={PALETTE.ink} />
                  </button>
                  <span style={{ minWidth: 14, textAlign: "center" }}>{adjustedServings || result.porciones}</span>
                  <button
                    onClick={() => setAdjustedServings((s) => Math.min(24, (s || result.porciones || 1) + 1))}
                    style={{ background: "#E8E1CC", border: "none", borderRadius: 999, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    aria-label="Más porciones"
                  >
                    <Plus size={11} color={PALETTE.ink} />
                  </button>
                  <span>porciones</span>
                </span>
              </div>
              {adjustedServings && result.porciones && adjustedServings !== result.porciones && (
                <p style={{ fontSize: 12, color: PALETTE.inkSoft, fontStyle: "italic", margin: "-6px 0 12px" }}>
                  Cantidades recalculadas de {result.porciones} a {adjustedServings} porciones (aproximado).
                </p>
              )}

              {result.ingredientes_detectados?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: "0 0 5px" }}>
                    Ingredientes identificados <span style={{ fontWeight: 400, color: PALETTE.inkSoft }}>· toca uno si no sabes qué es</span>
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.ingredientes_detectados.map((ing, i) => {
                      const scaled = scaleQuantityText(ing, scalingFactor);
                      return (
                        <button
                          key={i}
                          onClick={() => explainIngredient(scaled)}
                          style={{ background: "#E8E1CC", color: PALETTE.ink, fontSize: 12, padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {scaled} <Info size={10} color={PALETTE.inkSoft} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {result.ingredientes_por_comprar?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: "0 0 5px" }}>
                    Necesitarás conseguir <span style={{ fontWeight: 400, color: PALETTE.inkSoft }}>· toca uno si no sabes qué es</span>
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    {result.ingredientes_por_comprar.map((ing, i) => {
                      const scaled = scaleQuantityText(ing, scalingFactor);
                      return (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <button
                            onClick={() => explainIngredient(scaled)}
                            style={{
                              background: "none", border: "none", padding: 0, cursor: "pointer",
                              fontSize: 13, color: PALETTE.ink, display: "flex", alignItems: "center", gap: 5, textAlign: "left",
                            }}
                          >
                            <span style={{ color: PALETTE.terracotta }}>•</span> {scaled} <Info size={11} color={PALETTE.inkSoft} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {result.pasos?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: 0 }}>Preparación paso a paso</p>
                    <button
                      onClick={() => setCookingMode({ pasos: result.pasos, nombre: result.nombre_receta, step: 0 })}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, background: "#F1E4CE", border: "none",
                        borderRadius: 999, padding: "4px 10px", fontSize: 11, color: PALETTE.wine, cursor: "pointer",
                      }}
                    >
                      <Maximize2 size={11} /> Modo cocina
                    </button>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {result.pasos.map((p, i) => {
                      const duration = parseStepDurationSeconds(p);
                      const key = `${currentEntryId || "current"}-${i}`;
                      const timer = activeTimers[key];
                      return (
                        <li key={i} style={{ fontSize: 13, color: PALETTE.ink, marginBottom: 8 }}>
                          <div>{p}</div>
                          {duration && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <button
                                onClick={() => toggleStepTimer(key, duration)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 5, background: "#F1E4CE",
                                  border: "none", borderRadius: 999, padding: "3px 10px", fontSize: 12,
                                  color: PALETTE.terracotta, cursor: "pointer",
                                }}
                              >
                                {timer?.running ? <Pause size={12} /> : <Play size={12} />}
                                <Timer size={12} />
                                {formatTimer(timer ? timer.remaining : duration)}
                              </button>
                              {timer && timer.remaining !== timer.total && (
                                <button
                                  onClick={() => resetStepTimer(key, duration)}
                                  style={{ background: "none", border: "none", color: PALETTE.inkSoft, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}
                                >
                                  Reiniciar
                                </button>
                              )}
                              {timer && timer.remaining === 0 && (
                                <span style={{ fontSize: 12, color: PALETTE.olive, fontWeight: 500 }}>¡Listo!</span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {result.tecnica_destacada && (
                <div style={{ background: "#F1E4CE", borderRadius: 10, padding: "10px 12px", marginBottom: 10, display: "flex", gap: 8 }}>
                  <Flame size={15} color={PALETTE.terracotta} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: PALETTE.ink, margin: 0 }}>{result.tecnica_destacada}</p>
                </div>
              )}

              {result.tip_presentacion && (
                <p style={{ fontSize: 13, color: PALETTE.inkSoft, fontStyle: "italic", margin: "0 0 10px" }}>
                  ✦ {result.tip_presentacion}
                </p>
              )}

              {result.terminos_tecnicos?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 12, color: PALETTE.inkSoft, margin: "0 0 6px" }}>¿No entendiste alguna palabra? Toca una:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.terminos_tecnicos.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => showKnownTerm(t.termino, t.significado)}
                        style={{ background: "#F1E4CE", color: PALETTE.wine, fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        {t.termino} <Info size={10} color={PALETTE.wine} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: PALETTE.inkSoft, display: "block", marginBottom: 5 }}>
                  ¿Otra palabra que no entendiste? Escríbela:
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={termQuery}
                    onChange={(e) => setTermQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && termQuery.trim()) { explainIngredient(termQuery.trim()); setTermQuery(""); } }}
                    placeholder="ej. quenelle, desglasar..."
                    style={{
                      flex: 1, boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                      borderRadius: 10, padding: "8px 10px", fontSize: 13, color: PALETTE.ink,
                      background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={() => { if (termQuery.trim()) { explainIngredient(termQuery.trim()); setTermQuery(""); } }}
                    style={{ background: PALETTE.wine, color: PALETTE.paper, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13, cursor: "pointer" }}
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {currentEntryId && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: 0 }}>
                      <NotebookPen size={12} color={PALETTE.terracotta} /> Mis notas
                    </p>
                    <button
                      onClick={() => markCooked(currentEntryId)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, background: "#E7EFDD", border: "none",
                        borderRadius: 999, padding: "4px 10px", fontSize: 11, color: PALETTE.olive, cursor: "pointer",
                      }}
                    >
                      <Check size={11} /> Cociné esto {cookedCounts[currentEntryId] ? `(${cookedCounts[currentEntryId]})` : ""}
                    </button>
                  </div>
                  <textarea
                    value={notes[currentEntryId] || ""}
                    onChange={(e) => saveNote(currentEntryId, e.target.value)}
                    placeholder="ej. le puse menos sal, quedó mejor con 10 min más..."
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                      borderRadius: 10, padding: "8px 10px", fontSize: 13, color: PALETTE.ink,
                      background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", resize: "vertical",
                    }}
                  />
                </div>
              )}

              {isFreeTierExhausted() ? (
                <div style={{ background: "#F1E4CE", borderRadius: 12, padding: 14, textAlign: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: PALETTE.ink, margin: "0 0 10px" }}>Se acabaron tus recetas gratis</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleSubscribe} style={{ flex: 1, background: PALETTE.wine, color: PALETTE.paper, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12.5, cursor: "pointer" }}>Suscribirme</button>
                    <button onClick={handleBuyOneRecipe} style={{ flex: 1, background: "transparent", color: PALETTE.wine, border: `1.3px solid ${PALETTE.wine}`, borderRadius: 10, padding: "9px 0", fontSize: 12.5, cursor: "pointer" }}>5 recetas sueltas</button>
                  </div>
                  {paywallMessage && paywallMessage !== "exceeded" && (
                    <p style={{ fontSize: 11, color: PALETTE.inkSoft, fontStyle: "italic", margin: "10px 0 0" }}>{paywallMessage}</p>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <input
                      type="text"
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") redeemAccessCode(); }}
                      placeholder="Código de acceso"
                      disabled={redeemingCode}
                      style={{
                        flex: 1, boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                        borderRadius: 10, padding: "7px 9px", fontSize: 12, color: PALETTE.ink,
                        background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", textTransform: "uppercase",
                      }}
                    />
                    <button
                      onClick={redeemAccessCode}
                      disabled={redeemingCode || !accessCodeInput.trim()}
                      style={{ background: PALETTE.olive, color: PALETTE.paper, border: "none", borderRadius: 10, padding: "0 12px", fontSize: 12, cursor: redeemingCode ? "default" : "pointer" }}
                    >
                      {redeemingCode ? <Loader2 size={12} className="animate-spin" /> : "Entrar"}
                    </button>
                  </div>
                </div>
              ) : !showExcludeInput ? (
                <button
                  onClick={() => setShowExcludeInput(true)}
                  disabled={analyzing}
                  style={{
                    width: "100%", background: "#F1E4CE", color: PALETTE.wine,
                    border: "none", borderRadius: 12, padding: "11px 0",
                    fontSize: 13, fontWeight: 500, cursor: analyzing ? "default" : "pointer", marginBottom: 8,
                  }}
                >
                  ¿Algo no te gustó? Ajústala sin perder lo demás
                </button>
              ) : (
                <div style={{ background: "#F1E4CE", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 13, color: PALETTE.ink, margin: "0 0 8px" }}>
                    ¿Qué ingrediente o condimento no te gustó? Genero otra receta con lo mismo que tienes, pero sin eso.
                  </p>
                  <input
                    type="text"
                    value={excludeText}
                    onChange={(e) => setExcludeText(e.target.value)}
                    placeholder="ej. cilantro, comino, queso azul..."
                    disabled={analyzing}
                    style={{
                      width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                      borderRadius: 10, padding: "9px 10px", fontSize: 13, color: PALETTE.ink,
                      background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", marginBottom: 8,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setShowExcludeInput(false); setExcludeText(""); }}
                      disabled={analyzing}
                      style={{
                        flex: 1, background: "transparent", color: PALETTE.inkSoft,
                        border: `1.3px solid ${PALETTE.paperDark}`, borderRadius: 10, padding: "9px 0",
                        fontSize: 13, cursor: analyzing ? "default" : "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        const toExclude = excludeText;
                        setShowExcludeInput(false);
                        setExcludeText("");
                        await analyze(`El usuario no quiere que esta receta incluya: ${toExclude}. Genera una receta DISTINTA a la anterior, usando los mismos ingredientes disponibles pero evitando por completo eso — sustitúyelo o simplemente no lo uses.`);
                      }}
                      disabled={analyzing || !excludeText.trim()}
                      style={{
                        flex: 2, background: analyzing ? PALETTE.inkSoft : PALETTE.wine, color: PALETTE.paper,
                        border: "none", borderRadius: 10, padding: "9px 0", fontSize: 13, fontWeight: 500,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        cursor: analyzing || !excludeText.trim() ? "default" : "pointer",
                      }}
                    >
                      {analyzing ? (<><Loader2 size={14} className="animate-spin" /> Generando...</>) : "Generar sin esto"}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                disabled={analyzing}
                style={{
                  width: "100%", background: "transparent", color: PALETTE.wine,
                  border: `1.3px solid ${PALETTE.wine}`, borderRadius: 12, padding: "11px 0",
                  fontSize: 15, fontWeight: 500, cursor: analyzing ? "default" : "pointer",
                }}
              >
                Crear otra receta
              </button>
            </div>
          )}

          {/* Favorites */}
          {favorites.length > 0 && (
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: PALETTE.inkSoft, margin: 0 }}>
                <Heart size={12} color={PALETTE.terracotta} fill={PALETTE.terracotta} /> {favorites.length} favorita{favorites.length === 1 ? "" : "s"} guardada{favorites.length === 1 ? "" : "s"}
              </p>
              <button
                onClick={() => setShowFavoritesList(true)}
                style={{ background: "none", border: "none", color: PALETTE.wine, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
              >
                Ver / buscar
              </button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: PALETTE.inkSoft, margin: 0 }}>Recetas anteriores</p>
                {buildShoppingList().length > 0 && (
                  <button
                    onClick={() => setShowShoppingList(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, background: "#F1E4CE", border: "none",
                      borderRadius: 999, padding: "5px 10px", fontSize: 12, color: PALETTE.wine, cursor: "pointer",
                    }}
                  >
                    <ShoppingCart size={13} /> Lista de compras
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHistoryItem(h)}
                    style={{ flexShrink: 0, width: 84, border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <ThumbOrFallback thumb={dishThumbs[h.id] || h.thumb} size={84} />
                    <p style={{ fontSize: 11, color: PALETTE.ink, margin: "4px 0 0", fontWeight: 500, lineHeight: 1.2 }}>
                      {h.result?.nombre_receta}
                    </p>
                    <p style={{ fontSize: 11, color: PALETTE.inkSoft, margin: "1px 0 0" }}>{formatDate(h.date)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(history.length > 0 || favorites.length > 0) && (
            <p style={{ textAlign: "center", fontSize: 11, color: PALETTE.inkSoft, margin: "22px 0 0", lineHeight: 1.5 }}>
              Tus recetas se guardan en este dispositivo. Si borras los datos del navegador o cambias de celular, se pierden.
            </p>
          )}
          <p style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => setShowPrivacy(true)}
              style={{ background: "none", border: "none", color: PALETTE.inkSoft, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}
            >
              Aviso de Privacidad
            </button>
          </p>
        </div>
      </div>

      {/* Modal */}
      {selectedHistoryItem && (
        <div
          onClick={() => setSelectedHistoryItem(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 400, width: "100%",
              maxHeight: "82vh", overflowY: "auto", padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px" }}>
                  {selectedHistoryItem.result?.nombre_receta}
                </h3>
                {selectedHistoryItem.result?.inspiracion && (
                  <p style={{ fontSize: 13, color: PALETTE.wine, fontStyle: "italic", margin: "3px 0 0" }}>
                    {selectedHistoryItem.result.inspiracion}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 2, flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  onClick={() => (speaking ? stopSpeaking() : speakRecipe(selectedHistoryItem.result))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label={speaking ? "Detener lectura" : "Escuchar receta"}
                >
                  {speaking ? <VolumeX size={16} color={PALETTE.terracotta} /> : <Volume2 size={16} color={PALETTE.wine} />}
                </button>
                <button
                  onClick={() => shareWhatsApp(selectedHistoryItem.result)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label="Enviar por WhatsApp"
                >
                  <Send size={16} color={PALETTE.olive} />
                </button>
                <button
                  onClick={() => printRecipe(selectedHistoryItem.result)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label="Imprimir receta"
                >
                  <Printer size={16} color={PALETTE.wine} />
                </button>
                <button
                  onClick={() => copyRecipe(selectedHistoryItem.result, selectedHistoryItem.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label="Copiar receta"
                >
                  {copiedId === selectedHistoryItem.id ? (
                    <Check size={16} color={PALETTE.olive} />
                  ) : (
                    <Copy size={16} color={PALETTE.wine} />
                  )}
                </button>
                <button
                  onClick={() => toggleFavorite(selectedHistoryItem)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  aria-label="Marcar como favorita"
                >
                  <Heart size={18} color={PALETTE.terracotta} fill={isFavorite(selectedHistoryItem.id) ? PALETTE.terracotta : "none"} />
                </button>
                <button onClick={() => setSelectedHistoryItem(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Cerrar">
                  <X size={18} color={PALETTE.inkSoft} />
                </button>
              </div>
            </div>
            {copiedId === selectedHistoryItem.id && (
              <p style={{ fontSize: 12, color: PALETTE.olive, margin: "6px 0 0" }}>Receta copiada, ya la puedes pegar y enviar.</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
              <a
                href={youtubeSearchUrl(selectedHistoryItem.result)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
                  color: PALETTE.wine, textDecoration: "none",
                  border: `1.3px solid ${PALETTE.wine}`, borderRadius: 999, padding: "5px 11px",
                }}
              >
                <PlayCircle size={14} /> Ver la técnica en YouTube
              </a>
              <button
                onClick={() => duplicateAndAdjust(selectedHistoryItem)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
                  color: PALETTE.wine, background: "transparent",
                  border: `1.3px solid ${PALETTE.wine}`, borderRadius: 999, padding: "5px 11px", cursor: "pointer",
                }}
              >
                <CopyPlus size={14} /> Duplicar y ajustar
              </button>
            </div>
            {(dishThumbs[selectedHistoryItem.id] || selectedHistoryItem.thumb) && (
              <img src={dishThumbs[selectedHistoryItem.id] || selectedHistoryItem.thumb} alt="" style={{ width: "100%", borderRadius: 10, margin: "12px 0" }} />
            )}
            {dishThumbs[selectedHistoryItem.id] && (
              <p style={{ fontSize: 11, color: PALETTE.inkSoft, fontStyle: "italic", margin: "-6px 0 10px", textAlign: "center" }}>Imagen ilustrativa</p>
            )}
            {selectedHistoryItem.result?.pasos?.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <button
                    onClick={() => setCookingMode({ pasos: selectedHistoryItem.result.pasos, nombre: selectedHistoryItem.result.nombre_receta, step: 0 })}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, background: "#F1E4CE", border: "none",
                      borderRadius: 999, padding: "4px 10px", fontSize: 11, color: PALETTE.wine, cursor: "pointer",
                    }}
                  >
                    <Maximize2 size={11} /> Modo cocina
                  </button>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {selectedHistoryItem.result.pasos.map((p, i) => (
                    <li key={i} style={{ fontSize: 13, color: PALETTE.ink, marginBottom: 5 }}>{p}</li>
                  ))}
                </ol>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: 0 }}>
                  <NotebookPen size={12} color={PALETTE.terracotta} /> Mis notas
                </p>
                <button
                  onClick={() => markCooked(selectedHistoryItem.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, background: "#E7EFDD", border: "none",
                    borderRadius: 999, padding: "4px 10px", fontSize: 11, color: PALETTE.olive, cursor: "pointer",
                  }}
                >
                  <Check size={11} /> Cociné esto {cookedCounts[selectedHistoryItem.id] ? `(${cookedCounts[selectedHistoryItem.id]})` : ""}
                </button>
              </div>
              <textarea
                value={notes[selectedHistoryItem.id] || ""}
                onChange={(e) => saveNote(selectedHistoryItem.id, e.target.value)}
                placeholder="ej. le puse menos sal, quedó mejor con 10 min más..."
                rows={2}
                style={{
                  width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                  borderRadius: 10, padding: "8px 10px", fontSize: 13, color: PALETTE.ink,
                  background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", resize: "vertical",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de explicación/sustitución de ingrediente */}
      {ingredientHelp && (
        <div
          onClick={() => setIngredientHelp(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 380, width: "100%", padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px", display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={16} color={PALETTE.terracotta} /> {ingredientHelp.name}
              </h3>
              <button onClick={() => setIngredientHelp(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Cerrar">
                <X size={18} color={PALETTE.inkSoft} />
              </button>
            </div>
            {ingredientHelp.loading && (
              <p style={{ fontSize: 13, color: PALETTE.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={14} className="animate-spin" /> Buscando información...
              </p>
            )}
            {ingredientHelp.error && (
              <p style={{ fontSize: 13, color: PALETTE.terracotta }}>{ingredientHelp.error}</p>
            )}
            {!ingredientHelp.loading && !ingredientHelp.error && (
              <>
                {ingredientHelp.explicacion && (
                  <p style={{ fontSize: 13, color: PALETTE.ink, margin: "0 0 14px", lineHeight: 1.5 }}>{ingredientHelp.explicacion}</p>
                )}
                {ingredientHelp.sustitutos?.length > 0 && (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 500, color: PALETTE.inkSoft, margin: "0 0 8px" }}>Sustitúyelo por:</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {ingredientHelp.sustitutos.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => substituteIngredient(ingredientHelp.name, s)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, background: "#F1E4CE", border: "none",
                            borderRadius: 10, padding: "9px 12px", fontSize: 13, color: PALETTE.wine, cursor: "pointer", textAlign: "left",
                          }}
                        >
                          <RefreshCcw size={13} /> {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de listado completo de favoritas con buscador */}
      {showFavoritesList && (
        <div
          onClick={() => { setShowFavoritesList(false); setFavoritesSearch(""); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 400, width: "100%",
              maxHeight: "82vh", overflowY: "auto", padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px", display: "flex", alignItems: "center", gap: 7 }}>
                <Heart size={16} color={PALETTE.terracotta} fill={PALETTE.terracotta} /> Favoritas
              </h3>
              <button
                onClick={() => { setShowFavoritesList(false); setFavoritesSearch(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                aria-label="Cerrar"
              >
                <X size={18} color={PALETTE.inkSoft} />
              </button>
            </div>
            {favorites.length > 0 && (
              <button
                onClick={printAllFavorites}
                style={{
                  display: "flex", alignItems: "center", gap: 6, background: "#F1E4CE", border: "none",
                  borderRadius: 999, padding: "6px 12px", fontSize: 12, color: PALETTE.wine, cursor: "pointer", marginBottom: 10,
                }}
              >
                <Printer size={13} /> Imprimir / exportar mi recetario completo
              </button>
            )}
            <input
              type="text"
              value={favoritesSearch}
              onChange={(e) => setFavoritesSearch(e.target.value)}
              placeholder="Buscar por nombre, ingrediente o cocina..."
              style={{
                width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                borderRadius: 10, padding: "9px 10px", fontSize: 13, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", marginBottom: 12,
              }}
            />
            {(() => {
              const q = favoritesSearch.trim().toLowerCase();
              const filtered = !q
                ? favorites
                : favorites.filter((f) => {
                    const r = f.result || {};
                    const haystack = [
                      r.nombre_receta, r.inspiracion,
                      ...(r.ingredientes_detectados || []),
                      ...(r.ingredientes_por_comprar || []),
                    ].filter(Boolean).join(" ").toLowerCase();
                    return haystack.includes(q);
                  });
              if (filtered.length === 0) {
                return <p style={{ fontSize: 13, color: PALETTE.inkSoft }}>No encontré ninguna favorita con eso.</p>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedHistoryItem(f); setShowFavoritesList(false); setFavoritesSearch(""); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, border: "none",
                        background: "#FBF3E4", borderRadius: 10, padding: 8, cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <ThumbOrFallback thumb={dishThumbs[f.id] || f.thumb} size={48} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: PALETTE.ink }}>
                          {f.result?.nombre_receta}
                        </span>
                        {f.result?.inspiracion && (
                          <span style={{ display: "block", fontSize: 11, color: PALETTE.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.result.inspiracion}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal de lista de compras */}
      {showShoppingList && (
        <div
          onClick={() => setShowShoppingList(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 400, width: "100%",
              maxHeight: "82vh", overflowY: "auto", padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px", display: "flex", alignItems: "center", gap: 7 }}>
                <ShoppingCart size={17} color={PALETTE.terracotta} /> Lista de compras
              </h3>
              <button onClick={() => setShowShoppingList(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Cerrar">
                <X size={18} color={PALETTE.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: PALETTE.inkSoft, margin: "0 0 12px" }}>
              Junta lo que te falta comprar de tus últimas {history.length} recetas.
            </p>
            {buildShoppingList().length === 0 ? (
              <p style={{ fontSize: 13, color: PALETTE.inkSoft }}>No tienes nada pendiente por comprar.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {buildShoppingList().map(({ item, recipes }) => (
                  <label key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!checkedShopping[item]}
                      onChange={() => setCheckedShopping((prev) => ({ ...prev, [item]: !prev[item] }))}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <span style={{
                        fontSize: 13, color: checkedShopping[item] ? PALETTE.inkSoft : PALETTE.ink,
                        textDecoration: checkedShopping[item] ? "line-through" : "none",
                      }}>
                        {item}
                      </span>
                      <span style={{ display: "block", fontSize: 11, color: PALETTE.inkSoft, marginTop: 1 }}>
                        {recipes.join(", ")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modo cocina: pantalla completa, un paso a la vez */}
      {cookingMode && (
        <div
          style={{
            position: "fixed", inset: 0, background: PALETTE.wineDeep, zIndex: 60,
            display: "flex", flexDirection: "column", padding: "24px 22px", boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <p style={{ color: PALETTE.saffron, fontSize: 12, textTransform: "uppercase", letterSpacing: "1.2px", margin: 0, fontWeight: 500 }}>
              {cookingMode.nombre}
            </p>
            <button onClick={() => setCookingMode(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Salir del modo cocina">
              <X size={22} color={PALETTE.paper} />
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
            <p style={{ color: PALETTE.saffron, fontSize: 15, margin: 0, fontWeight: 500 }}>
              Paso {cookingMode.step + 1} de {cookingMode.pasos.length}
            </p>
            <p style={{ color: PALETTE.paper, fontSize: 24, lineHeight: 1.45, fontFamily: "'Fraunces', serif", margin: 0, maxWidth: 460 }}>
              {cookingMode.pasos[cookingMode.step]}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setCookingMode((c) => ({ ...c, step: Math.max(0, c.step - 1) }))}
              disabled={cookingMode.step === 0}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: "transparent", color: cookingMode.step === 0 ? "#8A6E55" : PALETTE.paper,
                border: `1.3px solid ${cookingMode.step === 0 ? "#5C4A3A" : PALETTE.paper}`, borderRadius: 12,
                padding: "13px 0", fontSize: 15, cursor: cookingMode.step === 0 ? "default" : "pointer",
              }}
            >
              <ArrowLeft size={16} /> Anterior
            </button>
            {cookingMode.step < cookingMode.pasos.length - 1 ? (
              <button
                onClick={() => setCookingMode((c) => ({ ...c, step: Math.min(c.pasos.length - 1, c.step + 1) }))}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: PALETTE.saffron, color: PALETTE.wineDeep, border: "none", borderRadius: 12,
                  padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >
                Siguiente <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => setCookingMode(null)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: PALETTE.olive, color: PALETTE.paper, border: "none", borderRadius: 12,
                  padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Check size={16} /> ¡Listo!
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: 16, right: 16, bottom: 24, zIndex: 80, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: PALETTE.wineDeep, color: PALETTE.paper, borderRadius: 12, padding: "12px 16px", fontSize: 13, maxWidth: 380, lineHeight: 1.45, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
            {toast}
          </div>
        </div>
      )}

      {/* Modal de Aviso de Privacidad */}
      {showPrivacy && (
        <div
          onClick={() => setShowPrivacy(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 420, width: "100%",
              maxHeight: "82vh", overflowY: "auto", padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px" }}>
                Aviso de Privacidad
              </h3>
              <button onClick={() => setShowPrivacy(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Cerrar">
                <X size={18} color={PALETTE.inkSoft} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: PALETTE.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
              {PRIVACY_NOTICE}
            </p>
          </div>
        </div>
      )}

      {/* Panel oculto de administración: generar códigos de acceso */}
      {showAdmin && (
        <div
          onClick={() => setShowAdmin(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(61,22,32,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20, zIndex: 70,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PALETTE.paper, borderRadius: 16, maxWidth: 380, width: "100%", padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0, color: PALETTE.ink, letterSpacing: "-0.2px" }}>
                Generar código de acceso
              </h3>
              <button onClick={() => setShowAdmin(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Cerrar">
                <X size={18} color={PALETTE.inkSoft} />
              </button>
            </div>

            <label style={{ display: "block", fontSize: 12, color: PALETTE.inkSoft, marginBottom: 4 }}>Contraseña de administración</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                borderRadius: 10, padding: "9px 10px", fontSize: 13.5, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", marginBottom: 12,
              }}
            />

            <label style={{ display: "block", fontSize: 12, color: PALETTE.inkSoft, marginBottom: 4 }}>Tipo de acceso</label>
            <div style={{ display: "flex", gap: 4, background: "#EBE0C4", borderRadius: 10, padding: 3, marginBottom: 12 }}>
              <button
                onClick={() => setAdminTipo("suscripcion")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  background: adminTipo === "suscripcion" ? PALETTE.wine : "transparent",
                  color: adminTipo === "suscripcion" ? PALETTE.paper : PALETTE.inkSoft, fontSize: 12,
                }}
              >
                Suscripción
              </button>
              <button
                onClick={() => setAdminTipo("paquete")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  background: adminTipo === "paquete" ? PALETTE.wine : "transparent",
                  color: adminTipo === "paquete" ? PALETTE.paper : PALETTE.inkSoft, fontSize: 12,
                }}
              >
                Paquete de 5 recetas
              </button>
            </div>

            <label style={{ display: "block", fontSize: 12, color: PALETTE.inkSoft, marginBottom: 4 }}>Nota (para ti — ej. nombre de quien pagó)</label>
            <input
              type="text"
              value={adminNota}
              onChange={(e) => setAdminNota(e.target.value)}
              placeholder="ej. Lupita López - pagó 15/oct"
              style={{
                width: "100%", boxSizing: "border-box", border: `1.3px solid ${PALETTE.paperDark}`,
                borderRadius: 10, padding: "9px 10px", fontSize: 13.5, color: PALETTE.ink,
                background: "#FBF7EC", outline: "none", fontFamily: "'Work Sans', sans-serif", marginBottom: 14,
              }}
            />

            <button
              onClick={generarCodigoAdmin}
              disabled={adminLoading || !adminPassword.trim()}
              style={{
                width: "100%", background: adminLoading ? PALETTE.inkSoft : PALETTE.wine, color: PALETTE.paper,
                border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 500,
                cursor: adminLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {adminLoading ? (<><Loader2 size={14} className="animate-spin" /> Generando...</>) : "Generar código"}
            </button>

            {adminResult?.codigo && (
              <div style={{ marginTop: 14, background: "#E7EFDD", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <p style={{ fontSize: 11, color: PALETTE.inkSoft, margin: "0 0 4px" }}>Código generado — mándalo por WhatsApp:</p>
                <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: "2px", color: PALETTE.olive, margin: 0 }}>{adminResult.codigo}</p>
              </div>
            )}
            {adminResult?.error && (
              <p style={{ fontSize: 12, color: PALETTE.terracotta, marginTop: 10 }}>{adminResult.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
