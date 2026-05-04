const express = require('express');
const cors = require('cors');
const db = require('./database');
const notesRouter = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/notes', notesRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor backend ejecutándose en puerto ${PORT}`);
  });
}

module.exports = app;
