FROM node:24-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY apps/api apps/api
RUN npm run build -w @mockerrank/api

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --omit=dev -w @mockerrank/api
COPY --from=build /repo/apps/api/dist apps/api/dist
# A new named volume inherits this ownership, so the non-root user can write the database.
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
