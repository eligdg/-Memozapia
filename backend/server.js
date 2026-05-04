const express = require('express');
const cors = require('cors');
const db = require('./database');
const notesRouter = require('./routes/notes');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas API
app.use('/api/notes', notesRouter);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
});

module.exports = app;
