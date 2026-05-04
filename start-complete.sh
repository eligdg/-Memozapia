#!/bin/bash

echo "🚀 Iniciando Memozapia Completo..."
echo ""

# 1. Verificar backend
if ! ps aux | grep -q "[n]ode server.js"; then
    echo "📡 Iniciando backend..."
    cd backend
    nohup node server.js > ../backend.log 2>&1 &
    echo "   Backend iniciado"
    cd ..
    sleep 2
fi

# 2. Verificar frontend
if ! ps aux | grep -q "[n]ode.*react-scripts"; then
    echo "🎨 Iniciando frontend..."
    cd frontend
    nohup npm start > ../frontend.log 2>&1 &
    echo "   Frontend iniciado"
    cd ..
    sleep 3
fi

# 3. Configurar y iniciar Telegram Bot
cd telegram-bot

if [ ! -f ".env" ]; then
    echo "⚠️  No se encontró .env en telegram-bot"
    echo "   Creando desde .env.example..."
    cp .env.example .env
    echo "   ✅ Edita telegram-bot/.env con tu token de Telegram"
fi

# Verificar token
TOKEN=$(grep TELEGRAM_TOKEN .env | cut -d'=' -f2)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "tu_token_de_telegram_aqui" ]; then
    echo "❌ Necesitas configurar TELEGRAM_TOKEN en telegram-bot/.env"
    echo "   1. Habla con @BotFather en Telegram"
    echo "   2. Crea un bot con /newbot"
    echo "   3. Copia el token en telegram-bot/.env"
    exit 1
fi

# Iniciar bot con IA y Google
echo "📱 Iniciando Telegram Bot con IA y Google..."
nohup node bot-ai-google.js > ../telegram-bot.log 2>&1 &
BOT_PID=$!
echo "   Bot PID: $BOT_PID"
cd ..

sleep 2

echo ""
echo "✅ Memozapia Completo está listo!"
echo ""
echo "📊 Accesos:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001/api/notes"
echo ""
echo "📱 Telegram Bot:"
echo "   1. Busca tu bot en Telegram"
echo "   2. Envía /start"
echo ""
echo "🤖 Funcionalidades:"
echo "   ✅ Guardar notas (envía cualquier mensaje)"
echo "   ✅ /notes - Ver notas"
echo "   ✅ /ai [pregunta] - Asistente IA"
echo "   ✅ /calendar - Google Calendar"
echo "   ✅ /gmail - Leer emails"
echo "   ✅ /reminder, /task - Recordatorios y tareas"
echo ""
echo "📋 Logs disponibles:"
echo "   backend.log"
echo "   frontend.log"
echo "   telegram-bot.log"
