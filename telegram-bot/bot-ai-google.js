require('dotenv').config();
const { Telegraf } = require('telegraf');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const USE_EXTERNAL_AI = (process.env.USE_EXTERNAL_AI || 'false').toLowerCase() === 'true';
const fs = require('fs');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_BASE = process.env.MEMOZAPIA_API_BASE || process.env.API_BASE || 'http://localhost:3002';
const API_URL = `${API_BASE}/api/notes`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${API_BASE}/google-callback`;

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
    ctx.replyWithMarkdown(
        '*🧠 Memozapia AI Bot*\n\n' +
        'Tu asistente personal con IA y Google.\n\n' +
        '*Comandos:*\n' +
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
        '_Cualquier mensaje se guarda como nota_'
    );
});

// Comando /help
bot.help((ctx) => {
    ctx.replyWithMarkdown(
        '*Ayuda Memozapia AI*\n\n' +
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
        let msg = '*Tus notas:*\n\n';
        notes.forEach((note, i) => {
            const title = note.title || 'Sin título';
            const preview = note.content.substring(0, 50).replace(/\n/g, ' ');
            msg += (i + 1) + '. *' + title + '*\n   ' + preview + '...\n\n';
        });
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /notes:', error?.response?.data || error?.message || error);
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
        let msg = '*Resultados:*\n\n';
        notes.slice(0, 10).forEach((note, i) => {
            const title = note.title || 'Sin título';
            msg += (i + 1) + '. *' + title + '*\n   ' + note.content.substring(0, 40) + '...\n\n';
        });
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /search:', error?.response?.data || error?.message || error);
        ctx.reply('Error en la búsqueda');
    }
});

// Helper: simple extractive summarizer (fallback)
function localSummarize(text, maxSentences = 6) {
    if (!text || text.trim().length === 0) return 'No hay contenido para resumir.';
    // Split into sentences
    const sentences = text.match(/[^.!?\n]+[.!?\n]?/g) || [text];
    const freq = {};
    const words = text.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(Boolean);
    words.forEach(w => { if (w.length > 2) freq[w] = (freq[w] || 0) + 1; });
    const scoreSentence = s => {
        const ws = s.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(Boolean);
        return ws.reduce((sum, w) => sum + (freq[w] || 0), 0) / (ws.length || 1);
    };
    const ranked = sentences.map(s => ({ s, score: scoreSentence(s) }));
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.min(maxSentences, ranked.length)).map(r => r.s.trim());
    return top.join(' ');
}

function localAnswer(text, maxSentences = 3) {
    if (!text || text.trim().length === 0) return 'No hay contenido para procesar.';
    const q = text.toLowerCase();
    const askAboutMemozapia = q.includes('memozapia') || q.includes('¿qué es') || q.includes('que es') || q.includes('what is');
    if (askAboutMemozapia) {
        return 'Memozapia es una aplicación web de "segundo cerebro" para guardar y organizar notas personales: permite crear, editar y eliminar notas, usar etiquetas, buscar por texto y filtrar por etiquetas. Está construida con React en el frontend y Node.js/Express en el backend, y persiste datos en un archivo JSON local.';
    }
    const sentences = text.match(/[^.!?\n]+[.!?\n]?/g) || [text];
    const freq = {};
    const words = text.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(Boolean);
    words.forEach(w => { if (w.length > 2) freq[w] = (freq[w] || 0) + 1; });
    const scoreSentence = s => {
        const ws = s.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(Boolean);
        return ws.reduce((sum, w) => sum + (freq[w] || 0), 0) / (ws.length || 1);
    };
    const ranked = sentences.map(s => ({ s, score: scoreSentence(s) }));
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.min(maxSentences, ranked.length)).map(r => r.s.trim());
    return 'Respuesta (generada localmente):\n' + top.join(' ');
}

// Helper: call OpenAI Chat Completions (if API key present)
async function callOpenAI(prompt) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
    const body = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.2
    };
    const res = await axios.post(url, body, { headers, timeout: 20000 });
    return res.data.choices?.[0]?.message?.content?.trim();
}

// Helper: call Hugging Face inference as alternative
async function callHuggingFace(prompt) {
    const models = [
        'google/flan-t5-small',
        'sshleifer/distilbart-cnn-12-6',
        'facebook/bart-large-cnn',
        'gpt2'
    ];
    const headers = { Authorization: `Bearer ${HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' };
    for (const m of models) {
        try {
            const url = `https://api-inference.huggingface.co/models/${m}`;
            const res = await axios.post(url, { inputs: prompt }, { headers, timeout: 20000 });
            if (!res || !res.data) continue;
            const data = res.data;
            if (Array.isArray(data) && data[0]) {
                if (data[0].generated_text) return data[0].generated_text.trim();
                if (data[0].summary_text) return data[0].summary_text.trim();
                if (typeof data[0] === 'string') return data[0].trim();
            }
            if (data.generated_text) return data.generated_text.trim();
            if (data.summary_text) return data.summary_text.trim();
            if (typeof data === 'string') return data.trim();
        } catch (err) {
            console.error(`HF model ${m} failed:`, err?.response?.status || err?.message || err);
        }
    }
    return null;
}

