import { describe, expect, it } from 'vitest';
import { buildJobSchema, manifestSchema } from '../src/schemas/job';
import { testJob, testManifest } from './helpers';

describe('manifest schema', () => {
    it('accepts the manifest emitted by the Laravel factory', () => {
        const result = manifestSchema.safeParse(testManifest());

        expect(result.success).toBe(true);
    });

    it('rejects path traversal in the ISO name', () => {
        const manifest = testManifest({
            liveBuild: {
                isolatedWorkspace: true,
                clean: false,
                isoName: '../../etc/passwd.iso',
            },
        });

        expect(manifestSchema.safeParse(manifest).success).toBe(false);
    });

    it('rejects unknown architectures', () => {
        const manifest = testManifest({
            debian: {
                suite: 'bookworm',
                architecture: 'riscv64' as 'amd64',
                mirror: 'http://deb.debian.org/debian',
            },
        });

        expect(manifestSchema.safeParse(manifest).success).toBe(false);
    });

    it('rejects unsafe installer filenames', () => {
        const manifest = testManifest({
            includePanelInstaller: true,
            panelInstaller: { filename: '../install.sh', sha256: 'a'.repeat(64) },
        });

        expect(manifestSchema.safeParse(manifest).success).toBe(false);
    });
});

describe('build job schema', () => {
    it('accepts a valid job payload', () => {
        expect(buildJobSchema.safeParse(testJob()).success).toBe(true);
    });

    it('rejects a non-UUID build identifier', () => {
        expect(buildJobSchema.safeParse(testJob({ buildUuid: 'not-a-uuid' })).success).toBe(false);
    });

    it('rejects a non-HTTP callback base URL', () => {
        expect(buildJobSchema.safeParse(testJob({ callbackBaseUrl: 'file:///etc/passwd' })).success).toBe(false);
    });
});
