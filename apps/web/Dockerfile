FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS build
WORKDIR /app
# Copy everything first to ensure pnpm workspace is fully intact
COPY . .
# Install all dependencies
RUN pnpm install --frozen-lockfile || pnpm install
# Build the web app
ARG NEXT_PUBLIC_API_URL=http://localhost
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_STANDALONE=1
RUN pnpm --filter @forge-erp/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone build needs the .next/standalone folder
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
