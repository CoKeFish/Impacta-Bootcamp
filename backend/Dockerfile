FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./

RUN npm ci --omit=dev

COPY backend/ .

EXPOSE 3000

CMD ["npm", "start"]
