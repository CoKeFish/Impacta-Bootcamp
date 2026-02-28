FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

ARG VITE_ACCESLY_APP_ID
ENV VITE_ACCESLY_APP_ID=$VITE_ACCESLY_APP_ID

ARG VITE_CONTRACT_ID
ENV VITE_CONTRACT_ID=$VITE_CONTRACT_ID

ARG VITE_XLM_SAC_ADDRESS
ENV VITE_XLM_SAC_ADDRESS=$VITE_XLM_SAC_ADDRESS

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
