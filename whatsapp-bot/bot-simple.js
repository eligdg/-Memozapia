const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/notes';
const QR_HTML_PATH = path.join(__dirname, 'qr-code.html');

// Crear cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "memozapia-bot" })
});

// Generar página HTML con QR
client.on('qr', (qr) => {
    console.log('📱 Generando código QR...');
    
    // Crear archivo HTML con el QR
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Memozapia - Código QR</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        h1 { margin-bottom: 1rem; }
        #qrcode { margin: 2rem 0; }
        .instructions {
            margin-top: 2rem;
            text-align: left;
            max-width: 400px;
        }
        .instructions ol { margin-left: 1.5rem; }
        .instructions li { margin: 0.5rem 0; }
        .footer { margin-top: 2rem; font-size: 0.9rem; opacity: 0.8; }
    </style>
    <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🧠 Memozapia</h1>
        <p>Escanea este código QR con WhatsApp</p>
        <div id="qrcode"></div>
        <div class="instructions">
            <ol>
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca Menú (⋮) o Configuración</li>
                <li>Dispositivos vinculados</li>
                <li>Vincular un dispositivo</li>
                <li>Escanea este código QR</li>
            </ol>
        </div>
        <div class="footer">
            El código se actualizará automáticamente
        </div>
    </div>
    <script>
        QRCode.toCanvas(document.getElementById('qrcode'), ${JSON.stringify(qr)}, {
            width: 300,
            margin: 2
        }, function (error) {
            if (error) console.error(error);
        });
    </script>
</body>
</html>`;
    
    fs.writeFileSync(QR_HTML_PATH, html);
    console.log('✅ Abre esta URL en tu navegador para escanear el QR:');
    console.log(`   file://${QR_HTML_PATH}`);
    console.log(`   O ejecuta: open "${QR_HTML_PATH}"`);
});

// Cuando está listo
client.on('ready', () => {
    console.log('✅ Bot de Memozapia conectado a WhatsApp!');
    console.log('💡 Envía mensajes al bot para guardar notas automáticamente');
    
    // Eliminar archivo HTML del QR
    if (fs.existsSync(QR_HTML_PATH)) {
        fs.unlinkSync(QR_HTML_PATH);
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

// Inicializar cliente
console.log('🚀 Iniciando bot de WhatsApp...');
client.initialize();

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('Error no manejado:', err);
});
