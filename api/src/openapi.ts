/**
 * Hand-maintained OpenAPI 3.1 document for the agent. Keeping it in source
 * means the contract ships with the service and is served at /openapi.json.
 */
export function openApiDocument(version: string): Record<string, unknown> {
    return {
        openapi: '3.1.0',
        info: {
            title: 'Openbox Build Agent',
            version,
            description:
                'Service-to-service API used by the Openbox Laravel panel to dispatch ISO builds. ' +
                'Requests are authenticated with HMAC-SHA256 over (timestamp, nonce, method, path, sha256(body)).',
            license: { name: 'MIT' },
        },
        servers: [{ url: '/', description: 'Current agent' }],
        tags: [
            { name: 'Health' },
            { name: 'Jobs' },
            { name: 'Docs' },
        ],
        paths: {
            '/health': {
                get: {
                    tags: ['Health'],
                    summary: 'Liveness probe',
                    operationId: 'getHealth',
                    security: [],
                    responses: {
                        '200': {
                            description: 'Agent is accepting connections.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthEnvelope' },
                                },
                            },
                        },
                    },
                },
            },
            '/openapi.json': {
                get: {
                    tags: ['Docs'],
                    summary: 'This document',
                    operationId: 'getOpenApi',
                    security: [],
                    responses: { '200': { description: 'OpenAPI document.' } },
                },
            },
            '/v1/jobs': {
                post: {
                    tags: ['Jobs'],
                    summary: 'Queue an ISO build',
                    operationId: 'createBuildJob',
                    security: [{ AgentHmac: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/BuildJob' } },
                        },
                    },
                    responses: {
                        '202': {
                            description: 'Job accepted (or already present).',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/JobAcceptedEnvelope' },
                                },
                            },
                        },
                        '401': { $ref: '#/components/responses/Unauthorized' },
                        '409': { $ref: '#/components/responses/Conflict' },
                        '422': { $ref: '#/components/responses/ValidationError' },
                    },
                },
            },
            '/v1/jobs/{uuid}/cancel': {
                post: {
                    tags: ['Jobs'],
                    summary: 'Request cancellation of a queued or running build',
                    operationId: 'cancelBuildJob',
                    security: [{ AgentHmac: [] }],
                    parameters: [
                        {
                            name: 'uuid',
                            in: 'path',
                            required: true,
                            schema: { type: 'string', format: 'uuid' },
                        },
                    ],
                    responses: {
                        '202': {
                            description: 'Cancellation signalled.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/CancelAcceptedEnvelope' },
                                },
                            },
                        },
                        '401': { $ref: '#/components/responses/Unauthorized' },
                        '404': { $ref: '#/components/responses/NotFound' },
                        '409': { $ref: '#/components/responses/Conflict' },
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                AgentHmac: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-Agent-Signature',
                    description:
                        'Hex HMAC-SHA256 of `timestamp\\nnonce\\nMETHOD\\n/path\\nsha256(rawBody)`. ' +
                        'Send X-Agent-Timestamp (unix seconds, ±300s), X-Agent-Nonce (unique, ≤128 chars), ' +
                        'X-Agent-Signature and X-Agent-Id. Nonces are single-use.',
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Missing, stale, replayed or invalid signature.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                        },
                    },
                },
                Conflict: {
                    description: 'Replayed nonce.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                        },
                    },
                },
                NotFound: {
                    description: 'No queued or active job exists for this UUID.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                        },
                    },
                },
                ValidationError: {
                    description: 'Payload failed schema validation.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                        },
                    },
                },
            },
            schemas: {
                Meta: {
                    type: 'object',
                    additionalProperties: true,
                },
                ApiError: {
                    type: 'object',
                    required: ['code', 'message'],
                    properties: {
                        code: { type: 'string', examples: ['validation_error'] },
                        message: { type: 'string' },
                        details: {},
                    },
                },
                ErrorEnvelope: {
                    type: 'object',
                    required: ['success', 'data', 'error', 'meta'],
                    properties: {
                        success: { type: 'boolean', const: false },
                        data: { type: 'null' },
                        error: { $ref: '#/components/schemas/ApiError' },
                        meta: { $ref: '#/components/schemas/Meta' },
                    },
                },
                JobAcceptedEnvelope: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', const: true },
                        data: {
                            type: 'object',
                            required: ['buildUuid', 'accepted', 'duplicate'],
                            properties: {
                                buildUuid: { type: 'string', format: 'uuid' },
                                accepted: { type: 'boolean', const: true },
                                duplicate: {
                                    type: 'boolean',
                                    description: 'True when a job with this UUID was already queued.',
                                },
                            },
                        },
                        error: { type: 'null' },
                        meta: { $ref: '#/components/schemas/Meta' },
                    },
                },
                CancelAcceptedEnvelope: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', const: true },
                        data: {
                            type: 'object',
                            properties: {
                                buildUuid: { type: 'string', format: 'uuid' },
                                canceling: { type: 'boolean', const: true },
                            },
                        },
                        error: { type: 'null' },
                        meta: { $ref: '#/components/schemas/Meta' },
                    },
                },
                HealthEnvelope: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', const: true },
                        data: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', const: 'ok' },
                                service: { type: 'string', const: 'openbox-build-agent' },
                                version: { type: 'string' },
                                uptimeSeconds: { type: 'number' },
                            },
                        },
                        error: { type: 'null' },
                        meta: { $ref: '#/components/schemas/Meta' },
                    },
                },
                PackageEntry: {
                    type: 'object',
                    required: ['name', 'version', 'architecture'],
                    properties: {
                        name: { type: 'string', pattern: '^[a-z0-9][a-z0-9+.-]*$' },
                        version: { type: 'string' },
                        architecture: { type: 'string' },
                    },
                },
                BuildManifest: {
                    type: 'object',
                    required: [
                        'schemaVersion',
                        'channel',
                        'debian',
                        'packages',
                        'includePanelInstaller',
                        'liveBuild',
                        'createdAt',
                    ],
                    properties: {
                        schemaVersion: { type: 'integer', minimum: 1, maximum: 99 },
                        channel: { type: 'string', enum: ['stable', 'testing'] },
                        debian: {
                            type: 'object',
                            required: ['suite', 'architecture', 'mirror'],
                            properties: {
                                suite: { type: 'string', examples: ['bookworm'] },
                                architecture: { type: 'string', enum: ['amd64', 'arm64', 'i386'] },
                                mirror: { type: 'string', format: 'uri' },
                            },
                        },
                        packages: {
                            type: 'array',
                            maxItems: 500,
                            items: { $ref: '#/components/schemas/PackageEntry' },
                        },
                        includePanelInstaller: { type: 'boolean' },
                        panelInstaller: {
                            type: ['object', 'null'],
                            properties: {
                                filename: { type: 'string' },
                                sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
                            },
                        },
                        liveBuild: {
                            type: 'object',
                            required: ['isolatedWorkspace', 'clean', 'isoName'],
                            properties: {
                                isolatedWorkspace: { type: 'boolean' },
                                clean: { type: 'boolean' },
                                isoName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*\\.iso$' },
                            },
                        },
                        requestedBy: { type: ['string', 'null'], format: 'email' },
                        createdAt: { type: 'string' },
                        notes: { type: 'string', maxLength: 2000 },
                    },
                },
                BuildJob: {
                    type: 'object',
                    required: ['buildUuid', 'channel', 'manifest', 'callbackBaseUrl', 'includePanelInstaller'],
                    properties: {
                        buildUuid: { type: 'string', format: 'uuid' },
                        channel: { type: 'string', enum: ['stable', 'testing'] },
                        manifest: { $ref: '#/components/schemas/BuildManifest' },
                        callbackBaseUrl: {
                            type: 'string',
                            format: 'uri',
                            description:
                                'Panel origin, without /api. The agent appends /api/v1/internal/builds/{uuid}/...',
                        },
                        includePanelInstaller: { type: 'boolean' },
                    },
                },
            },
        },
    };
}
