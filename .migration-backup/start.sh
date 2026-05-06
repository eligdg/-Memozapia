#!/bin/bash

echo "🚀 Iniciando Memozapia - Segundo Cerebro"
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

echo ""
echo "✅ Memozapia está listo!"
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "📝 Para detener los servidores:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📊 Logs disponibles en:"
echo "   - backend.log"
echo "   - frontend.log"
