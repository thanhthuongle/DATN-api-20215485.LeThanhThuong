FROM node:22.19.0-alpine AS dependencies

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile


FROM dependencies AS builder

COPY .babelrc ./
COPY src ./src

RUN yarn build


FROM node:22.19.0-alpine AS runner

ARG SOURCE_REPOSITORY="unknown"
ARG SOURCE_REVISION="unknown"

LABEL org.opencontainers.image.source=$SOURCE_REPOSITORY \
  org.opencontainers.image.revision=$SOURCE_REVISION

ENV NODE_ENV=production
ENV BUILD_MODE=production
ENV PORT=8017

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

COPY --from=builder /app/build ./build

USER node

EXPOSE 8017

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8017) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "build/src/server.js"]
