# Base images are pinned by digest, so Dependabot proposes each update as a PR (Spec 006, RF-11).

# Stage 1: compile TypeScript (output is platform-independent, so build natively).
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# `pnpm build` runs `prisma generate`, which needs the schema but no database.
RUN pnpm build

# Stage 2: production dependencies for the target platform.
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS deps
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 3: unprivileged runtime.
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797
ENV NODE_ENV=production PORT=3000
# Alpine fixes published after the base image, and no npm/npx: the API only runs `node`, and the
# bundled npm only adds packages to scan and patch (Spec 006, plan D13).
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --chown=root:root package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "dist/main.js"]
