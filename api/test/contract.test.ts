import { describe, expect, it } from 'vitest';
import type {
    ApiEnvelope,
    BuildCompletion as SharedCompletion,
    BuildJob as SharedBuildJob,
    JobAccepted,
} from '../../shared/types';
import { success } from '../src/lib/envelope';
import { buildJobSchema, completeCallbackSchema } from '../src/schemas/job';
import { TEST_BUILD_UUID, testJob } from './helpers';

/**
 * These tests fail to compile if the shared wire contract drifts from the
 * executable zod schemas used by the agent.
 */
describe('shared wire contracts', () => {
    it('accepts the shared BuildJob shape', () => {
        const job: SharedBuildJob = testJob();

        expect(buildJobSchema.parse(job)).toEqual(job);
    });

    it('accepts the shared completion shape', () => {
        const completion: SharedCompletion = {
            status: 'succeeded',
            exitCode: 0,
            error: null,
            progress: 100,
            artifact: {
                disk: 's3',
                path: `builds/${TEST_BUILD_UUID}/openbox-image-amd64.hybrid.iso`,
                size: 1024,
                sha256: 'a'.repeat(64),
            },
        };

        expect(completeCallbackSchema.parse(completion)).toEqual(completion);
    });

    it('produces the shared envelope shape', () => {
        const envelope: ApiEnvelope<JobAccepted> = success({
            buildUuid: TEST_BUILD_UUID,
            accepted: true,
            duplicate: false,
        });

        expect(envelope.success).toBe(true);
        expect(envelope.error).toBeNull();
        expect(envelope.data).toMatchObject({ duplicate: false });
    });
});
