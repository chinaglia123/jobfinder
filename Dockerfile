# JobFinder — imagem para hospedar (Render, Railway, Fly.io, VPS...)
# Node 24: o banco usa o módulo nativo node:sqlite.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    JOBFINDER_MODE=hosted \
    JOBFINDER_DATA_DIR=/data
COPY --from=build /app/.output ./.output
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
