#!/bin/bash

echo "🛑 Deteniendo Memozapia..."

# Detener procesos de node
pkill -f "node server.js"
pkill -f "react-scripts start"

echo "✅ Servidores detenidos"
