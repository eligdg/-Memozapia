const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/notes';
const QR_IMAGE_PATH = path.join(__dirname, 'qr-code.png');

// Crear cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "memozapia-bot" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generar QR y guardarlo como imagen
client.on('qr', (qr) => {
    console.log('📱 Generando código QR...');
    
    // Guardar como imagen PNG
    qrcode.toFile(QR_IMAGE_PATH, qr, { width: 500 }, (err) => {
        if (err) {
            console.error('Error al generar imagen QR:', err);
            // Fallback: mostrar en terminal
            const qrcodeTerminal = require('qrcode-terminal');
            qrcodeTerminal.generate(qr, { small: true });
        } else {
            console.log(`✅ Código QR guardado en: ${QR_IMAGE_PATH}`);
            console.log('   Abre esta imagen con: open', QR_IMAGE_PATH);
            console.log('   O escanea el código QR desde la terminal:');
            
            // También mostrar en terminal como respaldo
            const qrcodeTerminal = require('qrcode-terminal');
            qrcodeTerminal.generate(qr, { small: true });
        }
    });
});

// Cuando está listo
client.on('ready', () => {
    console.log('✅ Bot de Memozapia conectado a WhatsApp!');
    console.log('💡 Envía mensajes al bot para guardar notas automáticamente');
    
    // Eliminar imagen QR si existe
    if (fs.existsSync(QR_IMAGE_PATH)) {
        fs.unlinkSync(QR_IMAGE_PATH);
    }
});

// Escuchar mensajes
client.on('message', async (message) => {
    try {
        const contact = await message.getContact();
        const name = contact.pushname || contact.number;
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
            const saved = response.data;

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

// Manejo de errores de autenticación
client.on('auth_failure', (msg) => {
    console.error('Error de autenticación:', msg);
});

// Cuando se desconecta
client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
});

// Inicializar cliente
console.log('🚀 Iniciando bot de WhatsApp...');
client.initialize();

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('Error no manejado:', err);
});
