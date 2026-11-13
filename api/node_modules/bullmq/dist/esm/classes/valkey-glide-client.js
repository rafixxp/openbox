import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { ConnectionClosedError } from './errors/connection-closed-error';
const GLIDE_STRING_DECODER = 1;
function createCompatibilityBatch() {
    return {
        commands: [],
        customCommand(args) {
            this.commands.push(args);
        },
    };
}
function createGlideBatch(isAtomic) {
    try {
        const { Batch } = require('@valkey/valkey-glide');
        return typeof Batch === 'function' ? new Batch(isAtomic) : null;
    }
    catch (_a) {
        return null;
    }
}
function isBuffer(value) {
    return Buffer.isBuffer(value);
}
function toGlideArg(value) {
    if (isBuffer(value)) {
        return value;
    }
    if (value === undefined || value === null) {
        return '';
    }
    return String(value);
}
function toStringValue(value) {
    if (isBuffer(value)) {
        return value.toString();
    }
    return String(value);
}
function isKeyValueArray(value) {
    return (Array.isArray(value) &&
        value.every(item => item && typeof item === 'object' && 'key' in item && 'value' in item));
}
function normalizeScriptArgs(args) {
    return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
}
function normalizeHashReply(reply) {
    if (!reply) {
        return {};
    }
    if (isKeyValueArray(reply)) {
        return reply.reduce((acc, item) => {
            acc[toStringValue(item.key)] = toStringValue(item.value);
            return acc;
        }, {});
    }
    if (reply instanceof Map) {
        const out = {};
        for (const [key, value] of reply.entries()) {
            out[toStringValue(key)] = toStringValue(value);
        }
        return out;
    }
    if (Array.isArray(reply)) {
        const out = {};
        for (let i = 0; i < reply.length; i += 2) {
            out[toStringValue(reply[i])] = toStringValue(reply[i + 1]);
        }
        return out;
    }
    if (typeof reply === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(reply)) {
            out[key] = toStringValue(value);
        }
        return out;
    }
    return {};
}
function flattenFieldPairs(fields) {
    if (!fields) {
        return [];
    }
    if (Array.isArray(fields)) {
        if (isKeyValueArray(fields)) {
            return fields.flatMap(pair => [
                toStringValue(pair.key),
                toStringValue(pair.value),
            ]);
        }
        if (fields.every(item => Array.isArray(item) && item.length === 2)) {
            return fields.flatMap(pair => {
                const [field, value] = pair;
                return [toStringValue(field), toStringValue(value)];
            });
        }
        return fields.map(item => toStringValue(item));
    }
    if (typeof fields === 'object') {
        return Object.entries(fields).flatMap(([field, value]) => [field, toStringValue(value)]);
    }
    return [];
}
function normalizeXReadReply(reply) {
    if (!reply) {
        return null;
    }
    if (Array.isArray(reply) &&
        reply.every(stream => Array.isArray(stream) &&
            stream.length === 2 &&
            typeof stream[0] !== 'undefined' &&
            Array.isArray(stream[1]))) {
        return reply;
    }
    if (!isKeyValueArray(reply)) {
        return reply;
    }
    return reply.map(streamEntry => {
        const streamName = toStringValue(streamEntry.key);
        const messages = isKeyValueArray(streamEntry.value)
            ? streamEntry.value.map(message => [
                toStringValue(message.key),
                flattenFieldPairs(message.value),
            ])
            : [];
        return [streamName, messages];
    });
}
function normalizeScanReply(reply) {
    if (Array.isArray(reply) && reply.length >= 2) {
        const [cursor, keys] = reply;
        const normalizedKeys = Array.isArray(keys)
            ? keys.map(key => toStringValue(key))
            : [];
        return [toStringValue(cursor), normalizedKeys];
    }
    if (reply && typeof reply === 'object') {
        const result = reply;
        if (result.cursor !== undefined && Array.isArray(result.keys)) {
            return [
                toStringValue(result.cursor),
                result.keys.map(key => toStringValue(key)),
            ];
        }
    }
    return ['0', []];
}
function normalizeXRangeReply(reply) {
    if (!reply) {
        return [];
    }
    if (Array.isArray(reply) &&
        reply.every(entry => Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] !== 'undefined' &&
            Array.isArray(entry[1]))) {
        return reply.map(([id, fields]) => [
            toStringValue(id),
            fields.map((field) => toStringValue(field)),
        ]);
    }
    if (!isKeyValueArray(reply)) {
        return [];
    }
    return reply.map(entry => [
        toStringValue(entry.key),
        flattenFieldPairs(entry.value),
    ]);
}
function normalizeSortedSetReply(reply, withScores = false) {
    if (!Array.isArray(reply)) {
        return [];
    }
    if (!withScores) {
        return reply.map(item => toStringValue(item));
    }
    if (isKeyValueArray(reply)) {
        return reply.flatMap(entry => [
            toStringValue(entry.key),
            toStringValue(entry.value),
        ]);
    }
    if (reply.every(item => Array.isArray(item) && item.length >= 2 && item[0] !== undefined)) {
        return reply.flatMap(item => [
            toStringValue(item[0]),
            toStringValue(item[1]),
        ]);
    }
    return reply.map(item => toStringValue(item));
}
function isBlockingCommand(args) {
    const [command, ...rest] = args;
    const name = toStringValue(command).toUpperCase();
    if (name === 'BZPOPMIN') {
        return true;
    }
    if (name !== 'XREAD') {
        return false;
    }
    for (let i = 0; i < rest.length; i += 2) {
        if (toStringValue(rest[i]).toUpperCase() === 'BLOCK') {
            return true;
        }
    }
    return false;
}
export function createValkeyGlideClient(client) {
    return new ValkeyGlideAdapter(client);
}
class ValkeyGlideAdapter extends EventEmitter {
    constructor(rawOrPromise, connectionName) {
        super();
        this.connectionName = connectionName;
        this.scripts = new Map();
        this.scriptsBySha = new Map();
        this.scriptLoadPromises = new Map();
        this.readyEmitted = false;
        this.closed = false;
        this.operationChain = Promise.resolve();
        this.activeBlockingCommands = 0;
        if (rawOrPromise instanceof Promise) {
            this.rawPromise = rawOrPromise;
            void this.connect().catch(error => this.emit('error', error));
        }
        else {
            this.raw = rawOrPromise;
        }
    }
    get status() {
        if (this.statusOverride) {
            return this.statusOverride;
        }
        if (this.closed) {
            return 'end';
        }
        if (this.readyEmitted) {
            return 'ready';
        }
        return 'wait';
    }
    set status(value) {
        if (value === 'end') {
            this.disconnect();
        }
        this.statusOverride = value;
    }
    get isCluster() {
        var _a, _b, _c;
        const name = (_c = (_b = (_a = this.raw) === null || _a === void 0 ? void 0 : _a.constructor) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : '';
        return name.includes('Cluster');
    }
    get options() {
        var _a, _b, _c, _d;
        return (_d = (_b = (_a = this.raw) === null || _a === void 0 ? void 0 : _a.config) !== null && _b !== void 0 ? _b : (_c = this.raw) === null || _c === void 0 ? void 0 : _c.options) !== null && _d !== void 0 ? _d : {};
    }
    set options(_value) {
        // no-op
    }
    ensureOpen() {
        if (this.closed) {
            throw new ConnectionClosedError();
        }
    }
    normalizeError(error) {
        if (error instanceof ConnectionClosedError ||
            (error instanceof Error && error.name === 'ClosingError')) {
            throw new ConnectionClosedError(error.message, error);
        }
        throw error;
    }
    async ensureRaw() {
        if (this.raw) {
            return this.raw;
        }
        if (!this.rawPromise) {
            throw new Error('BullMQ: Valkey Glide client not initialized - missing raw client ' +
                'and client promise. Please report this as a bug.');
        }
        this.raw = await this.rawPromise;
        return this.raw;
    }
    async runSerialized(fn) {
        this.ensureOpen();
        const previous = this.operationChain;
        let release;
        this.operationChain = new Promise(resolve => {
            release = resolve;
        });
        await previous;
        this.ensureOpen();
        try {
            const raw = await this.ensureRaw();
            this.ensureOpen();
            return await fn(raw);
        }
        catch (error) {
            this.normalizeError(error);
        }
        finally {
            release();
        }
    }
    async runRawCommand(args, options) {
        const blockingCommand = isBlockingCommand(args);
        return this.runSerialized(async (raw) => {
            if (blockingCommand) {
                this.activeBlockingCommands++;
            }
            try {
                return await raw.customCommand(args, options);
            }
            finally {
                if (blockingCommand) {
                    this.activeBlockingCommands--;
                }
            }
        });
    }
    ensureScriptLoaded(script) {
        let pendingLoad = this.scriptLoadPromises.get(script.sha);
        if (!pendingLoad) {
            pendingLoad = this.runRawCommand(['SCRIPT', 'LOAD', script.lua])
                .then(() => { })
                .catch(() => {
                // Ignore script preload errors here – runCommand has NOSCRIPT fallback
                // for non-transactional usage, and transactional callers will surface
                // the underlying Redis error if the script still is not available.
            });
            this.scriptLoadPromises.set(script.sha, pendingLoad);
        }
        return pendingLoad;
    }
    async applyConnectionNameIfNeeded() {
        if (!this.connectionName) {
            return;
        }
        await this.runRawCommand(['CLIENT', 'SETNAME', this.connectionName], {
            decoder: GLIDE_STRING_DECODER,
        });
    }
    async clearConnectionNameIfNeeded(raw) {
        if (!this.connectionName) {
            return;
        }
        try {
            await raw.customCommand(['CLIENT', 'SETNAME', ''], {
                decoder: GLIDE_STRING_DECODER,
            });
        }
        catch (_a) {
            // ignore
        }
    }
    async recreateRaw() {
        var _a, _b;
        const raw = await this.ensureRaw();
        const clientConstructor = raw.constructor;
        const createClient = (_a = clientConstructor === null || clientConstructor === void 0 ? void 0 : clientConstructor.createClient) === null || _a === void 0 ? void 0 : _a.bind(clientConstructor);
        const config = (_b = raw.config) !== null && _b !== void 0 ? _b : raw.options;
        if (!createClient || !config) {
            throw new Error('BullMQ: Cannot recreate Valkey Glide client: missing createClient() method or ' +
                'config object. Ensure the client was created via GlideClient.createClient() ' +
                'or GlideClusterClient.createClient().');
        }
        this.raw = await createClient(config);
        // Glide closes clients permanently, so a recreated raw connection starts
        // with an empty server-side script cache.
        this.scriptLoadPromises.clear();
    }
    async connect() {
        if (this.connecting) {
            return this.connecting;
        }
        this.connecting = (async () => {
            if (this.closed && this.raw) {
                await this.recreateRaw();
            }
            this.closed = false;
            this.statusOverride = undefined;
            await this.ensureRaw();
            try {
                await this.applyConnectionNameIfNeeded();
            }
            catch (error) {
                if (this.closed && error instanceof ConnectionClosedError) {
                    return;
                }
                throw error;
            }
            if (this.closed) {
                return;
            }
            this.readyEmitted = true;
            this.emit('ready');
        })().finally(() => {
            this.connecting = undefined;
        });
        return this.connecting;
    }
    closeRaw() {
        if (!this.closingPromise) {
            const closeRaw = () => {
                if (!this.raw) {
                    return;
                }
                try {
                    this.raw.close();
                }
                catch (_a) {
                    // ignore
                }
            };
            this.closingPromise = (this.activeBlockingCommands > 0
                ? Promise.resolve().then(closeRaw)
                : this.operationChain
                    .catch(() => {
                    // ignore
                })
                    .then(async () => {
                    if (!this.closed) {
                        return;
                    }
                    if (this.raw) {
                        await this.clearConnectionNameIfNeeded(this.raw);
                    }
                    closeRaw();
                })).finally(() => {
                this.closingPromise = undefined;
            });
        }
        return this.closingPromise;
    }
    disconnect(reconnect = false) {
        if (this.closed && !reconnect) {
            return;
        }
        this.closed = true;
        this.readyEmitted = false;
        this.statusOverride = reconnect ? undefined : 'end';
        this.emit('close');
        if (reconnect) {
            void this.closeRaw()
                .then(() => {
                this.emit('reconnecting');
                return this.connect();
            })
                .catch(error => this.emit('error', error));
            return;
        }
        void this.closeRaw();
        this.emit('end');
    }
    async quit() {
        if (this.closed) {
            setImmediate(() => {
                this.emit('end');
                this.emit('close');
            });
            return 'OK';
        }
        this.closed = true;
        this.readyEmitted = false;
        this.statusOverride = 'end';
        void this.closeRaw();
        setImmediate(() => {
            this.emit('end');
            this.emit('close');
        });
        return 'OK';
    }
    duplicate(...args) {
        var _a;
        const options = ((_a = args[0]) !== null && _a !== void 0 ? _a : {});
        const duplicated = (async () => {
            var _a, _b;
            const raw = await this.ensureRaw();
            const clientConstructor = raw.constructor;
            const createClient = (_a = clientConstructor === null || clientConstructor === void 0 ? void 0 : clientConstructor.createClient) === null || _a === void 0 ? void 0 : _a.bind(clientConstructor);
            const config = (_b = raw.config) !== null && _b !== void 0 ? _b : raw.options;
            if (!createClient || !config) {
                throw new Error('BullMQ: Cannot duplicate Valkey Glide client: missing createClient() or ' +
                    'config. Ensure the client was created via GlideClient.createClient()/' +
                    'GlideClusterClient.createClient().');
            }
            return createClient(config);
        })();
        return new ValkeyGlideAdapter(duplicated, options.connectionName);
    }
    defineCommand(name, definition) {
        const sha = createHash('sha1').update(definition.lua).digest('hex');
        const script = {
            sha,
            lua: definition.lua,
            numberOfKeys: definition.numberOfKeys,
        };
        this.scripts.set(name, script);
        this.scriptsBySha.set(sha, script);
        this[name] = (...args) => this.runCommand(name, args);
        void this.ensureScriptLoaded(script);
    }
    async runCommand(name, args) {
        const script = this.scripts.get(name);
        if (!script) {
            throw new Error(`BullMQ: command "${name}" is not defined. Use defineCommand() before runCommand().`);
        }
        const normalizedArgs = normalizeScriptArgs(args);
        const keys = normalizedArgs.slice(0, script.numberOfKeys).map(toGlideArg);
        const argv = normalizedArgs.slice(script.numberOfKeys).map(toGlideArg);
        const evalShaArgs = [
            'EVALSHA',
            script.sha,
            String(script.numberOfKeys),
            ...keys,
            ...argv,
        ];
        try {
            return await this.runRawCommand(evalShaArgs);
        }
        catch (err) {
            if (typeof (err === null || err === void 0 ? void 0 : err.message) === 'string' &&
                err.message.toLowerCase().includes('noscript')) {
                return this.runRawCommand([
                    'EVAL',
                    script.lua,
                    String(script.numberOfKeys),
                    ...keys,
                    ...argv,
                ]);
            }
            throw err;
        }
    }
    multi() {
        return new ValkeyGlideTransaction(this, this.scripts);
    }
    pipeline() {
        return this.multi();
    }
    async hgetall(key) {
        return normalizeHashReply(await this.runRawCommand(['HGETALL', key]));
    }
    async hget(key, field) {
        const value = await this.runRawCommand(['HGET', key, field]);
        return value == null ? null : toStringValue(value);
    }
    async hmget(key, ...fields) {
        const value = await this.runRawCommand(['HMGET', key, ...fields]);
        return Array.isArray(value)
            ? value.map(item => (item == null ? null : toStringValue(item)))
            : [];
    }
    async hset(key, data) {
        const args = ['HSET', key];
        for (const [field, value] of Object.entries(data)) {
            args.push(field, toGlideArg(value));
        }
        return Number(await this.runRawCommand(args));
    }
    async hdel(key, ...fields) {
        return Number(await this.runRawCommand(['HDEL', key, ...fields]));
    }
    async hexists(key, field) {
        const result = await this.runRawCommand(['HEXISTS', key, field]);
        if (typeof result === 'boolean') {
            return result ? 1 : 0;
        }
        return Number(result);
    }
    async get(key) {
        const value = await this.runRawCommand(['GET', key]);
        return value == null ? null : toStringValue(value);
    }
    async set(key, value, options) {
        const args = ['SET', key, toGlideArg(value)];
        if ((options === null || options === void 0 ? void 0 : options.PX) != null) {
            args.push('PX', String(options.PX));
        }
        else if ((options === null || options === void 0 ? void 0 : options.EX) != null) {
            args.push('EX', String(options.EX));
        }
        const result = await this.runRawCommand(args);
        return result == null ? null : toStringValue(result);
    }
    async del(...keys) {
        if (keys.length === 0) {
            return 0;
        }
        return Number(await this.runRawCommand(['DEL', ...keys]));
    }
    async zrange(key, start, end, options) {
        const args = ['ZRANGE', key, String(start), String(end)];
        if (options === null || options === void 0 ? void 0 : options.WITHSCORES) {
            args.push('WITHSCORES');
        }
        const result = await this.runRawCommand(args);
        return normalizeSortedSetReply(result, options === null || options === void 0 ? void 0 : options.WITHSCORES);
    }
    async zrevrange(key, start, end, options) {
        const args = ['ZREVRANGE', key, String(start), String(end)];
        if (options === null || options === void 0 ? void 0 : options.WITHSCORES) {
            args.push('WITHSCORES');
        }
        const result = await this.runRawCommand(args);
        return normalizeSortedSetReply(result, options === null || options === void 0 ? void 0 : options.WITHSCORES);
    }
    async zcard(key) {
        return Number(await this.runRawCommand(['ZCARD', key]));
    }
    async zscore(key, member) {
        const result = await this.runRawCommand(['ZSCORE', key, member]);
        return result == null ? null : toStringValue(result);
    }
    async lrange(key, start, end) {
        const result = await this.runRawCommand([
            'LRANGE',
            key,
            String(start),
            String(end),
        ]);
        return Array.isArray(result) ? result.map(toStringValue) : [];
    }
    async llen(key) {
        return Number(await this.runRawCommand(['LLEN', key]));
    }
    async ltrim(key, start, end) {
        const result = await this.runRawCommand([
            'LTRIM',
            key,
            String(start),
            String(end),
        ]);
        return result == null ? 'OK' : toStringValue(result);
    }
    async lpos(key, value) {
        const result = await this.runRawCommand(['LPOS', key, value]);
        return result == null ? null : Number(result);
    }
    async smembers(key) {
        const result = await this.runRawCommand(['SMEMBERS', key]);
        return Array.isArray(result) ? result.map(toStringValue) : [];
    }
    async xadd(key, id, fields, options) {
        const args = ['XADD', key];
        if ((options === null || options === void 0 ? void 0 : options.MAXLEN) != null) {
            args.push('MAXLEN');
            if (options.approximate !== false) {
                args.push('~');
            }
            args.push(String(options.MAXLEN));
        }
        args.push(id);
        for (const [field, value] of Object.entries(fields)) {
            args.push(field, toGlideArg(value));
        }
        return toStringValue(await this.runRawCommand(args));
    }
    async xread(streams, options) {
        const args = ['XREAD'];
        if ((options === null || options === void 0 ? void 0 : options.BLOCK) != null) {
            args.push('BLOCK', String(options.BLOCK));
        }
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', String(options.COUNT));
        }
        args.push('STREAMS');
        for (const stream of streams) {
            args.push(stream.key);
        }
        for (const stream of streams) {
            args.push(stream.id);
        }
        return normalizeXReadReply(await this.runRawCommand(args));
    }
    async xtrim(key, strategy, threshold, options) {
        const args = ['XTRIM', key, strategy];
        if ((options === null || options === void 0 ? void 0 : options.approximate) !== false) {
            args.push('~');
        }
        args.push(String(threshold));
        return Number(await this.runRawCommand(args));
    }
    async bzpopmin(key, timeout) {
        const result = await this.runRawCommand(['BZPOPMIN', key, String(timeout)]);
        if (!result) {
            return null;
        }
        if (Array.isArray(result) && result.length >= 3) {
            return [
                toStringValue(result[0]),
                toStringValue(result[1]),
                toStringValue(result[2]),
            ];
        }
        return null;
    }
    async info() {
        return toStringValue(await this.runRawCommand(['INFO']));
    }
    async clientSetName(name) {
        return this.runRawCommand(['CLIENT', 'SETNAME', name], {
            decoder: GLIDE_STRING_DECODER,
        });
    }
    async clientList() {
        return toStringValue(await this.runRawCommand(['CLIENT', 'LIST'], {
            decoder: GLIDE_STRING_DECODER,
        }));
    }
    async scan(cursor, options) {
        const args = ['SCAN', String(cursor)];
        if (options === null || options === void 0 ? void 0 : options.MATCH) {
            args.push('MATCH', options.MATCH);
        }
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', String(options.COUNT));
        }
        return normalizeScanReply(await this.runRawCommand(args));
    }
    scanStream(options) {
        let cursor = '0';
        let running = false;
        const stream = new Readable({
            objectMode: true,
            read: () => {
                if (running) {
                    return;
                }
                running = true;
                (async () => {
                    do {
                        const [nextCursor, keys] = await this.scan(cursor, {
                            MATCH: options.match,
                            COUNT: options.count,
                        });
                        cursor = nextCursor;
                        if (keys.length > 0 && !stream.push(keys)) {
                            return;
                        }
                    } while (cursor !== '0');
                    stream.push(null);
                })()
                    .catch(err => stream.destroy(err))
                    .finally(() => {
                    running = false;
                });
            },
        });
        return stream;
    }
    async keys(pattern) {
        const result = await this.runRawCommand(['KEYS', pattern]);
        return Array.isArray(result) ? result.map(toStringValue) : [];
    }
    async exists(...keys) {
        if (keys.length === 0) {
            return 0;
        }
        const result = await this.runRawCommand(['EXISTS', ...keys]);
        if (typeof result === 'boolean') {
            return result ? 1 : 0;
        }
        return Number(result);
    }
    async zadd(key, ...args) {
        const commandArgs = ['ZADD', key];
        for (let i = 0; i < args.length; i += 2) {
            commandArgs.push(toGlideArg(args[i]), toGlideArg(args[i + 1]));
        }
        return Number(await this.runRawCommand(commandArgs));
    }
    async zrem(key, ...members) {
        return Number(await this.runRawCommand(['ZREM', key, ...members]));
    }
    async xlen(key) {
        return Number(await this.runRawCommand(['XLEN', key]));
    }
    async xrevrange(key, end, start, ...rest) {
        const args = ['XREVRANGE', key, end, start];
        if (rest[0] === 'COUNT') {
            args.push('COUNT', toGlideArg(rest[1]));
        }
        return normalizeXRangeReply(await this.runRawCommand(args));
    }
    async sadd(key, ...members) {
        return Number(await this.runRawCommand([
            'SADD',
            key,
            ...members.map(member => toGlideArg(member)),
        ]));
    }
    async scard(key) {
        return Number(await this.runRawCommand(['SCARD', key]));
    }
    async lpush(key, ...values) {
        return Number(await this.runRawCommand(['LPUSH', key, ...values]));
    }
    async rpop(key) {
        const result = await this.runRawCommand(['RPOP', key]);
        return result == null ? null : toStringValue(result);
    }
    async incr(key) {
        return Number(await this.runRawCommand(['INCR', key]));
    }
    async incrby(key, increment) {
        return Number(await this.runRawCommand(['INCRBY', key, String(increment)]));
    }
    async flushall() {
        const result = await this.runRawCommand(['FLUSHALL']);
        return result == null ? 'OK' : toStringValue(result);
    }
    async execQueuedCommands(commands) {
        const requiredScripts = commands
            .map(command => String(command.args[0]).toUpperCase() === 'EVALSHA'
            ? this.scriptsBySha.get(toStringValue(command.args[1]))
            : undefined)
            .filter((script) => Boolean(script));
        if (requiredScripts.length > 0) {
            await Promise.all(requiredScripts.map(script => this.ensureScriptLoaded(script)));
        }
        return this.runSerialized(async (raw) => {
            if (typeof raw.exec === 'function') {
                const nativeBatch = createGlideBatch(true);
                const batch = nativeBatch !== null && nativeBatch !== void 0 ? nativeBatch : createCompatibilityBatch();
                if (batch) {
                    for (const command of commands) {
                        batch.customCommand(command.args);
                    }
                    let execResult;
                    try {
                        execResult = await raw.exec(batch, false);
                    }
                    catch (err) {
                        if (nativeBatch) {
                            throw err;
                        }
                        execResult = null;
                    }
                    if (!execResult) {
                        if (nativeBatch) {
                            return null;
                        }
                    }
                    else {
                        return execResult.map((value, index) => {
                            var _a;
                            if (value instanceof Error) {
                                return [value, null];
                            }
                            const transform = (_a = commands[index]) === null || _a === void 0 ? void 0 : _a.transform;
                            return [null, transform ? transform(value) : value];
                        });
                    }
                }
            }
            await raw.customCommand(['MULTI']);
            try {
                for (const command of commands) {
                    // During MULTI queueing Redis replies with "QUEUED". For commands such
                    // as HGETALL, Glide's default decoder expects a structured reply and
                    // throws if it receives this simple string, so force string decoding.
                    await raw.customCommand(command.args, {
                        decoder: GLIDE_STRING_DECODER,
                    });
                }
                const execResult = await raw.customCommand(['EXEC']);
                if (!execResult) {
                    return null;
                }
                const results = Array.isArray(execResult) ? execResult : [execResult];
                return results.map((value, index) => {
                    var _a;
                    if (value instanceof Error) {
                        return [value, null];
                    }
                    const transform = (_a = commands[index]) === null || _a === void 0 ? void 0 : _a.transform;
                    return [null, transform ? transform(value) : value];
                });
            }
            catch (err) {
                try {
                    await raw.customCommand(['DISCARD']);
                }
                catch (_a) {
                    // ignore
                }
                throw err;
            }
        });
    }
}
class ValkeyGlideTransaction {
    constructor(adapter, scripts) {
        this.adapter = adapter;
        this.scripts = scripts;
        this.commands = [];
    }
    queueCommand(args, transform) {
        this.commands.push({ args, transform });
        return this;
    }
    hgetall(key) {
        return this.queueCommand(['HGETALL', key], normalizeHashReply);
    }
    hset(key, data) {
        const args = ['HSET', key];
        for (const [field, value] of Object.entries(data)) {
            args.push(field, toGlideArg(value));
        }
        return this.queueCommand(args);
    }
    hscan(key, cursor, options) {
        const args = ['HSCAN', key, String(cursor)];
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', String(options.COUNT));
        }
        return this.queueCommand(args, value => {
            if (Array.isArray(value) && value.length >= 2) {
                return [toStringValue(value[0]), flattenFieldPairs(value[1])];
            }
            return ['0', []];
        });
    }
    smembers(key) {
        return this.queueCommand(['SMEMBERS', key], value => Array.isArray(value) ? value.map(item => toStringValue(item)) : []);
    }
    sscan(key, cursor, options) {
        const args = ['SSCAN', key, String(cursor)];
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', String(options.COUNT));
        }
        return this.queueCommand(args, value => {
            if (Array.isArray(value) && value.length >= 2) {
                const members = Array.isArray(value[1])
                    ? value[1].map(item => toStringValue(item))
                    : [];
                return [toStringValue(value[0]), members];
            }
            return ['0', []];
        });
    }
    zrange(key, start, end) {
        return this.queueCommand(['ZRANGE', key, String(start), String(end)]);
    }
    lrange(key, start, end) {
        return this.queueCommand(['LRANGE', key, String(start), String(end)]);
    }
    llen(key) {
        return this.queueCommand(['LLEN', key]);
    }
    del(...keys) {
        if (keys.length > 0) {
            this.queueCommand(['DEL', ...keys]);
        }
        return this;
    }
    runCommand(name, args) {
        const script = this.scripts.get(name);
        if (!script) {
            throw new Error(`BullMQ: command "${name}" is not defined. Use defineCommand() before adding it to transactions.`);
        }
        const normalizedArgs = normalizeScriptArgs(args);
        const keys = normalizedArgs.slice(0, script.numberOfKeys).map(toGlideArg);
        const argv = normalizedArgs.slice(script.numberOfKeys).map(toGlideArg);
        return this.queueCommand([
            'EVALSHA',
            script.sha,
            String(script.numberOfKeys),
            ...keys,
            ...argv,
        ]);
    }
    exec() {
        return this.adapter.execQueuedCommands(this.commands);
    }
}
