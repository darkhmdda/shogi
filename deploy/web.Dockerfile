# Web estática servida con nginx. Se construye desde la raíz del repositorio:
#   docker build -f deploy/web.Dockerfile --build-arg VITE_API_URL=https://api.ejemplo.com .
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci --workspace web --include-workspace-root
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace web

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
