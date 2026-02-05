FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache python3 make g++

# Copiar package.json primero para aprovechar cache de Docker
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Puerto de la aplicación
EXPOSE 3000

# Comando para desarrollo con hot-reload
CMD ["npm", "run", "dev"]
