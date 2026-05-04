#!/bin/bash
echo "🔧 CONFIGURACIÓN DE GOOGLE CALENDAR Y GMAIL"
echo "=========================================="
echo ""
echo "Sigue estos pasos para configurar Google:"
echo ""
echo "1. Ve a: https://console.cloud.google.com/"
echo "2. Crea un nuevo proyecto (o selecciona uno existente)"
echo "3. Habilita las APIs:"
echo "   - Google Calendar API"
echo "   - Gmail API"
echo ""
echo "4. Crea credenciales OAuth 2.0:"
echo "   - Ve a 'Credenciales' → 'Crear credenciales' → 'ID de cliente de OAuth'"
echo "   - Tipo: 'Aplicación web'"
echo "   - Nombre: 'Memozapia Bot'"
echo ""
echo "5. En 'URIs de redirección autorizados' añade:"
echo "   http://localhost:3002/oauth2callback"
echo ""
echo "6. Descarga el JSON o copia:"
echo "   - Client ID"
echo "   - Client Secret"
echo ""
echo "7. Edita el archivo telegram-bot/.env:"
echo "   GOOGLE_CLIENT_ID=tu_client_id"
echo "   GOOGLE_CLIENT_SECRET=tu_client_secret"
echo ""
echo "8. Reinicia el bot:"
echo "   killall node"
echo "   cd /Volumes/Lexar/memozapia"
echo "   ./start-complete.sh"
echo ""
echo "9. En Telegram envía: /connectgoogle"
echo "   Abre el enlace, autoriza, y envía: /code TU_CODIGO"
echo ""
echo "=========================================="
echo "¿Ya tienes el Client ID y Client Secret? (y/n)"
read respuesta

if [ "$respuesta" = "y" ]; then
    echo ""
    echo "Edita el archivo .env ahora:"
    echo "Presiona Enter para abrir el editor..."
    read
    nano /Volumes/Lexar/memozapia/telegram-bot/.env
    
    echo ""
    echo "¿Quieres reiniciar el bot ahora? (y/n)"
    read reiniciar
    if [ "$reiniciar" = "y" ]; then
        echo "Reiniciando bot..."
        pkill -f "node bot"
        sleep 2
        cd /Volumes/Lexar/memozapia
        ./start-complete.sh
    fi
fi
