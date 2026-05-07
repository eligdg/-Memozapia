import { Telegraf } from "telegraf";
import { logger } from "./lib/logger";

const API_BASE = `http://localhost:${process.env["PORT"] || 8080}`;
const API_URL = `${API_BASE}/api/notes`;

// --- Historial de conversaciones en memoria (por userId) ---
type Mensaje = { role: "user" | "assistant"; content: string };
const conversaciones = new Map<number, Mensaje[]>();

// Guarda la última respuesta de la IA por usuario (para /guardar manual)
const ultimaRespuestaIA = new Map<number, string>();

// ── Prompt del sistema ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente de Memozapia, una app de notas tipo "segundo cerebro".
Ayuda al usuario a organizar sus ideas, crear notas y tareas, y pensar con claridad.
Responde siempre en español, de forma breve y útil.

ACCIONES ESPECIALES — úsalas cuando el usuario lo pida explícitamente:

1. Si el usuario quiere GUARDAR algo como nota (dice "guarda esto", "anota eso", "quiero guardar..."):
   Añade EXACTAMENTE esta línea al principio de tu respuesta, antes de cualquier otra cosa:
   [GUARDAR: título_breve | contenido_completo_de_la_nota]

2. Si el usuario quiere un RECORDATORIO o ALARMA con fecha/hora (dice "recuérdame a las X", "pon una alarma para...", "avísame en X minutos"):
   Añade EXACTAMENTE esta línea al principio:
   [RECORDATORIO: título_breve | texto_del_recordatorio | FECHA_ISO_UTC]
   - FECHA_ISO_UTC: fecha y hora en UTC (España = UTC+2 verano, UTC+1 invierno).
   - Si el usuario dice "en 30 minutos", suma 30 minutos al momento actual.
   - Si dice "mañana a las 9", calcula la fecha de mañana a las 07:00 UTC (9h España verano).
   - Si no menciona hora, usa las 09:00 hora española.

