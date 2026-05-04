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

// Endpoint para recibir código de Google OAuth
app.get('/google-callback', (req, res) => {
  const code = req.query.code;
  if (code) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Código de Google</title>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; padding: 40px; text-align: center; background: #0f172a; color: white; }
          .code { background: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 18px; word-break: break-all; }
          button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; }
        </style>
      </head>
      <body>
        <h1>✅ Código de autorización recibido</h1>
        <p>Copia este código y envíalo en Telegram:</p>
        <div class="code" id="code">${code}</div>
        <button onclick="copyCode()">Copiar código</button>
        <p style="margin-top: 20px;">Luego en Telegram escribe:<br><strong>/code ${code}</strong></p>
        <script>
          function copyCode() {
            const code = document.getElementById('code').textContent;
            navigator.clipboard.writeText(code);
            alert('Código copiado!');
          }
        </script>
      </body>
      </html>
    `);
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
