# Configuración del Bot de Telegram - Memozapia

## 1. Crear Bot de Telegram

1. Abre Telegram y busca @BotFather
2. Envía /newbot
3. Elige un nombre para tu bot (ej: MemozapiaBot)
4. Elige un username (debe terminar en bot, ej: memozapia_bot)
5. BotFather te dará un token. Cópialo.

## 2. Configurar Google Calendar y Gmail (Opcional)

### Crear proyecto en Google Cloud Console:
1. Ve a https://console.cloud.google.com/
2. Crea un nuevo proyecto
3. Habilita las APIs:
   - Google Calendar API
   - Gmail API
4. Crea credenciales OAuth 2.0:
   - Ve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth"
   - Tipo de aplicación: "Aplicación de escritorio" o "Web application"
   - URI de redirección autorizados: `http://localhost:3002/oauth2callback`
5. Copia el Client ID y Client Secret

### Configurar el archivo .env:
Crea el archivo `.env` en la carpeta `telegram-bot`:
```
TELEGRAM_TOKEN=el_token_que_te_dio_BotFather
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
```

## 3. Ejecutar el Bot (Versión Básica)

```bash
cd /Volumes/Lexar/memozapia/telegram-bot
cp .env.example .env
# Edita .env y pon tu token de Telegram
node bot.js
```

## 4. Usar el Bot

1. Abre Telegram y busca tu bot (el username que elegiste)
2. Envía /start
3. ¡Listo! Ahora puedes:
   - Enviar cualquier mensaje → Se guarda como nota
   - /notes - Ver notas
   - /search [texto] - Buscar
   - /tags - Ver etiquetas
   - /reminder [texto] - Crear recordatorio
   - /task [texto] - Crear tarea

## 5. Conectar Google (Opcional)

Si configuraste las credenciales de Google:
1. Envía /connectgoogle en el bot
2. Abre el enlace que te da
3. Autoriza y copia el código
4. Envía /code TU_CODIGO

Luego podrás usar:
- /calendar - Ver eventos
- /today - Eventos de hoy
- /gmail - Leer emails
- /unread - Emails no leídos

## Notas

- El bot básico funciona SIN Google Calendar/Gmail
- Solo necesitas el token de Telegram
- La transcripción de notas de voz está en desarrollo
