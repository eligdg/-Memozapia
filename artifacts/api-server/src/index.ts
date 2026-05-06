import app from "./app";
import { logger } from "./lib/logger";
import { createTelegramBot } from "./telegram-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Arrancar el bot de Telegram en modo long-polling
  // Nota: bot.launch() es una promesa que nunca resuelve (polling indefinido)
  const bot = createTelegramBot();
  if (bot) {
    bot.launch().catch((e: unknown) =>
      logger.error(e, "Error en el bot de Telegram")
    );
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
});
