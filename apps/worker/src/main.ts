import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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
  const store = new PgAsyncStore(config.databaseUrl, config.maxConcurrency);
  const handlers = createDefaultHandlerRegistry(logger);
  const runtime = new WorkerRuntime(config, store, handlers, logger);
  const health = new WorkerHealthServer(config, runtime, logger);
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('worker.shutdown.requested', { signal });

    try {
      await health.stop();
      await runtime.stop();
      await app.close();
      logger.info('worker.shutdown.completed', { signal });
    } catch (error) {
      logger.error('worker.shutdown.failed', { signal, ...errorFields(error) });
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await runtime.start();
    await health.start();
    logger.info('worker.bootstrap.completed');
  } catch (error) {
    logger.error('worker.bootstrap.failed', errorFields(error));
    process.exitCode = 1;
    await health.stop().catch(() => undefined);
    await runtime.stop().catch(() => undefined);
    await app.close().catch(() => undefined);
  }
}

void bootstrap();
