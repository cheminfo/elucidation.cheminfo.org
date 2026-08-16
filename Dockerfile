FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM joseluisq/static-web-server:2-alpine
# The build stays here, read-only. The entrypoint copies it to SERVER_ROOT,
# which is a tmpfs, so the analytics snippet can be put in the pages at startup
# without the image filesystem ever being writable.
COPY --from=builder /app/dist /app/dist
COPY --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENV SERVER_ROOT=/public
ENV SERVER_PAGE_FALLBACK=/public/index.html
ENV SERVER_FALLBACK_PAGE=/public/index.html
# The build writes one file per address, so `/tutorial` is a directory here.
# Without this, static-web-server 308s it to `/tutorial/` — an address the
# sitemap, the internal links and the page's own canonical never use.
ENV SERVER_REDIRECT_TRAILING_SLASH=false
ENV SERVER_PORT=80
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/local/bin/static-web-server"]
