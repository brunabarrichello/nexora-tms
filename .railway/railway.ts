import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const source = github("brunabarrichello/nexora-tms");

  const api = service("api", {
    source,
    build: "pnpm --filter @nexora/api build",
    start: "pnpm --filter @nexora/api start",
    healthcheck: "/api/v1/health",
    env: {
      NODE_ENV: "production",
      NEXORA_ENV: ctx.environment,
      API_HOST: "0.0.0.0",
      DATABASE_URL: preserve(),
    },
  });

  const worker = service("worker", {
    source,
    build: "pnpm --filter @nexora/worker build",
    start: "pnpm --filter @nexora/worker start",
    env: {
      NODE_ENV: "production",
      NEXORA_ENV: ctx.environment,
      WORKER_DATABASE_URL: preserve(),
    },
  });

  return project("nexora-tms", {
    resources: [api, worker],
  });
});
