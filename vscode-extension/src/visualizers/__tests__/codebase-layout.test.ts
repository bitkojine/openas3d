// __tests__/codebase-layout.test.ts
import { CodebaseLayoutEngine } from '../codebase-layout';
import { LayoutPersistenceService } from '../../services/layout-persistence';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CodebaseLayoutEngine (Behavioral)', () => {
    it('computes positions consistently', () => {
        const engine = new CodebaseLayoutEngine();

        // Minimal valid CodeFile objects
        const files = [
            { id: 'file1', filePath: 'src/service.ts', language: 'typescript', size: 100, lines: 10 } as any,
            { id: 'file2', filePath: 'src/manager.ts', language: 'typescript', size: 200, lines: 20 } as any,
        ];

        const positions = engine.computePositions(files);

        expect(positions.get('file1')).toBeDefined();
        expect(positions.get('file2')).toBeDefined();

        // file1 and file2 should not have the same position
        expect(positions.get('file1')).not.toEqual(positions.get('file2'));
    });

    it('produces deterministic output for same input', () => {
        const engine = new CodebaseLayoutEngine();
        const files = [
            { id: 'f1', filePath: 'src/services/main-service.ts', language: 'typescript', size: 50, lines: 10 } as any,
            { id: 'f2', filePath: 'src/utils/helpers.ts', language: 'typescript', size: 30, lines: 5 } as any,
        ];

        const pos1 = engine.computePositions(files);
        const pos2 = engine.computePositions(files);

        // Positions should be exactly equal
        const p1_f1 = pos1.get('f1');
        const p2_f1 = pos2.get('f1');

        expect(p1_f1).toBeDefined();
        expect(p1_f1).toEqual(p2_f1);
    });

    describe('zone assignment', () => {
        let engine: CodebaseLayoutEngine;

        beforeEach(() => {
            engine = new CodebaseLayoutEngine();
        });

        it('assigns test files to test zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/utils.test.ts' } as any)).toBe('test');
            expect(engine.getZoneForFile({ filePath: 'src/__tests__/utils.ts' } as any)).toBe('test');
            expect(engine.getZoneForFile({ filePath: '/test/integration.ts' } as any)).toBe('test');
            expect(engine.getZoneForFile({ filePath: 'src/component.spec.js' } as any)).toBe('test');
        });

        it('assigns entry point files to entry zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/main.ts' } as any)).toBe('entry');
            expect(engine.getZoneForFile({ filePath: 'src/index.ts' } as any)).toBe('entry');
            expect(engine.getZoneForFile({ filePath: 'server.js' } as any)).toBe('entry');
            expect(engine.getZoneForFile({ filePath: 'cli.py' } as any)).toBe('entry');
            expect(engine.getZoneForFile({ filePath: 'bin/start.ts' } as any)).toBe('entry');
        });

        it('assigns API files to api zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/api/users.ts' } as any)).toBe('api');
            expect(engine.getZoneForFile({ filePath: 'src/routes/auth.ts' } as any)).toBe('api');
            expect(engine.getZoneForFile({ filePath: 'src/controllers/user-controller.ts' } as any)).toBe('api');
            expect(engine.getZoneForFile({ filePath: 'src/handlers/webhook-handler.ts' } as any)).toBe('api');
        });

        it('assigns data layer files to data zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/models/user.ts' } as any)).toBe('data');
            expect(engine.getZoneForFile({ filePath: 'src/schemas/order-schema.ts' } as any)).toBe('data');
            expect(engine.getZoneForFile({ filePath: 'src/repositories/user-repository.ts' } as any)).toBe('data');
            expect(engine.getZoneForFile({ filePath: 'prisma/schema.prisma' } as any)).toBe('data');
            expect(engine.getZoneForFile({ filePath: 'db/migrations/001_init.sql' } as any)).toBe('data');
        });

        it('assigns UI files to ui zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/components/Button.tsx' } as any)).toBe('ui');
            expect(engine.getZoneForFile({ filePath: 'src/views/Dashboard.tsx' } as any)).toBe('ui');
            expect(engine.getZoneForFile({ filePath: 'src/pages/Home.tsx' } as any)).toBe('ui');
            expect(engine.getZoneForFile({ filePath: 'src/styles/main.css' } as any)).toBe('ui');
            expect(engine.getZoneForFile({ filePath: 'src/layouts/MainLayout.tsx' } as any)).toBe('ui');
        });

        it('assigns infrastructure files to infra zone', () => {
            expect(engine.getZoneForFile({ filePath: '.github/workflows/ci.yml' } as any)).toBe('infra');
            expect(engine.getZoneForFile({ filePath: 'Dockerfile' } as any)).toBe('infra');
            expect(engine.getZoneForFile({ filePath: 'docker-compose.yml' } as any)).toBe('infra');
            expect(engine.getZoneForFile({ filePath: 'k8s/deployment.yaml' } as any)).toBe('infra');
            expect(engine.getZoneForFile({ filePath: 'terraform/main.tf' } as any)).toBe('infra');
            expect(engine.getZoneForFile({ filePath: 'deploy/scripts.sh' } as any)).toBe('infra');
        });

        it('assigns utility files to lib zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/utils/string-helpers.ts' } as any)).toBe('lib');
            expect(engine.getZoneForFile({ filePath: 'lib/common.ts' } as any)).toBe('lib');
            expect(engine.getZoneForFile({ filePath: 'src/shared/types.ts' } as any)).toBe('lib');
            expect(engine.getZoneForFile({ filePath: 'package.json' } as any)).toBe('lib');
            expect(engine.getZoneForFile({ filePath: 'tsconfig.json' } as any)).toBe('lib');
        });

        it('assigns core business logic to core zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/services/payment-service.ts' } as any)).toBe('core');
            expect(engine.getZoneForFile({ filePath: 'src/domain/order.ts' } as any)).toBe('core');
            expect(engine.getZoneForFile({ filePath: 'src/managers/session-manager.ts' } as any)).toBe('core');
        });

        it('falls back to core for generic source files', () => {
            expect(engine.getZoneForFile({ filePath: 'src/something.ts' } as any)).toBe('core');
            expect(engine.getZoneForFile({ filePath: 'lib/utils.py' } as any)).toBe('lib');
        });
    });

    describe('persistence integration', () => {
        let tempDir: string;

        beforeAll(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-engine-test-'));
        });

        afterAll(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('incorporates manual overrides from persistence service', async () => {
            const persistence = new LayoutPersistenceService(tempDir);
            const engine = new CodebaseLayoutEngine(persistence);

            const file1 = { id: 'file1', filePath: 'src/main.ts' } as any;
            const file2 = { id: 'file2', filePath: 'src/api.ts' } as any;

            // Save a manual override for file1
            await persistence.savePosition('file1', 100, 200);

            const positions = engine.computePositions([file1, file2]);

            // file1 should be at the override position
            expect(positions.get('file1')).toEqual({ x: 100, z: 200 });

            // file2 should be procedurally placed (not at override position)
            const pos2 = positions.get('file2');
            expect(pos2).toBeDefined();
            expect(pos2).not.toEqual({ x: 100, z: 200 });
        });
    });

    describe('spiral expansion', () => {
        it('places files in expanding spiral pattern', () => {
            const engine = new CodebaseLayoutEngine();

            // Create 10 files in the same zone (core)
            const files = Array.from({ length: 10 }, (_, i) => ({
                id: `f${i}`,
                filePath: `src/services/file${i}.ts`
            } as any));

            const positions = engine.computePositions(files);

            // All positions should be unique
            const posArray = Array.from(positions.values());
            const uniquePositions = new Set(posArray.map(p => `${p.x},${p.z}`));
            expect(uniquePositions.size).toBe(10);

            // First file should be at zone center
            const firstPos = positions.get('f0');
            expect(firstPos).toBeDefined();
            // Core zone is centered at (0, 0)
            expect(firstPos!.x).toBe(0);
            expect(firstPos!.z).toBe(0);
        });
    });

    describe('zone configuration', () => {
        it('returns all zone configs', () => {
            const engine = new CodebaseLayoutEngine();
            const zones = engine.getAllZones();

            expect(zones.length).toBe(8);
            expect(zones.map(z => z.name).sort()).toEqual([
                'api', 'core', 'data', 'entry', 'infra', 'lib', 'test', 'ui'
            ]);
        });
    });
});
