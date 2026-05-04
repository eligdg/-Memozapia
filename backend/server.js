const express = require('express');
const cors = require('cors');
const db = require('./database');
const notesRouter = require('./routes/notes');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/notes', notesRouter);

// Endpoint para recibir código de Google OAuth y enviarlo por Telegram
app.get('/google-callback', async (req, res) => {
  const code = req.query.code;
  if (code) {
    try {
      // Enviar el código al bot de Telegram usando la API
      const TELEGRAM_TOKEN = '8656098649:AAFg1mP4wzte98wXU0qOraugGMyCEmQRQrE';
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: '7656923890',
        text: `Código de Google recibido: ${code}\n\nUsa el comando: /code ${code}`
      });
      res.send('✅ Código recibido. Revisa tu Telegram.');
    } catch (error) {
      res.send('Error al procesar el código');
    }
  } else {
    res.send('No se recibió ningún código');
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor backend ejecutándose en puerto ${PORT}`);
  });
}

module.exports = app;
