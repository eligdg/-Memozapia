require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const API_URL = 'http://localhost:3001/api/notes';

const bot = new Telegraf(TELEGRAM_TOKEN);

// AI助手函数（使用Hugging Face免费API）
async function askAI(question) {
    try {
        // 使用Hugging Face的免费对话模型
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
            { inputs: question },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        if (response.data && response.data[0] && response.data[0].generated_text) {
            return response.data[0].generated_text;
        }
        return 'Lo siento, no pude procesar tu pregunta.';
    } catch (error) {
        console.error('Error en IA:', error.message);
        return '🤖 Soy tu asistente AI. Por ahora puedo ayudarte a organizar tus notas. ¡Próximamente tendré más capacidades!';
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