// Unified askAI: tries OpenAI, then Hugging Face, then local summarizer/fallback
async function askAI(prompt, options = {}) {
    try {
        if (!USE_EXTERNAL_AI) {
            if (options.type === 'summary') return localSummarize(prompt, 6);
            return localAnswer(prompt, 4);
        }
        if (OPENAI_API_KEY) {
            const r = await callOpenAI(prompt);
            if (r) return r;
        }
        if (HUGGINGFACE_TOKEN) {
            const r = await callHuggingFace(prompt);
            if (r) return r;
        }
        if (options.type === 'summary') return localSummarize(prompt, 6);
        return localAnswer(prompt, 4);
    } catch (error) {
        console.error('askAI error:', error?.message || error);
        if (options.type === 'summary') return localSummarize(prompt, 6);
        return 'Error al procesar la petición de IA.';
    }
}

// Comando /ai
bot.command('ai', async (ctx) => {
    const question = ctx.message.text.substring(4).trim();
    if (!question) {
        ctx.reply('Uso: /ai [tu pregunta]');
        return;
    }
    try {
        ctx.reply('🤖 Pensando...');
        const response = await askAI(question);
        ctx.replyWithMarkdown('🧠 *Respuesta:*\n\n' + response);
    } catch (error) {
        console.error('Error /ai:', error?.message || error);
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
            const topics = [...new Set(notes.flatMap(n => n.tags || []))].join(', ');
            let allContent = notes.map((n, i) => `Nota ${i + 1}: ${n.title || ''} ${n.content || ''}`).join('\n\n');
            // If too long, truncate but keep representative content
            if (allContent.length > 3000) allContent = allContent.substring(0, 3000) + '\n\n[...truncado]';

            const prompt = `Resume en español de forma clara y concisa las siguientes notas (5-8 frases), extrae los temas principales, y sugiere 3 acciones concretas basadas en ellas:\n\n${allContent}`;
            const summary = await askAI(prompt, { type: 'summary' });
            ctx.replyWithMarkdown(
                '📝 *Resumen de tus notas:*\n\n' +
                `Tienes ${notes.length} notas recientes.\n` +
                `Temas: ${topics || 'sin etiquetas'}` +
                '\n\n' + summary
            );
    } catch (error) {
        console.error('Error /summary:', error?.message || error);
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
        let msg = '*Próximos eventos:*\n\n';
        events.forEach((event, i) => {
            const start = event.start.dateTime || event.start.date;
            const date = new Date(start).toLocaleDateString('es-ES');
            msg += (i + 1) + '. *' + event.summary + '*\n   ' + date + '\n\n';
        });
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /calendar:', error?.message || error);
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
        let msg = '*Eventos de hoy:*\n\n';
        events.forEach((event, i) => {
            const start = event.start.dateTime || event.start.date;
            const time = new Date(start).toLocaleTimeString('es-ES');
            msg += (i + 1) + '. *' + event.summary + '*\n   ' + time + '\n\n';
        });
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /today:', error?.message || error);
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
        let msg = '*Emails recientes:*\n\n';
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
            msg += '• *' + subject + '*\n  De: ' + from.substring(0, 40) + '\n\n';
        }
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /gmail:', error?.message || error);
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
        let msg = '*Emails no leídos:*\n\n';
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
            msg += '• *' + subject + '*\n  De: ' + from.substring(0, 40) + '\n\n';
        }
        ctx.replyWithMarkdown(msg);
    } catch (error) {
        console.error('Error /unread:', error?.message || error);
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

    ctx.replyWithMarkdown(
        '*Conectar con Google*\n\n' +
        'Haz clic en el siguiente enlace para autorizar:\n\n' +
        '[Autorizar Google](' + authUrl + ')\n\n' +
        'Luego envíame el código usando:\n' +
        '/code TU_CODIGO'
    );
});

// Comando /code
bot.command('code', async (ctx) => {
    const code = ctx.message.text.substring(6).trim();
    if (!code) {
        ctx.reply('Uso: /code TU_CODIGO');
        return;
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        saveGoogleTokens(tokens);
        const userId = ctx.from.id.toString();
        delete userStates[userId];
        saveUserStates(userStates);
        ctx.replyWithMarkdown(
            '*Cuenta de Google conectada!*\n\n' +
            'Ahora puedes usar:\n' +
            '/calendar - Ver eventos\n' +
            '/gmail - Leer emails\n' +
            '/today - Eventos de hoy\n' +
            '/unread - Emails no leídos'
        );
    } catch (error) {
        console.error('Error exchanging code:', error?.message || error);
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
        ctx.replyWithMarkdown('⏰ *Recordatorio guardado*\n\n"' + text + '"');
    } catch (error) {
        console.error('Error /reminder:', error?.message || error);
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
        ctx.replyWithMarkdown('✅ *Tarea guardada*\n\n"' + text + '"');
    } catch (error) {
        console.error('Error /task:', error?.message || error);
        ctx.reply('Error al guardar tarea');
    }
});

// Manejar mensajes de texto (guardar como nota)
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    try {
        const newNote = {
            title: null,
            content: ctx.message.text,
            tags: []
        };
        await axios.post(API_URL, newNote);
        ctx.reply('Nota guardada');
    } catch (error) {
        console.error('Error saving note:', error?.message || error);
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
