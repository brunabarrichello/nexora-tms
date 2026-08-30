FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build:worker

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@nexora/worker", "start"]
