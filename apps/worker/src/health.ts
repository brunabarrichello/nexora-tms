import { createServer, type Server } from 'node:http';
import type { WorkerConfig } from './config.js';
import type { StructuredLogger } from './logger.js';
import type { WorkerRuntime } from './runtime.js';

export class WorkerHealthServer {
  private server: Server | null = null;

  constructor(
    private readonly config: WorkerConfig,
    private readonly runtime: WorkerRuntime,
    private readonly logger: StructuredLogger,
  ) {}

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((request, response) => {
      const snapshot = this.runtime.snapshot();
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');

      if (request.url === '/health') {
        response.statusCode = 200;
        response.end(JSON.stringify({ status: 'ok', service: 'nexora-tms-worker' }));
        return;
      }

      if (request.url === '/ready') {
        response.statusCode = snapshot.ready ? 200 : 503;
        response.end(
          JSON.stringify({ status: snapshot.ready ? 'ready' : 'not_ready', ...snapshot }),
        );
        return;
      }

      if (request.url === '/metrics') {
        response.statusCode = 200;
        response.end(JSON.stringify(snapshot));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ status: 'not_found' }));
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.config.port, this.config.host, () => resolve());
    });

    this.logger.info('worker.health.started', {
      host: this.config.host,
      port: this.config.port,
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
