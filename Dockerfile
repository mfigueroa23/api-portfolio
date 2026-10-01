# Stage 1: compile TypeScript (output is platform-independent, so build natively).
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

# Stage 2: production dependencies for the target platform.
FROM node:26-alpine AS deps
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 3: unprivileged runtime.
FROM node:26-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --chown=root:root package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "dist/main.js"]
