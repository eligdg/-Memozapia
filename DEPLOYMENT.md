# Despliegue en Vercel - Memozapia

## 1. PREPARAR FRONTEND PARA PRODUCCIÓN

Edita `frontend/src/App.js` y cambia:
```javascript
const API_URL = 'https://tu-backend-url.onrender.com/api/notes';
const TAGS_URL = 'https://tu-backend-url.onrender.com/api/tags/all';
```

## 2. DESPLEGAR BACKEND (Render.com - Gratis)

1. Ve a [render.com](https://render.com) y crea cuenta
2. "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Configuración:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node server.js`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
5. Obtendrás una URL como: `https://memozapia-backend.onrender.com`

## 3. DESPLEGAR FRONTEND (Vercel - Gratis)

1. Ve a [vercel.com](https://vercel.com)
2. "New Project" → Importa tu repositorio de GitHub
3. Configuración:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
4. Despliegue y obtendrás: `https://memozapia.vercel.app`

## 4. CONFIGURAR DOMINIO PERSONALIZADO (Opcional)

En Vercel:
- Settings → Domains → Añade tu dominio

## 5. ACTUALIZAR TELEGRAM BOT

En `telegram-bot/.env`, añade:
```
API_URL=https://tu-backend-url.onrender.com/api/notes
```

## 6. COMANDOS PARA SUBIR A GITHUB

```bash
cd /Volumes/Lexar/memozapia
git remote add origin https://github.com/TU_USUARIO/memozapia.git
git branch -M main
git push -u origin main
```

## 7. ACCESO DESDE CUALQUIER DISPOSITIVO

Una vez desplegado:
- **Móvil/Tablet/Portátil**: Ve a `https://memozapia.vercel.app`
- **Telegram**: Sigue funcionando igual
- **Google Calendar/Gmail**: Funciona desde cualquier lugar

## NOTAS IMPORTANTES:

- El backend gratuito en Render "duerme" tras 15 min de inactividad
- El primer request puede tardar 30-60 segundos
- Para mantenerlo despierto, usa servicios como `cron-job.org`
