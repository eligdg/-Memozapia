require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = 'http://localhost:3001/api/notes';

if (!TELEGRAM_TOKEN) {
    console.error('ERROR: Necesitas configurar TELEGRAM_TOKEN en el archivo .env');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);

// Comando /start
bot.start((ctx) => {
    ctx.reply(
        'Bienvenido a Memozapia Bot!\n\n' +
        'Tu segundo cerebro personal.\n\n' +
        'Comandos disponibles:\n' +
        '/notes - Ver notas\n' +
        '/search [texto] - Buscar\n' +
        '/tags - Ver etiquetas\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea\n' +
        '/help - Ayuda\n\n' +
        'Cualquier mensaje se guarda como nota automaticamente.'
    );
});

// Comando /help
bot.help((ctx) => {
    ctx.reply(
        'Ayuda Memozapia\n\n' +
        '/notes - Lista notas\n' +
        '/search [texto] - Busca\n' +
        '/tags - Etiquetas\n' +
        '/reminder [texto] - Recordatorio\n' +
        '/task [texto] - Tarea'
    );
});

// Comando /notes
bot.command('notes', async (ctx) => {
    try {
        const response = await axios.get(API_URL);
        const notes = response.data.slice(0, 10);
        if (notes.length === 0) {
            ctx.reply('No tienes notas guardadas');
            return;
        }
        let msg = 'Tus notas:\n\n';
        notes.forEach((note, i) => {
            const title = note.title || 'Sin titulo';
            const preview = note.content.substring(0, 50);
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
            const title = note.title || 'Sin titulo';
            msg += (i + 1) + '. ' + title + '\n   ' + note.content.substring(0, 40) + '...\n\n';
        });
        ctx.reply(msg);
    } catch (error) {
        ctx.reply('Error en la busqueda');
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
            content: 'Recordatorio: ' + text + '\nCreado: ' + new Date().toLocaleString('es-ES'),
            tags: ['recordatorio']
        };
        await axios.post(API_URL, newNote);
        ctx.reply('Recordatorio guardado:\n"' + text + '"');
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
            content: 'Tarea pendiente:\n' + text + '\nCreada: ' + new Date().toLocaleString('es-ES'),
            tags: ['tarea', 'pendiente']
        };
        await axios.post(API_URL, newNote);
        ctx.reply('Tarea guardada:\n"' + text + '"');
    } catch (error) {
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
        const preview = ctx.message.text.substring(0, 100);
        ctx.reply('Nota guardada:\n"' + preview + (ctx.message.text.length > 100 ? '...' : '"'));
    } catch (error) {
        ctx.reply('Error al guardar nota');
    }
});

// Manejar notas de voz
bot.on('voice', (ctx) => {
    ctx.reply('Nota de voz recibida. Proximamente se transcribira.');
});

// Iniciar bot
bot.launch().then(() => {
    console.log('Bot de Telegram iniciado!');
    console.log('Usa: /start para ver los comandos');
});

// Cierre elegante
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
