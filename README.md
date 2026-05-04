# Memozapia - Segundo Cerebro

Aplicación web personal para guardar, organizar y recuperar información de forma sencilla.

## Características

- ✅ Crear notas con título opcional
- ✅ Listar notas ordenadas por fecha (más recientes primero)
- ✅ Búsqueda en tiempo real por palabras clave
- ✅ Etiquetas (tags) para organizar notas
- ✅ Filtrar notas por etiqueta
- ✅ Editar y eliminar notas existentes
- ✅ Interfaz limpia, minimalista y responsive
- ✅ Persistencia local usando archivo JSON
- ✅ Sin autenticación compleja (uso personal)

## Tecnologías

- **Frontend**: React 18 (Create React App)
- **Backend**: Node.js + Express
- **Almacenamiento**: Archivo JSON local (`backend/memozapia.json`)
- **Cliente HTTP**: Axios

## Estructura del Proyecto

```
memozapia/
├── backend/                 # Servidor Node.js + Express
│   ├── server.js           # Servidor principal
│   ├── database.js         # Módulo de almacenamiento JSON
│   ├── routes/
│   │   └── notes.js       # Rutas API para notas y etiquetas
│   ├── package.json
│   └── memozapia.json     # Base de datos (se crea automáticamente)
├── frontend/               # Cliente React
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── NoteList.js
│   │   │   ├── NoteEditor.js
│   │   │   ├── SearchBar.js
│   │   │   └── TagFilter.js
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
├── start.sh               # Script para iniciar todo
├── stop.sh                # Script para detener todo
└── README.md
```

## Instalación Rápida

### Opción 1: Script automático (Recomendado)
```bash
cd /Volumes/Lexar/memozapia
./start.sh
```

### Opción 2: Instalación manual

1. **Instalar dependencias del backend:**
   ```bash
   cd backend
   npm install
   ```

2. **Instalar dependencias del frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

3. **Iniciar el backend (Terminal 1):**
   ```bash
   cd backend
   npm start
   ```
   El servidor se ejecutará en `http://localhost:3001`

4. **Iniciar el frontend (Terminal 2):**
   ```bash
   cd frontend
   npm start
   ```
   La aplicación se abrirá automáticamente en `http://localhost:3000`

## Uso

1. **Crear una nota**: Haz clic en "+ Nueva Nota", escribe título (opcional) y contenido
2. **Añadir etiquetas**: Escribe una etiqueta y haz clic en "Añadir" o presiona Enter
3. **Buscar**: Escribe en el campo de búsqueda para filtrar notas en tiempo real
4. **Filtrar por etiqueta**: Haz clic en cualquier etiqueta en la sección "Etiquetas"
5. **Editar**: Haz clic en una nota para abrirla y modificarla
6. **Eliminar**: Haz clic en la "×" en la esquina de la nota

## API Endpoints

- `GET /api/notes` - Listar notas (parámetros opcionales: `search`, `tag`)
- `GET /api/notes/:id` - Obtener una nota específica
- `POST /api/notes` - Crear nueva nota
- `PUT /api/notes/:id` - Actualizar nota existente
- `DELETE /api/notes/:id` - Eliminar nota
- `GET /api/tags/all` - Obtener todas las etiquetas

## Notas de Implementación

- **Almacenamiento**: Se usa un archivo JSON local (`memozapia.json`) en lugar de SQLite para evitar problemas de compilación nativa
- **Búsqueda**: Coincidencias parciales en título y contenido (case-insensitive)
- **Ordenamiento**: Las notas se ordenan por fecha de actualización (más recientes primero)
- **Persistencia**: Todos los cambios se guardan automáticamente en el archivo JSON

## Detener la Aplicación

```bash
./stop.sh
```

O manualmente:
```bash
pkill -f "node server.js"
pkill -f "react-scripts start"
```

## Solución de Problemas

- Si el puerto 3000 o 3001 está ocupado, puedes cambiarlo en `frontend/package.json` y `backend/server.js`
- Si hay errores de instalación, intenta eliminar `node_modules` y `package-lock.json` en ambos directorios y ejecutar `npm install` nuevamente

## Licencia

MIT - Proyecto para uso personal