Tras el marcador, confirma la acción de forma amigable en tu respuesta normal.`;

// ── Parseo de fecha en lenguaje natural (para comandos directos) ─────────────
function parsearFecha(texto: string): Date | null {
  const ahora = new Date();

  // "en X minutos"
  const minutos = texto.match(/en\s+(\d+)\s+minutos?/i);
  if (minutos) {
    return new Date(ahora.getTime() + parseInt(minutos[1]) * 60_000);
  }
  // "en X horas"
  const horas = texto.match(/en\s+(\d+)\s+horas?/i);
  if (horas) {
    return new Date(ahora.getTime() + parseInt(horas[1]) * 3_600_000);
  }
  // "a las HH:MM" o "a las H" (hoy o mañana)
  const aLas = texto.match(/a\s+las?\s+(\d{1,2})(?::(\d{2}))?/i);
  if (aLas) {
    const h = parseInt(aLas[1]);
    const m = aLas[2] ? parseInt(aLas[2]) : 0;
    const fecha = new Date(ahora);
    fecha.setHours(h, m, 0, 0);
    if (fecha <= ahora) fecha.setDate(fecha.getDate() + 1); // si ya pasó, mañana
    return fecha;
  }
  // "mañana" (a las 9 por defecto)
  if (/ma[ñn]ana/i.test(texto)) {
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(9, 0, 0, 0);
    // si especificaron hora también
    const hora = texto.match(/(\d{1,2})(?::(\d{2}))?\s*h/i);
    if (hora) {
      manana.setHours(parseInt(hora[1]), hora[2] ? parseInt(hora[2]) : 0, 0, 0);
    }
    return manana;
  }
  // "pasado mañana"
  if (/pasado\s+ma[ñn]ana/i.test(texto)) {
    const pManana = new Date(ahora);
    pManana.setDate(pManana.getDate() + 2);
    pManana.setHours(9, 0, 0, 0);
    return pManana;
  }

  return null;
}

// ── Parseo de marcadores [GUARDAR:...] y [RECORDATORIO:...] en respuesta IA ──
interface MarcadorGuardar {
  tipo: "GUARDAR";
  titulo: string;
  contenido: string;
}
interface MarcadorRecordatorio {
  tipo: "RECORDATORIO";
  titulo: string;
  texto: string;
  fechaISO: string;
}
type Marcador = MarcadorGuardar | MarcadorRecordatorio;

function extraerMarcadores(texto: string): { marcadores: Marcador[]; limpio: string } {
  const marcadores: Marcador[] = [];
  let limpio = texto;

  // [GUARDAR: título | contenido]
  const regGuardar = /\[GUARDAR:\s*(.+?)\s*\|\s*([\s\S]+?)\]/g;
  let m: RegExpExecArray | null;
  while ((m = regGuardar.exec(texto)) !== null) {
    marcadores.push({ tipo: "GUARDAR", titulo: m[1].trim(), contenido: m[2].trim() });
    limpio = limpio.replace(m[0], "").trim();
  }

  // [RECORDATORIO: título | texto | fechaISO]
  const regRecord = /\[RECORDATORIO:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\]/g;
  while ((m = regRecord.exec(texto)) !== null) {
    marcadores.push({
      tipo: "RECORDATORIO",
      titulo: m[1].trim(),
      texto: m[2].trim(),
      fechaISO: m[3].trim(),
    });
    limpio = limpio.replace(m[0], "").trim();
  }

  return { marcadores, limpio };
}

// ── Ejecuta un marcador (crea nota/recordatorio en la API) ───────────────────
async function ejecutarMarcador(marcador: Marcador, chatId: number): Promise<string> {
  if (marcador.tipo === "GUARDAR") {
    await fetchJson(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: marcador.titulo,
        content: marcador.contenido,
        tags: ["ia", "guardado"],
        scheduled_at: null,
      }),
    });
    return `📝 Nota guardada en Memozapia: *${escapeMarkdown(marcador.titulo)}*`;
  }

  if (marcador.tipo === "RECORDATORIO") {
    const fecha = new Date(marcador.fechaISO);
    const fechaValida = !isNaN(fecha.getTime());
    await fetchJson(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "⏰ " + marcador.titulo,
        content: marcador.texto,
        tags: ["recordatorio", "recordatorio-activo", `_tg_${chatId}`],
        scheduled_at: fechaValida ? fecha.toISOString() : null,
      }),
    });
    const fechaStr = fechaValida
      ? fecha.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
      : "fecha no reconocida";
    return `⏰ Recordatorio programado para *${escapeMarkdown(fechaStr)}*`;
  }

  return "";
}

// ── Llama a la IA con el historial completo ──────────────────────────────────
async function chatAI(historial: Mensaje[]): Promise<string> {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseUrl || !apiKey) {
    return "La IA no está configurada todavía.";
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...historial],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error({ err }, "Error llamando a la IA");
    return "❌ Error al consultar la IA.";
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? "Sin respuesta.";
}

// ── Crea nota o recordatorio con fecha desde texto plano ─────────────────────
async function crearRecordatorio(texto: string, chatId: number): Promise<string> {
  const fecha = parsearFecha(texto);
  const titulo = "⏰ " + texto.substring(0, 60);
  await fetchJson(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: titulo,
      content: `⏰ Recordatorio: ${texto}\nCreado: ${new Date().toLocaleString("es-ES")}`,
      tags: fecha
        ? ["recordatorio", "recordatorio-activo", `_tg_${chatId}`]
        : ["recordatorio"],
      scheduled_at: fecha ? fecha.toISOString() : null,
    }),
  });
  if (fecha) {
    const fechaStr = fecha.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
    return `⏰ *Recordatorio programado*\n\n"${texto}"\n\n📅 Te avisaré el *${escapeMarkdown(fechaStr)}*`;
  }
  return `⏰ *Recordatorio guardado* (sin hora específica)\n\n"${texto}"\n\nSi quieres una alarma, escribe: /alarma en 30 minutos [texto]`;
}

// ── Helper HTTP ───────────────────────────────────────────────────────────────
async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Checker de recordatorios pendientes (cada 60 segundos) ───────────────────
function iniciarCheckerRecordatorios(bot: Telegraf) {
  setInterval(async () => {
    try {
      const notes = (await fetchJson(`${API_URL}?tag=recordatorio-activo`)) as Array<{
        id: number;
        title: string | null;
        content: string;
        tags: string[];
        scheduled_at: string | null;
      }>;

      const ahora = new Date();
      for (const note of notes) {
        if (!note.scheduled_at) continue;
        const fechaNota = new Date(note.scheduled_at);
        if (fechaNota > ahora) continue;

        // Busca el chat ID en las etiquetas
        const tgTag = note.tags.find((t) => t.startsWith("_tg_"));
        if (!tgTag) continue;
        const chatId = parseInt(tgTag.replace("_tg_", ""));
        if (isNaN(chatId)) continue;

        // Envía el recordatorio
        const titulo = note.title || note.content.substring(0, 60);
        await bot.telegram.sendMessage(
          chatId,
          `⏰ *Recordatorio:* ${escapeMarkdownV2(titulo)}`,
          { parse_mode: "MarkdownV2" }
        );

        // Marca como enviado (quita recordatorio-activo, añade recordatorio-enviado)
        const newTags = note.tags
          .filter((t) => t !== "recordatorio-activo")
          .concat("recordatorio-enviado");

        await fetchJson(`${API_URL}/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: note.title,
            content: note.content,
            tags: newTags,
            scheduled_at: note.scheduled_at,
          }),
        });
        logger.info({ noteId: note.id, chatId }, "Recordatorio enviado");
      }
    } catch (err) {
      logger.error(err, "Error en checker de recordatorios");
    }
  }, 60_000);
}

