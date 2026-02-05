FROM node:20-bookworm-slim

WORKDIR /app

RUN apt update && apt install -y \
    curl \
    git \
    bash \
    python3 \
    build-essential \
    pkg-config \
    libssl-dev \
    libdbus-1-dev \
    libudev-dev \
 && rm -rf /var/lib/apt/lists/*

# Instalar Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN rustup target add wasm32-unknown-unknown

RUN cargo install --locked soroban-cli

COPY package*.json ./
RUN if [ -f package.json ]; then npm install; fi

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]