import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { httpObservabilityMiddleware } from './observability/http-observability.middleware.js';
import { apiSecurityMiddleware } from './security/api-security.middleware.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(httpObservabilityMiddleware);
  app.use(apiSecurityMiddleware);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
