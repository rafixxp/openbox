import Fastify, {
    type FastifyInstance,
    type FastifyReply,
    type FastifyRequest,
    type FastifyServerOptions,
} from 'fastify';
import type { AppConfig } from './config';
import { failure, success } from './lib/envelope';
import { NonceStore, verifyInboundSignature } from './lib/hmac';
import { openApiDocument } from './openapi';
import {
    buildJobSchema,
    cancelParamsSchema,
} from './schemas/job';
import type { JobQueue } from './services/queue';
import { AGENT_SERVICE, AGENT_VERSION } from './version';

declare module 'fastify' {
    interface FastifyRequest {
        /** Exact request body bytes, used for HMAC verification. */
        rawBody?: string;
    }
}

export interface ServerDependencies {
    config: AppConfig;
    queue: JobQueue;
    logger?: FastifyServerOptions['logger'];
    now?: () => number;
}

/**
 * Build the HTTP surface without opening sockets. Tests inject this instance
 * directly; index.ts owns listen() and signal handling.
 *
 * There is deliberately no CORS configuration: this API is service-to-service.
 */
export async function buildServer(dependencies: ServerDependencies): Promise<FastifyInstance> {
    const { config, queue } = dependencies;
    const now = dependencies.now ?? Date.now;
    const startedAt = now();
    const nonceStore = new NonceStore(now);

    const app = Fastify({
        logger: dependencies.logger ?? false,
        bodyLimit: 2 * 1024 * 1024,
        trustProxy: true,
    });

    app.decorateRequest('rawBody', '');

    app.addContentTypeParser(
        'application/json',
        { parseAs: 'string' },
        (request, body, done) => {
            const raw = typeof body === 'string' ? body : body.toString('utf8');
            request.rawBody = raw;

            if (raw.trim() === '') {
                done(null, {});

                return;
            }

            try {
                done(null, JSON.parse(raw));
            } catch {
                const error = new Error('Request body must be valid JSON.') as Error & {
                    statusCode?: number;
                };
                error.statusCode = 400;
                done(error, undefined);
            }
        },
    );

    app.addHook('onSend', async (_request, reply, payload) => {
        reply.header('x-content-type-options', 'nosniff');
        reply.header('cache-control', 'no-store');

        return payload;
    });

    const requireAgentSignature = async (
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<FastifyReply | void> => {
        const path = (request.raw.url ?? request.url).split('?')[0] ?? '/';
        const result = verifyInboundSignature({
            secret: config.secret,
            method: request.method,
            path,
            body: request.rawBody ?? '',
            headers: request.headers,
            nonceStore,
            now: Math.floor(now() / 1000),
            clockSkewSeconds: config.clockSkewSeconds,
        });

        if (!result.ok) {
            return reply.code(result.status).send(failure(result.code, result.message, { path }));
        }
    };

    app.get('/health', async () =>
        success({
            status: 'ok' as const,
            service: AGENT_SERVICE,
            version: AGENT_VERSION,
            uptimeSeconds: Math.floor((now() - startedAt) / 1000),
        }),
    );

    app.get('/openapi.json', async (_request, reply) => {
        reply.header('cache-control', 'public, max-age=300');

        return openApiDocument(AGENT_VERSION);
    });

    app.post(
        '/v1/jobs',
        { preHandler: requireAgentSignature },
        async (request, reply) => {
            const parsed = buildJobSchema.safeParse(request.body);

            if (!parsed.success) {
                return reply.code(422).send(
                    failure('validation_error', 'The given data was invalid.', {}, parsed.error.flatten()),
                );
            }

            const job = parsed.data;

            if (job.manifest.channel !== job.channel) {
                return reply.code(422).send(
                    failure('validation_error', 'Manifest channel must match the job channel.', {}, {
                        field: 'manifest.channel',
                    }),
                );
            }

            if (job.includePanelInstaller && job.manifest.panelInstaller == null) {
                return reply.code(422).send(
                    failure(
                        'panel_installer_missing',
                        'includePanelInstaller was requested but the manifest has no installer checksum.',
                        {},
                    ),
                );
            }

            const result = await queue.enqueue(job);

            if (result.created) {
                request.log.info({ buildUuid: job.buildUuid }, 'Build job queued.');
            } else {
                request.log.info({ buildUuid: job.buildUuid }, 'Duplicate build job ignored.');
            }

            return reply.code(202).send(
                success(
                    {
                        buildUuid: job.buildUuid,
                        accepted: true as const,
                        duplicate: !result.created,
                    },
                    { queuedAt: new Date(now()).toISOString() },
                ),
            );
        },
    );

    app.post<{ Params: { uuid: string } }>(
        '/v1/jobs/:uuid/cancel',
        { preHandler: requireAgentSignature },
        async (request, reply) => {
            const parsed = cancelParamsSchema.safeParse(request.params);

            if (!parsed.success) {
                return reply.code(422).send(
                    failure('validation_error', 'The given data was invalid.', {}, parsed.error.flatten()),
                );
            }

            const result = await queue.requestCancel(parsed.data.uuid);

            if (result === 'not_found') {
                return reply.code(404).send(
                    failure('job_not_found', 'No queued or active job exists for this build.', {
                        buildUuid: parsed.data.uuid,
                    }),
                );
            }

            request.log.info({ buildUuid: parsed.data.uuid }, 'Build cancellation requested.');

            return reply.code(202).send(
                success({
                    buildUuid: parsed.data.uuid,
                    canceling: true as const,
                }),
            );
        },
    );

    app.setNotFoundHandler((request, reply) => {
        void reply
            .code(404)
            .send(failure('not_found', 'The requested agent route does not exist.', { path: request.url }));
    });

    app.setErrorHandler((error, request, reply) => {
        const failureInfo = error as { statusCode?: unknown; message?: unknown };
        const status =
            typeof failureInfo.statusCode === 'number' ? failureInfo.statusCode : 500;

        if (status >= 500) {
            request.log.error({ err: error }, 'Unhandled agent error.');
        }

        const code =
            status === 400
                ? 'invalid_json'
                : status === 413
                  ? 'payload_too_large'
                  : status === 415
                    ? 'unsupported_media_type'
                    : status === 429
                      ? 'too_many_requests'
                      : status >= 500
                        ? 'internal_error'
                        : 'http_error';

        const message =
            status >= 500
                ? 'The build agent encountered an internal error.'
                : typeof failureInfo.message === 'string' && failureInfo.message !== ''
                  ? failureInfo.message
                  : 'The request could not be completed.';

        void reply.code(status).send(failure(code, message));
    });

    return app;
}
