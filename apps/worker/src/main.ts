import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  CommunicationProviderRegistry,
  DeterministicCommunicationProvider,
} from './communication-delivery.js';
import { loadWorkerConfig } from './config.js';
import { createDefaultHandlerRegistry } from './handlers.js';
import { WorkerHealthServer } from './health.js';
import { errorFields, StructuredLogger } from './logger.js';
import { WorkerRuntime } from './runtime.js';
import { PgAsyncStore } from './store.js';

@Module({})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = new StructuredLogger(config.workerId, config.environment);
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  const store = new PgAsyncStore(config.database, config.maxConcurrency);
  const communicationProviders = new CommunicationProviderRegistry();
  if (
    config.environment !== 'production' &&
    process.env.NEXORA_ENABLE_DETERMINISTIC_COMMUNICATION_PROVIDER === 'true'
  ) {
    communicationProviders.register(new DeterministicCommunicationProvider());
  }
  const handlers = createDefaultHandlerRegistry(
    logger,
    {
      port: store,
      integrationSecretKey: process.env.NEXORA_INTEGRATION_SECRET_KEY,
    },
    { port: store, providers: communicationProviders },
  );
  const runtime = new WorkerRuntime(config, store, handlers, logger);
  const health = new WorkerHealthServer(config, runtime, logger);
  let shuttingDown = false;

  const shutdown = async (signal: string, exitCode = 0, cause?: unknown): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('worker.shutdown.requested', {
      signal,
      exitCode,
      ...(cause === undefined ? {} : errorFields(cause)),
    });

    try {
      await health.stop();
      await runtime.stop();
      await app.close();
      logger.info('worker.shutdown.completed', { signal, exitCode });
    } catch (error) {
      logger.error('worker.shutdown.failed', { signal, exitCode, ...errorFields(error) });
      exitCode = 1;
    }

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('uncaughtException', (error) => void shutdown('uncaughtException', 1, error));
  process.once('unhandledRejection', (reason) => void shutdown('unhandledRejection', 1, reason));

  try {
    await runtime.start();
    await health.start();
    logger.info('worker.bootstrap.completed');
  } catch (error) {
    logger.error('worker.bootstrap.failed', errorFields(error));
    await health.stop().catch(() => undefined);
    await runtime.stop().catch(() => undefined);
    await app.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

void bootstrap();
