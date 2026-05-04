require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const API_BASE = process.env.MEMOZAPIA_API_BASE || process.env.API_BASE || 'http://localhost:3002';
const API_URL = `${API_BASE}/api/notes`;

const bot = new Telegraf(TELEGRAM_TOKEN);

// Unified AI helper: OpenAI -> Hugging Face -> local fallback
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const USE_EXTERNAL_AI = (process.env.USE_EXTERNAL_AI || 'false').toLowerCase() === 'true';

function localSummarize(text, maxSentences = 5) {
    if (!text) return 'No hay contenido para procesar.';
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
    return ranked.slice(0, Math.min(maxSentences, ranked.length)).map(r => r.s.trim()).join(' ');
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

async function callOpenAI(prompt) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
    const body = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2
    };
    const res = await axios.post(url, body, { headers, timeout: 20000 });
    return res.data.choices?.[0]?.message?.content?.trim();
}

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
            // possible response shapes
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
            // try next model
        }
    }
    return null;
}

async function askAI(question, options = {}) {
    try {
        if (!USE_EXTERNAL_AI) {
            if (options.type === 'summary') return localSummarize(question, 6);
            return localAnswer(question, 4);
        }
        if (OPENAI_API_KEY) {
            const r = await callOpenAI(question);
            if (r) return r;
        }
        if (HUGGINGFACE_TOKEN) {
            const r = await callHuggingFace(question);
            if (r) return r;
        }
        if (options.type === 'summary') return localSummarize(question, 6);
        return localAnswer(question, 4);
    } catch (error) {
        console.error('askAI error:', error?.message || error);
        if (options.type === 'summary') return localSummarize(question, 6);
        return 'Error al procesar la petición de IA.';
    }
}

// Comando /start
bot.start((ctx) => {
    ctx.reply(
        '🧠 *Memozapia AI Bot*\n\n' +
        'Tu asistente personal con Inteligencia Artificial.\n\n' +
        'Comandos disponibles:\n' +
        '/notes - Ver notas\n' +
        '/search [texto] - Buscar\n' +
        '/tags - Ver etiquetas\n' +
        '/ai [pregunta] - Preguntar a la IA\n' +
        '/summary - Resumen de notas\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea\n' +
        '/help - Ayuda\n\n' +
        'Cualquier mensaje se guarda como nota automáticamente.'
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
        '/summary - Resumen de notas\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea\n' +
        '/connectgoogle - Conectar Google\n' +
        '/calendar - Eventos\n' +
        '/gmail - Emails'
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
        console.error('Error /notes:', error?.response?.data || error.message);
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
        console.error('Error /search:', error?.response?.data || error.message);
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
        console.error('Error /tags:', error?.response?.data || error.message);
        ctx.reply('Error al obtener etiquetas');
    }
});

// Comando /ai - Asistente de IA
bot.command('ai', async (ctx) => {
    const question = ctx.message.text.substring(4).trim();
    if (!question) {
        ctx.reply('Uso: /ai [tu pregunta]');
        return;
    }

    try {
        ctx.reply('🤖 Pensando...');
        const response = await askAI(question);
        ctx.reply('🧠 *Respuesta de IA:*\n\n' + response);
    } catch (error) {
        ctx.reply('Error al procesar con IA');
    }
});

// Comando /summary - Resumen de notas
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
            '📝 *Resumen de tus notas:*\n\n' +
            'Tienes ' + notes.length + ' notas recientes.\n' +
            'Temas principales: ' + [...new Set(notes.flatMap(n => n.tags || []))].join(', ') + '\n\n' +
            'Próximamente la IA generará un resumen detallado.'
        );
    } catch (error) {
        ctx.reply('Error al generar resumen');
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
        ctx.reply('⏰ *Recordatorio guardado*\n\n"' + text + '"');
    } catch (error) {
        console.error('Error /reminder:', error?.response?.data || error.message);
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
        ctx.reply('✅ *Tarea guardada*\n\n"' + text + '"');
    } catch (error) {
        console.error('Error /task:', error?.response?.data || error.message);
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
        console.error('Error saving note:', error?.response?.data || error.message);
        ctx.reply('Error al guardar nota');
    }
});

// Iniciar bot
bot.launch().then(() => {
    console.log('🚀 Bot de Telegram con IA iniciado!');
    console.log('💡 Usa: /start para ver los comandos');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
