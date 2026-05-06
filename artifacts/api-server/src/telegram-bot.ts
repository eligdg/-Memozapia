import { Telegraf } from "telegraf";
import { logger } from "./lib/logger";

const API_BASE = `http://localhost:${process.env["PORT"] || 8080}`;
const API_URL = `${API_BASE}/api/notes`;

// --- Historial de conversaciones en memoria (por userId) ---
type Mensaje = { role: "user" | "assistant"; content: string };
const conversaciones = new Map<number, Mensaje[]>();

const SYSTEM_PROMPT =
  "Eres el asistente de Memozapia, una app de notas tipo 'segundo cerebro'. " +
  "Ayuda al usuario a organizar sus ideas, crear notas y tareas, y pensar con claridad. " +
  "Responde siempre en español, de forma breve y útil. " +
  "Si el usuario quiere guardar algo, díselo claramente.";

// Llama a la IA con el historial completo
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
      model: "gpt-5-mini",
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
// -----------------------------------------------------------

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export function createTelegramBot() {
  const token = process.env["TELEGRAM_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_TOKEN no configurado — bot de Telegram desactivado");
    return null;
  }

  const bot = new Telegraf(token);

  bot.telegram.getMe().then((me) => {
    logger.info(`Bot de Telegram activo: @${me.username}`);
  }).catch(() => {
    logger.warn("No se pudo verificar el bot de Telegram (token inválido?)");
  });

  // /start
  bot.start((ctx) => {
    ctx.replyWithMarkdown(
      "*🧠 Memozapia Bot*\n\n" +
        "Tu segundo cerebro personal.\n\n" +
        "*Comandos disponibles:*\n" +
        "/notes — Ver notas recientes\n" +
        "/search \\[texto\\] — Buscar notas\n" +
        "/tags — Ver todas las etiquetas\n" +
        "/ai \\[pregunta\\] — Chatear con la IA\n" +
        "/salir — Terminar conversación con IA\n" +
        "/reminder \\[texto\\] — Guardar un recordatorio\n" +
        "/task \\[texto\\] — Guardar una tarea\n" +
        "/summary — Resumen de tus notas\n" +
        "/help — Ver ayuda\n\n" +
        "_Cualquier mensaje fuera del chat IA se guarda como nota._"
    );
  });

  // /help
  bot.help((ctx) => {
    ctx.replyWithMarkdown(
      "*Ayuda — Memozapia Bot*\n\n" +
        "/notes — Lista las 10 notas más recientes\n" +
        "/search \\[texto\\] — Busca en título y contenido\n" +
        "/tags — Muestra todas las etiquetas existentes\n" +
        "/ai \\[pregunta\\] — Inicia o continúa un chat con la IA\n" +
        "/salir — Sale del modo IA (vuelve a guardar notas)\n" +
        "/reminder \\[texto\\] — Guarda un recordatorio como nota\n" +
        "/task \\[texto\\] — Guarda una tarea pendiente como nota\n" +
        "/summary — Resumen de tus notas y etiquetas\n\n" +
        "_Mientras estés en modo IA, tus mensajes van a la IA._\n" +
        "_Escribe /salir para volver a guardar notas._"
    );
  });

  // /notes
  bot.command("notes", async (ctx) => {
    try {
      const notes = (await fetchJson(API_URL)) as Array<{
        id: number;
        title: string | null;
        content: string;
        tags: string[];
      }>;
      const recent = notes.slice(0, 10);
      if (recent.length === 0) {
        return ctx.reply("No tienes notas guardadas todavía.");
      }
      let msg = "*Tus notas recientes:*\n\n";
      recent.forEach((note, i) => {
        const title = note.title || "Sin título";
        const preview = note.content.substring(0, 60).replace(/\n/g, " ");
        const tags = note.tags?.length ? " _\\[" + note.tags.join(", ") + "\\]_" : "";
        msg += `${i + 1}\\. *${escapeMarkdown(title)}*${tags}\n   ${escapeMarkdown(preview)}…\n\n`;
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
    if (!query) {
      return ctx.reply("Uso: /search [texto a buscar]");
    }
    try {
      const notes = (await fetchJson(
        `${API_URL}?search=${encodeURIComponent(query)}`
      )) as Array<{ title: string | null; content: string; tags: string[] }>;
      if (notes.length === 0) {
        return ctx.reply(`No se encontraron notas con "${query}".`);
      }
      let msg = `*Resultados para "${escapeMarkdown(query)}":*\n\n`;
      notes.slice(0, 10).forEach((note, i) => {
        const title = note.title || "Sin título";
        const preview = note.content.substring(0, 50).replace(/\n/g, " ");
        msg += `${i + 1}\\. *${escapeMarkdown(title)}*\n   ${escapeMarkdown(preview)}…\n\n`;
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
      const tags = (await fetchJson(`${API_URL}/tags/all`)) as Array<{
        id: number;
        name: string;
      }>;
      if (tags.length === 0) {
        return ctx.reply("No tienes etiquetas todavía.");
      }
      const tagList = tags.map((t) => `#${t.name}`).join("  ");
      return ctx.replyWithMarkdown(`*Tus etiquetas:*\n\n${tagList}`);
    } catch (err) {
      logger.error(err, "Error /tags");
      return ctx.reply("❌ Error al obtener las etiquetas.");
    }
  });

  // /summary
  bot.command("summary", async (ctx) => {
    try {
      const notes = (await fetchJson(API_URL)) as Array<{
        title: string | null;
        content: string;
        tags: string[];
      }>;
      if (notes.length === 0) {
        return ctx.reply("No tienes notas para resumir.");
      }
      const allTags = [...new Set(notes.flatMap((n) => n.tags || []))];
      const tagsStr = allTags.length ? allTags.map((t) => `#${t}`).join(", ") : "ninguna";
      return ctx.replyWithMarkdown(
        `*📝 Resumen de tus notas:*\n\n` +
          `• Total de notas: *${notes.length}*\n` +
          `• Etiquetas usadas: ${tagsStr}\n\n` +
          `_Usa /notes para ver las más recientes o /search para buscar._`
      );
    } catch (err) {
      logger.error(err, "Error /summary");
      return ctx.reply("❌ Error al generar el resumen.");
    }
  });

  // /ai — inicia o continúa conversación con IA
  bot.command("ai", async (ctx) => {
    const userId = ctx.from.id;
    const question = ctx.message.text.substring(4).trim();
    if (!question) {
      const enModo = conversaciones.has(userId);
      return ctx.reply(
        enModo
          ? "Ya estás en modo IA — escribe directamente tu mensaje.\nUsa /salir para terminar."
          : "Uso: /ai [tu pregunta]\n\nEjemplo: /ai ¿cómo organizo mis notas?"
      );
    }

    // Añadir la pregunta al historial (o iniciar uno nuevo)
    const historial = conversaciones.get(userId) ?? [];
    historial.push({ role: "user", content: question });

    await ctx.reply("🤖 Pensando...");
    try {
      const respuesta = await chatAI(historial);
      historial.push({ role: "assistant", content: respuesta });
      conversaciones.set(userId, historial);
      return ctx.reply(`🧠 ${respuesta}\n\n_Puedes seguir escribiendo. /salir para terminar._`);
    } catch (err) {
      logger.error(err, "Error /ai");
      historial.pop(); // quitar la pregunta si falló
      conversaciones.set(userId, historial);
      return ctx.reply("❌ Error al consultar la IA.");
    }
  });

  // /salir — termina el modo IA y limpia el historial
  bot.command("salir", (ctx) => {
    const userId = ctx.from.id;
    if (conversaciones.has(userId)) {
      conversaciones.delete(userId);
      return ctx.reply("✅ Conversación con IA terminada.\nTus mensajes se guardarán como notas de nuevo.");
    }
    return ctx.reply("No estás en modo IA. Escribe /ai [pregunta] para empezar.");
  });

  // /reminder
  bot.command("reminder", async (ctx) => {
    const text = ctx.message.text.substring(10).trim();
    if (!text) {
      return ctx.reply("Uso: /reminder [texto del recordatorio]");
    }
    try {
      await fetchJson(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Recordatorio: " + text.substring(0, 50),
          content:
            "⏰ Recordatorio: " +
            text +
            "\nCreado: " +
            new Date().toLocaleString("es-ES"),
          tags: ["recordatorio"],
        }),
      });
      return ctx.replyWithMarkdown(`⏰ *Recordatorio guardado:*\n\n"${text}"`);
    } catch (err) {
      logger.error(err, "Error /reminder");
      return ctx.reply("❌ Error al guardar el recordatorio.");
    }
  });

  // /task
  bot.command("task", async (ctx) => {
    const text = ctx.message.text.substring(6).trim();
    if (!text) {
      return ctx.reply("Uso: /task [descripción de la tarea]");
    }
    try {
      await fetchJson(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tarea: " + text.substring(0, 50),
          content:
            "✅ Tarea pendiente:\n" +
            text +
            "\nCreada: " +
            new Date().toLocaleString("es-ES"),
          tags: ["tarea", "pendiente"],
        }),
      });
      return ctx.replyWithMarkdown(`✅ *Tarea guardada:*\n\n"${text}"`);
    } catch (err) {
      logger.error(err, "Error /task");
      return ctx.reply("❌ Error al guardar la tarea.");
    }
  });

  // Mensajes de texto libres:
  // - Si hay conversación IA activa → continuar con la IA
  // - Si no → guardar como nota
  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;

    const userId = ctx.from.id;
    const content = ctx.message.text;

    // Modo IA activo
    if (conversaciones.has(userId)) {
      const historial = conversaciones.get(userId)!;
      historial.push({ role: "user", content });
      await ctx.reply("🤖 Pensando...");
      try {
        const respuesta = await chatAI(historial);
        historial.push({ role: "assistant", content: respuesta });
        conversaciones.set(userId, historial);
        return ctx.reply(`🧠 ${respuesta}\n\n_Sigue escribiendo o usa /salir para terminar._`);
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
        body: JSON.stringify({ title: null, content, tags: [] }),
      });
      const preview = content.substring(0, 80);
      return ctx.reply(
        `✅ Nota guardada:\n"${preview}${content.length > 80 ? "…" : ""}"`
      );
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

// Escapa caracteres especiales para MarkdownV2
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
