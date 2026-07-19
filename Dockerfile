FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM joseluisq/static-web-server:2-alpine
COPY --from=builder /app/dist /public
ENV SERVER_ROOT=/public
ENV SERVER_PAGE_FALLBACK=/public/index.html
ENV SERVER_FALLBACK_PAGE=/public/index.html
ENV SERVER_PORT=80
EXPOSE 80
