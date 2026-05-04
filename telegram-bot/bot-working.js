require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const fs = require('fs');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.API_URL || 'http://localhost:3001/api/notes';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const TOKENS_FILE = './google-tokens.json';
const USER_STATES_FILE = './user-states.json';

let oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

// Cargar tokens
function loadGoogleTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
            oauth2Client.setCredentials(tokens);
            return true;
        }
    } catch (error) {
        console.error('Error cargando tokens:', error);
    }
    return false;
}

function saveGoogleTokens(tokens) {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

function loadUserStates() {
    try {
        if (fs.existsSync(USER_STATES_FILE)) {
            return JSON.parse(fs.readFileSync(USER_STATES_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error cargando estados:', error);
    }
    return {};
}

function saveUserStates(states) {
    fs.writeFileSync(USER_STATES_FILE, JSON.stringify(states, null, 2));
}

loadGoogleTokens();
let userStates = loadUserStates();

const bot = new Telegraf(TELEGRAM_TOKEN);

// Comando /start
bot.start((ctx) => {
    ctx.reply(
        '🧠 Memozapia AI Bot\n\n' +
        'Tu asistente personal con IA y Google.\n\n' +
        'Comandos disponibles:\n' +
        '/notes - Ver notas\n' +
        '/search [texto] - Buscar\n' +
        '/tags - Ver etiquetas\n' +
        '/ai [pregunta] - Preguntar a IA\n' +
        '/summary - Resumen de notas\n' +
        '/calendar - Eventos Calendar\n' +
        '/today - Eventos de hoy\n' +
        '/gmail - Emails recientes\n' +
        '/unread - Emails no leídos\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea\n' +
        '/connectgoogle - Conectar Google\n' +
        '/help - Ayuda\n\n' +
        'Cualquier mensaje se guarda como nota'
    );
});

// Comando /help
bot.help((ctx) => {
    ctx.reply(
        'Ayuda Memozapia AI\n\n' +
        '/notes - Lista notas\n' +
        '/search [texto] - Busca\n' +
        '/tags - Etiquetas\n' +
        '/ai [pregunta] - Pregunta a la IA\n' +
        '/summary - Resumen\n' +
        '/calendar - Eventos\n' +
        '/today - Hoy\n' +
        '/gmail - Emails\n' +
        '/unread - No leídos\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea\n' +
        '/connectgoogle - Conectar Google'
    );
});

// Comando /notes
bot.command('notes', async (ctx) => {
    try {
        const response = await axios.get(API_URL);
        const notes = response.data.slice(0, 10);
        if (notes.length === 0) {
            ctx.reply('No tienes notas');
            return;
        }
        let msg = 'Tus notas:\n\n';
        notes.forEach((note, i) => {
            const title = note.title || 'Sin título';
            const preview = note.content.substring(0, 50).replace(/\n/g, ' ');
            msg += (i + 1) + '. ' + title + '\n   ' + preview + '...\n\n';
        });
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error al obtener notas');
    }
});

// Comando /search
bot.command('search', async (ctx) => {
    const query = ctx.message.text.substring(8).trim();
    if (!query) {
        ctx.reply('Uso: /search [texto]');
        return;
    }
    try {
        const response = await axios.get(API_URL + '?search=' + encodeURIComponent(query));
        const notes = response.data;
        if (notes.length === 0) {
            ctx.reply('No se encontraron notas');
            return;
        }
        let msg = 'Resultados:\n\n';
        notes.slice(0, 10).forEach((note, i) => {
            const title = note.title || 'Sin título';
            msg += (i + 1) + '. ' + title + '\n   ' + note.content.substring(0, 40) + '...\n\n';
        });
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error en la búsqueda');
    }
});

// Comando /tags
bot.command('tags', async (ctx) => {
    try {
        const response = await axios.get(API_URL + '/tags/all');
        const tags = response.data;
        if (tags.length === 0) {
            ctx.reply('No tienes etiquetas');
            return;
        }
        const tagList = tags.map(t => '#' + t.name).join(', ');
        ctx.reply('Tus etiquetas:\n\n' + tagList);
    } catch (error) {
        ctx.reply('Error al obtener etiquetas');
    }
});

// Comando /ai
bot.command('ai', async (ctx) => {
    const question = ctx.message.text.substring(4).trim();
    if (!question) {
        ctx.reply('Uso: /ai [tu pregunta]');
        return;
    }
    try {
        ctx.reply('🤖 Pensando...');
        const answer = '🧠 Respuesta simulada: Entiendo tu pregunta sobre "' + question + '". Próximamente tendré acceso a modelos reales de IA.';
        ctx.reply('🧠 Respuesta:\n\n' + answer);
    } catch (error) {
        ctx.reply('Error al procesar con IA');
    }
});

// Comando /summary
bot.command('summary', async (ctx) => {
    try {
        const response = await axios.get(API_URL);
        const notes = response.data.slice(0, 20);
        if (notes.length === 0) {
            ctx.reply('No tienes notas para resumir');
            return;
        }
        let allContent = notes.map(n => n.content).join(' ');
        if (allContent.length > 1000) {
            allContent = allContent.substring(0, 1000) + '...';
        }
        ctx.reply(
            '📝 Resumen de tus notas:\n\n' +
            'Tienes ' + notes.length + ' notas recientes.\n' +
            'Temas: ' + [...new Set(notes.flatMap(n => n.tags || []))].join(', ') + '\n\n' +
            'La IA generará un resumen detallado próximamente'
        );
    } catch (error) {
        ctx.reply('Error al generar resumen');
    }
});

// Comando /calendar
bot.command('calendar', async (ctx) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        ctx.reply('Primero conecta Google con /connectgoogle');
        return;
    }
    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = res.data.items;
        if (!events || events.length === 0) {
            ctx.reply('No tienes eventos próximos');
            return;
        }
        let msg = 'Próximos eventos:\n\n';
        events.forEach((event, i) => {
            const start = event.start.dateTime || event.start.date;
            const date = new Date(start).toLocaleDateString('es-ES');
            msg += (i + 1) + '. ' + event.summary + '\n   ' + date + '\n\n';
        });
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error al obtener eventos');
    }
});

// Comando /today
bot.command('today', async (ctx) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        ctx.reply('Primero conecta Google con /connectgoogle');
        return;
    }
    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay,
            timeMax: endOfDay,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = res.data.items;
        if (!events || events.length === 0) {
            ctx.reply('No tienes eventos para hoy');
            return;
        }
        let msg = 'Eventos de hoy:\n\n';
        events.forEach((event, i) => {
            const start = event.start.dateTime || event.start.date;
            const time = new Date(start).toLocaleTimeString('es-ES');
            msg += (i + 1) + '. ' + event.summary + '\n   ' + time + '\n\n';
        });
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error al obtener eventos de hoy');
    }
});