// ── Bot principal ─────────────────────────────────────────────────────────────
export function createTelegramBot() {
  const token = process.env["TELEGRAM_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_TOKEN no configurado — bot de Telegram desactivado");
    return null;
  }

  const bot = new Telegraf(token);

  bot.telegram.getMe().then((me) => {
    logger.info(`Bot de Telegram activo: @${me.username}`);
    iniciarCheckerRecordatorios(bot);
  }).catch(() => {
    logger.warn("No se pudo verificar el bot de Telegram (token inválido?)");
  });

  // /start
  bot.start((ctx) => {
    ctx.replyWithMarkdown(
      "*🧠 Memozapia Bot*\n\n" +
      "Tu segundo cerebro personal\\.\n\n" +
      "*Comandos disponibles:*\n" +
      "/notes — Ver notas recientes\n" +
      "/search \\[texto\\] — Buscar notas\n" +
      "/tags — Ver todas las etiquetas\n" +
      "/ai \\[pregunta\\] — Chatear con la IA\n" +
      "/guardar — Guardar la última respuesta de la IA como nota\n" +
      "/salir — Terminar conversación con IA\n" +
      "/reminder \\[texto\\] — Guardar un recordatorio\n" +
      "/alarma \\[cuándo\\] \\[texto\\] — Alarma con hora \\(ej: /alarma en 30 minutos reunión\\)\n" +
      "/task \\[texto\\] — Guardar una tarea\n" +
      "/summary — Resumen de tus notas\n" +
      "/help — Ver ayuda\n\n" +
      "_💡 Durante el chat con IA puedes decir_ *\"guarda esto como nota\"* _o_ *\"recuérdame a las 9...\"* _y lo hará automáticamente\\._"
    );
  });

  // /help
  bot.help((ctx) => {
    ctx.replyWithMarkdown(
      "*Ayuda — Memozapia Bot*\n\n" +
      "*Notas:*\n" +
      "/notes — Lista las 10 notas más recientes\n" +
      "/search \\[texto\\] — Busca en título y contenido\n" +
      "/tags — Muestra todas las etiquetas\n" +
      "/task \\[texto\\] — Guarda una tarea pendiente\n" +
      "/summary — Resumen de tus notas\n\n" +
      "*IA:*\n" +
      "/ai \\[pregunta\\] — Inicia o continúa un chat con la IA\n" +
      "/guardar — Guarda la última respuesta de la IA como nota\n" +
      "/salir — Sale del modo IA\n\n" +
      "*Recordatorios \\(con alarma real\\):*\n" +
      "/alarma en 30 minutos llamar a Juan\n" +
      "/alarma a las 9 reunión de trabajo\n" +
      "/alarma mañana a las 10 cita médico\n" +
      "/reminder \\[texto\\] — Recordatorio sin hora específica\n\n" +
      "_💡 En el chat IA puedes pedir directamente:_\n" +
      "_\"Guarda esto como nota\"_\n" +
      "_\"Recuérdame en 1 hora revisar el correo\"_"
    );
  });

  // /notes
  bot.command("notes", async (ctx) => {
    try {
      const notes = (await fetchJson(API_URL)) as Array<{
        id: number; title: string | null; content: string; tags: string[];
      }>;
      const recent = notes.slice(0, 10);
      if (recent.length === 0) return ctx.reply("No tienes notas guardadas todavía.");
      let msg = "*Tus notas recientes:*\n\n";
      recent.forEach((note, i) => {
        const title = note.title || "Sin título";
        const preview = note.content.substring(0, 60).replace(/\n/g, " ");
        const tags = note.tags?.length ? " _\\[" + note.tags.filter(t => !t.startsWith("_tg_")).join(", ") + "\\]_" : "";
        msg += `${i + 1}\\. *${escapeMarkdownV2(title)}*${tags}\n   ${escapeMarkdownV2(preview)}…\n\n`;
      });
      return ctx.replyWithMarkdownV2(msg);
    } catch (err) {
      logger.error(err, "Error /notes");
      return ctx.reply("❌ Error al obtener las notas.");
    }
  });

  // /search
  bot.command("search", async (ctx) => {
    const query = ctx.message.text.substring(8).trim();
    if (!query) return ctx.reply("Uso: /search [texto a buscar]");
    try {
      const notes = (await fetchJson(`${API_URL}?search=${encodeURIComponent(query)}`)) as Array<{
        title: string | null; content: string; tags: string[];
      }>;
      if (notes.length === 0) return ctx.reply(`No se encontraron notas con "${query}".`);
      let msg = `*Resultados para "${escapeMarkdownV2(query)}":*\n\n`;
      notes.slice(0, 10).forEach((note, i) => {
        const title = note.title || "Sin título";
        const preview = note.content.substring(0, 50).replace(/\n/g, " ");
        msg += `${i + 1}\\. *${escapeMarkdownV2(title)}*\n   ${escapeMarkdownV2(preview)}…\n\n`;
      });
      return ctx.replyWithMarkdownV2(msg);
    } catch (err) {
      logger.error(err, "Error /search");
      return ctx.reply("❌ Error al buscar notas.");
    }
  });

  // /tags
  bot.command("tags", async (ctx) => {
    try {
      const tags = (await fetchJson(`${API_URL}/tags/all`)) as Array<{ id: number; name: string }>;
      const visibles = tags.filter(t => !t.name.startsWith("_tg_") && t.name !== "recordatorio-activo" && t.name !== "recordatorio-enviado");
      if (visibles.length === 0) return ctx.reply("No tienes etiquetas todavía.");
      const tagList = visibles.map((t) => `#${t.name}`).join("  ");
      return ctx.replyWithMarkdown(`*Tus etiquetas:*\n\n${tagList}`);
    } catch (err) {
      logger.error(err, "Error /tags");
      return ctx.reply("❌ Error al obtener las etiquetas.");
    }
  });

  // /summary
  bot.command("summary", async (ctx) => {
    try {
      const notes = (await fetchJson(API_URL)) as Array<{ title: string | null; content: string; tags: string[] }>;
      if (notes.length === 0) return ctx.reply("No tienes notas para resumir.");
      const allTags = [...new Set(notes.flatMap((n) => n.tags || []).filter(t => !t.startsWith("_tg_")))];
      const tagsStr = allTags.length ? allTags.map((t) => `#${t}`).join(", ") : "ninguna";
      const pendRecords = notes.filter(n => n.tags.includes("recordatorio-activo")).length;
      return ctx.replyWithMarkdown(
        `*📝 Resumen de tus notas:*\n\n` +
        `• Total de notas: *${notes.length}*\n` +
        `• Etiquetas usadas: ${tagsStr}\n` +
        (pendRecords > 0 ? `• ⏰ Recordatorios pendientes: *${pendRecords}*\n` : "") +
        `\n_Usa /notes para ver las más recientes o /search para buscar._`
      );
    } catch (err) {
      logger.error(err, "Error /summary");
      return ctx.reply("❌ Error al generar el resumen.");
    }
  });

  // /ai — inicia o continúa conversación con IA
  bot.command("ai", async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const question = ctx.message.text.substring(4).trim();
    if (!question) {
      const enModo = conversaciones.has(userId);
      return ctx.reply(
        enModo
          ? "Ya estás en modo IA — escribe directamente tu mensaje.\nUsa /salir para terminar."
          : "Uso: /ai [tu pregunta]\n\nEjemplo: /ai ¿cómo organizo mis notas?"
      );
    }

    const historial = conversaciones.get(userId) ?? [];
    historial.push({ role: "user", content: question });

    await ctx.reply("🤖 Pensando...");
    try {
      const respuestaRaw = await chatAI(historial);
      const { marcadores, limpio } = extraerMarcadores(respuestaRaw);

      historial.push({ role: "assistant", content: limpio });
      conversaciones.set(userId, historial);
      ultimaRespuestaIA.set(userId, limpio);

      // Ejecutar marcadores (crear notas/recordatorios)
      const confirmaciones: string[] = [];
      for (const m of marcadores) {
        try {
          const conf = await ejecutarMarcador(m, chatId);
          if (conf) confirmaciones.push(conf);
        } catch (e) {
          logger.error(e, "Error ejecutando marcador IA");
        }
      }

      let reply = `🧠 ${limpio}\n\n_Sigue escribiendo o usa /salir para terminar._`;
      if (confirmaciones.length > 0) {
        reply = confirmaciones.join("\n") + "\n\n" + reply;
      }
      return ctx.replyWithMarkdown(reply);
    } catch (err) {
      logger.error(err, "Error /ai");
      historial.pop();
      conversaciones.set(userId, historial);
      return ctx.reply("❌ Error al consultar la IA.");
    }
  });

  // /guardar — guarda la última respuesta de la IA como nota
  bot.command("guardar", async (ctx) => {
    const userId = ctx.from.id;
    const ultima = ultimaRespuestaIA.get(userId);
    if (!ultima) {
      return ctx.reply("No hay ninguna respuesta de la IA para guardar. Usa /ai para chatear primero.");
    }
    try {
      const titulo = ultima.substring(0, 60).replace(/\n.*/s, "");
      await fetchJson(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titulo,
          content: ultima,
          tags: ["ia", "guardado"],
          scheduled_at: null,
        }),
      });
      ultimaRespuestaIA.delete(userId);
      return ctx.replyWithMarkdown(`✅ *Nota guardada en Memozapia:*\n\n"${escapeMarkdown(titulo)}…"`);
    } catch (err) {
      logger.error(err, "Error /guardar");
      return ctx.reply("❌ Error al guardar la nota.");
    }
  });

  // /salir — termina el modo IA
  bot.command("salir", (ctx) => {
    const userId = ctx.from.id;
    if (conversaciones.has(userId)) {
      conversaciones.delete(userId);
      ultimaRespuestaIA.delete(userId);
      return ctx.reply("✅ Conversación con IA terminada.\nTus mensajes se guardarán como notas de nuevo.");
    }
    return ctx.reply("No estás en modo IA. Escribe /ai [pregunta] para empezar.");
  });

  // /alarma — recordatorio con hora real
  bot.command("alarma", async (ctx) => {
    const chatId = ctx.chat.id;
    const texto = ctx.message.text.substring(7).trim();
    if (!texto) {
      return ctx.reply(
        "Uso: /alarma [cuándo] [qué]\n\n" +
        "Ejemplos:\n" +
        "/alarma en 30 minutos llamar a Juan\n" +
        "/alarma a las 9 reunión de trabajo\n" +
        "/alarma mañana a las 10 cita médico\n" +
        "/alarma en 2 horas revisar el correo"
      );
    }
    try {
      const msg = await crearRecordatorio(texto, chatId);
      return ctx.replyWithMarkdown(msg);
    } catch (err) {
      logger.error(err, "Error /alarma");
      return ctx.reply("❌ Error al guardar la alarma.");
    }
  });

  // /reminder
  bot.command("reminder", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.substring(10).trim();
    if (!text) {
      return ctx.reply(
        "Uso: /reminder [texto del recordatorio]\n\n" +
        "Para recordatorio con hora específica usa /alarma:\n" +
        "/alarma en 30 minutos llamar a Juan"
      );
    }
    try {
      const msg = await crearRecordatorio(text, chatId);
      return ctx.replyWithMarkdown(msg);
    } catch (err) {
      logger.error(err, "Error /reminder");
      return ctx.reply("❌ Error al guardar el recordatorio.");
    }
  });

  // /task
  bot.command("task", async (ctx) => {
    const text = ctx.message.text.substring(6).trim();
    if (!text) return ctx.reply("Uso: /task [descripción de la tarea]");
    try {
      await fetchJson(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tarea: " + text.substring(0, 50),
          content: "✅ Tarea pendiente:\n" + text + "\nCreada: " + new Date().toLocaleString("es-ES"),
          tags: ["tarea", "pendiente"],
          scheduled_at: null,
        }),
      });
      return ctx.replyWithMarkdown(`✅ *Tarea guardada:*\n\n"${escapeMarkdown(text)}"`);
    } catch (err) {
      logger.error(err, "Error /task");
      return ctx.reply("❌ Error al guardar la tarea.");
    }
  });

  // Mensajes de texto libres
  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const content = ctx.message.text;

    // Modo IA activo → continuar conversación
    if (conversaciones.has(userId)) {
      const historial = conversaciones.get(userId)!;
      historial.push({ role: "user", content });
      await ctx.reply("🤖 Pensando...");
      try {
        const respuestaRaw = await chatAI(historial);
        const { marcadores, limpio } = extraerMarcadores(respuestaRaw);

        historial.push({ role: "assistant", content: limpio });
        conversaciones.set(userId, historial);
        ultimaRespuestaIA.set(userId, limpio);

        const confirmaciones: string[] = [];
        for (const m of marcadores) {
          try {
            const conf = await ejecutarMarcador(m, chatId);
            if (conf) confirmaciones.push(conf);
          } catch (e) {
            logger.error(e, "Error ejecutando marcador IA");
          }
        }

        let reply = `🧠 ${limpio}\n\n_Sigue escribiendo o /salir para terminar._`;
        if (confirmaciones.length > 0) {
          reply = confirmaciones.join("\n") + "\n\n" + reply;
        }
        return ctx.replyWithMarkdown(reply);
      } catch (err) {
        logger.error(err, "Error en chat IA");
        historial.pop();
        conversaciones.set(userId, historial);
        return ctx.reply("❌ Error al consultar la IA.");
      }
    }

    // Modo nota (comportamiento original)
    try {
      await fetchJson(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: null, content, tags: [], scheduled_at: null }),
      });
      const preview = content.substring(0, 80);
      return ctx.reply(`✅ Nota guardada:\n"${preview}${content.length > 80 ? "…" : ""}"`);
    } catch (err) {
      logger.error(err, "Error guardando nota desde Telegram");
      return ctx.reply("❌ Error al guardar la nota.");
    }
  });

  // Notas de voz
  bot.on("voice", (ctx) => {
    return ctx.reply("🎙️ Nota de voz recibida. La transcripción automática estará disponible próximamente.");
  });

  return bot;
}

// Escapa caracteres especiales para Markdown v1
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// Escapa caracteres especiales para MarkdownV2
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
