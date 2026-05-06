const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/notes';
const SESSION_DIR = path.join(__dirname, '.wwebjs_auth');

// Crear cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ 
        clientId: "memozapia-bot",
        dataPath: SESSION_DIR
    })
});

// Generar QR y mostrar instrucciones
client.on('qr', (qr) => {
    console.log('\n📱 Código QR generado!');
    console.log('Para escanear, visita: http://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr));
    console.log('\nO guarda este código como imagen ejecutando:');
    console.log('curl "http://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr) + '" > qr-code.png');
    console.log('Luego abre qr-code.png con: open qr-code.png\n');
});

// Cuando está listo
client.on('ready', () => {
    console.log('✅ Bot de Memozapia conectado a WhatsApp!');
    console.log('💡 Envía mensajes al bot para guardar notas automáticamente');
    console.log('📝 Comandos: !help, !notes, !search [texto], !tags\n');
});

// Escuchar mensajes
client.on('message', async (message) => {
    try {
        const body = message.body.toLowerCase().trim();

        // Comandos
        if (body === '!help' || body === '!ayuda') {
            await client.sendMessage(message.from, 
                `🧠 *Memozapia - Tu Segundo Cerebro*\n\n` +
                `📝 *Comandos disponibles:*\n` +
                `• *!notes* - Ver todas las notas\n` +
                `• *!search [texto]* - Buscar notas\n` +
                `• *!tags* - Ver etiquetas\n` +
                `• *!help* - Ver esta ayuda\n\n` +
                `💡 *Cualquier otro mensaje se guardará como nota automáticamente*`
            );
            return;
        }

        // Comando: Ver notas
        if (body === '!notes' || body === '!notas') {
            const response = await axios.get(API_URL);
            const notes = response.data.slice(0, 10);

            if (notes.length === 0) {
                await client.sendMessage(message.from, '📭 No tienes notas guardadas aún.');
                return;
            }

            let msg = '📝 *Tus notas recientes:*\n\n';
            notes.forEach((note, i) => {
                const title = note.title || 'Sin título';
                const preview = note.content.substring(0, 50).replace(/\n/g, ' ');
                msg += `${i + 1}. *${title}*\n   ${preview}...\n\n`;
            });
            await client.sendMessage(message.from, msg);
            return;
        }

        // Comando: Buscar notas
        if (body.startsWith('!search ') || body.startsWith('!buscar ')) {
            const query = message.body.substring(message.body.indexOf(' ') + 1);
            const response = await axios.get(`${API_URL}?search=${encodeURIComponent(query)}`);
            const notes = response.data;

            if (notes.length === 0) {
                await client.sendMessage(message.from, `🔍 No se encontraron notas con "${query}"`);
                return;
            }

            let msg = `🔍 *Resultados para: "${query}"*\n\n`;
            notes.slice(0, 10).forEach((note, i) => {
                const title = note.title || 'Sin título';
                msg += `${i + 1}. *${title}*\n   ${note.content.substring(0, 40)}...\n\n`;
            });
            await client.sendMessage(message.from, msg);
            return;
        }

        // Comando: Ver etiquetas
        if (body === '!tags' || body === '!etiquetas') {
            const response = await axios.get(`${API_URL}/tags/all`);
            const tags = response.data;

            if (tags.length === 0) {
                await client.sendMessage(message.from, '🏷️ No tienes etiquetas aún.');
                return;
            }

            const tagList = tags.map(t => `#${t.name}`).join(', ');
            await client.sendMessage(message.from, `🏷️ *Tus etiquetas:*\n\n${tagList}`);
            return;
        }

        // Si no es un comando, guardar como nota
        if (!body.startsWith('!')) {
            const newNote = {
                title: null,
                content: message.body,
                tags: []
            };

            const response = await axios.post(API_URL, newNote);
            
            await client.sendMessage(message.from, 
                `✅ *Nota guardada*\n\n` +
                `📝 "${message.body.substring(0, 100)}${message.body.length > 100 ? '...' : ''}"\n\n` +
                `💡 Envía *!notes* para ver todas tus notas`
            );
        }

    } catch (error) {
        console.error('Error procesando mensaje:', error.message);
        await client.sendMessage(message.from, '❌ Error al procesar tu mensaje. Intenta de nuevo.');
    }
});

// Manejo de errores
client.on('auth_failure', (msg) => {
    console.error('Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
    client.destroy();
    client.initialize();
});

// Inicializar cliente
console.log('🚀 Iniciando bot de WhatsApp...');
console.log('Espera mientras se genera el código QR...\n');
client.initialize();

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
    console.error('Error no manejado:', err);
});
