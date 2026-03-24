FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS build
WORKDIR /app
# Copy everything first to ensure pnpm workspace is fully intact
COPY . .
# Install all dependencies
RUN pnpm install --frozen-lockfile || pnpm install
# Generate Prisma Client
RUN cd apps/api && npx prisma generate

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/types ./packages/types
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
EXPOSE 4000
CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate && npx tsx src/seed.ts && npx tsx src/index.ts"]
