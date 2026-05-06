#!/bin/bash

echo "🚀 Iniciando Bot de Telegram - Memozapia..."
echo ""

# Verificar si existe el archivo .env
if [ ! -f "telegram-bot/.env" ]; then
    echo "⚠️  No se encontró el archivo telegram-bot/.env"
    echo "📝 Creando desde .env.example..."
    cp telegram-bot/.env.example telegram-bot/.env
    echo "✅ Edita telegram-bot/.env y agrega tu token de Telegram"
    echo "   Obtén el token hablando con @BotFather en Telegram"
    exit 1
fi

# Verificar si el token está configurado
TOKEN=$(grep TELEGRAM_TOKEN telegram-bot/.env | cut -d'=' -f2)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "tu_token_de_telegram_aqui" ]; then
    echo "❌ Necesitas configurar TELEGRAM_TOKEN en telegram-bot/.env"
    echo "   1. Habla con @BotFather en Telegram"
    echo "   2. Crea un bot con /newbot"
    echo "   3. Copia el token en telegram-bot/.env"
    exit 1
fi

# Iniciar el bot
echo "📱 Iniciando bot de Telegram..."
cd telegram-bot
nohup node bot.js > ../telegram-bot.log 2>&1 &
BOT_PID=$!
echo "   Bot PID: $BOT_PID"
cd ..

sleep 2

echo ""
echo "✅ Bot de Telegram iniciado!"
echo ""
echo "📝 Siguientes pasos:"
echo "   1. Abre Telegram y busca tu bot"
echo "   2. Envía /start para comenzar"
echo ""
echo "💡 Comandos disponibles:"
echo "   /notes - Ver notas"
echo "   /search [texto] - Buscar"
echo "   /tags - Ver etiquetas"
echo "   /reminder [texto] - Recordatorio"
echo "   /task [texto] - Tarea"
echo ""
echo "📊 Log disponible en: telegram-bot.log"
