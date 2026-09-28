// Reemplazo de window.storage (que solo existe en la vista previa de Claude)
// usando localStorage real del navegador, para que la app funcione igual
// una vez desplegada en tu propio dominio.
//
// IMPORTANTE: localStorage guarda los datos SOLO en ese navegador/dispositivo
// — si la misma persona abre la app en su celular y en su compu, no van a
// ver el mismo historial ni el mismo conteo de recetas gratis. Para que el
// historial, favoritas y el conteo del plan gratis se sincronicen de verdad
// entre dispositivos (ligados a la cuenta de cada usuario), ese es
// exactamente el trabajo que hace falta cuando conectemos Supabase — ver
// README.md, sección "Siguiente paso: Supabase".

function makeKey(key, shared) {
  return (shared ? "shared:" : "local:") + key;
}

window.storage = {
  async get(key, shared = false) {
    try {
      const raw = localStorage.getItem(makeKey(key, shared));
      if (raw === null) return null;
      return { key, value: raw, shared };
    } catch {
      return null;
    }
  },
  async set(key, value, shared = false) {
    try {
      localStorage.setItem(makeKey(key, shared), value);
      return { key, value, shared };
    } catch {
      return null;
    }
  },
  async delete(key, shared = false) {
    try {
      localStorage.removeItem(makeKey(key, shared));
      return { key, deleted: true, shared };
    } catch {
      return null;
    }
  },
  async list(prefix = "", shared = false) {
    try {
      const fullPrefix = makeKey(prefix, shared);
      const stripLen = shared ? "shared:".length : "local:".length;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) keys.push(k.slice(stripLen));
      }
      return { keys, prefix, shared };
    } catch {
      return null;
    }
  },
};
