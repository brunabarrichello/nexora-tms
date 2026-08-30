FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build:web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@nexora/web", "start"]
