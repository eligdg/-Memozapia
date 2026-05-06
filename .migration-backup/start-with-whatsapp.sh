#!/bin/bash

echo "🚀 Iniciando Memozapia con WhatsApp..."
echo ""

# Verificar si los node_modules están instalados
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Instalando dependencias del backend..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Instalando dependencias del frontend..."
    cd frontend && npm install && cd ..
fi

if [ ! -d "whatsapp-bot/node_modules" ]; then
    echo "📦 Instalando dependencias del bot de WhatsApp..."
    cd whatsapp-bot && npm install && cd ..
fi

# Iniciar backend
echo "🔧 Iniciando backend en puerto 3001..."
cd backend
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
cd ..

# Esperar a que el backend esté listo
sleep 2

# Iniciar frontend
echo "🎨 Iniciando frontend en puerto 3000..."
cd frontend
nohup npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
cd ..

# Esperar un poco y luego iniciar bot de WhatsApp
sleep 5
echo "📱 Iniciando bot de WhatsApp (se generará un código QR)..."
cd whatsapp-bot
nohup node bot.js > ../whatsapp-bot.log 2>&1 &
WHATSAPP_PID=$!
echo "   WhatsApp Bot PID: $WHATSAPP_PID"
cd ..

echo ""
echo "✅ Memozapia con WhatsApp está iniciando!"
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo "   WhatsApp Bot: Revisa whatsapp-bot.log para el código QR"
echo ""
echo "📝 Para detener los servidores:"
echo "   kill $BACKEND_PID $FRONTEND_PID $WHATSAPP_PID"
echo ""
echo "📊 Logs disponibles en:"
echo "   - backend.log"
echo "   - frontend.log"
echo "   - whatsapp-bot.log"
echo ""
echo "💡 Escanea el código QR que aparecerá en whatsapp-bot.log con WhatsApp"
echo "   Comandos disponibles: !help, !notes, !search, !tags"