// Comando /gmail
bot.command('gmail', async (ctx) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        ctx.reply('Primero conecta Google con /connectgoogle');
        return;
    }
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 5,
            labelIds: ['INBOX'],
        });
        if (!res.data.messages || res.data.messages.length === 0) {
            ctx.reply('No tienes emails recientes');
            return;
        }
        let msg = 'Emails recientes:\n\n';
        for (const message of res.data.messages.slice(0, 5)) {
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject'],
            });
            const headers = email.data.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(Sin asunto)';
            msg += '• ' + subject + '\n  De: ' + from.substring(0, 40) + '\n\n';
        }
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error al obtener emails');
    }
});

// Comando /unread
bot.command('unread', async (ctx) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        ctx.reply('Primero conecta Google con /connectgoogle');
        return;
    }
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 5,
            q: 'is:unread',
        });
        if (!res.data.messages || res.data.messages.length === 0) {
            ctx.reply('No tienes emails no leídos');
            return;
        }
        let msg = 'Emails no leídos:\n\n';
        for (const message of res.data.messages.slice(0, 5)) {
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject'],
            });
            const headers = email.data.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(Sin asunto)';
            msg += '• ' + subject + '\n  De: ' + from.substring(0, 40) + '\n\n';
        }
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error al obtener emails no leídos');
    }
});

// Comando /connectgoogle
bot.command('connectgoogle', (ctx) => {
    const userId = ctx.from.id.toString();
    userStates[userId] = { action: 'oauth_google' };
    saveUserStates(userStates);

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/gmail.readonly',
        ],
        prompt: 'consent',
    });

    ctx.reply(
        'Conectar con Google\n\n' +
        'Haz clic en el siguiente enlace para autorizar:\n\n' +
        authUrl + '\n\n' +
        'Luego envíame el código usando:\n' +
        '/code TU_CÓDIGO'
    );
});

// Comando /code
bot.command('code', async (ctx) => {
    const code = ctx.message.text.substring(6).trim();
    if (!code) {
        ctx.reply('Uso: /code TU_CÓDIGO');
        return;
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        saveGoogleTokens(tokens);
        const userId = ctx.from.id.toString();
        delete userStates[userId];
        saveUserStates(userStates);
        ctx.reply(
            'Cuenta de Google conectada!\n\n' +
            'Ahora puedes usar:\n' +
            '/calendar - Ver eventos\n' +
            '/gmail - Leer emails\n' +
            '/today - Eventos de hoy\n' +
            '/unread - Emails no leídos'
        );
    } catch (error) {
        ctx.reply('Error al intercambiar el código');
    }
});

// Comando /reminder
bot.command('reminder', async (ctx) => {
    const text = ctx.message.text.substring(10).trim();
    if (!text) {
        ctx.reply('Uso: /reminder [texto]');
        return;
    }
    try {
        const newNote = {
            title: 'Recordatorio: ' + text.substring(0, 50),
            content: '⏰ Recordatorio: ' + text + '\nCreado: ' + new Date().toLocaleString('es-ES'),
            tags: ['recordatorio']
        };
        await axios.post(API_URL, newNote);
        ctx.reply('⏰ Recordatorio guardado:\n"' + text + '"');
    } catch (error) {
        ctx.reply('Error al guardar recordatorio');
    }
});

// Comando /task
bot.command('task', async (ctx) => {
    const text = ctx.message.text.substring(6).trim();
    if (!text) {
        ctx.reply('Uso: /task [texto]');
        return;
    }
    try {
        const newNote = {
            title: 'Tarea: ' + text.substring(0, 50),
            content: '✅ Tarea pendiente:\n' + text + '\nCreada: ' + new Date().toLocaleString('es-ES'),
            tags: ['tarea', 'pendiente']
        };
        await axios.post(API_URL, newNote);
        ctx.reply('✅ Tarea guardada:\n"' + text + '"');
    } catch (error) {
        ctx.reply('Error al guardar tarea');
    }
});

// Manejar mensajes de texto (guardar como nota) - ESTO ES LO QUE FALTABA
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    try {
        const newNote = {
            title: null,
            content: ctx.message.text,
            tags: []
        };
        await axios.post(API_URL, newNote);
        ctx.reply('✅ Nota guardada');
    } catch (error) {
        ctx.reply('Error al guardar nota');
    }
});

// Iniciar bot
bot.launch().then(() => {
    console.log('🚀 Bot de Telegram con IA y Google iniciado!');
    console.log('💡 Usa: /start para ver los comandos');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
