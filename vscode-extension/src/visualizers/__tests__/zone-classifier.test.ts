
import { ZoneClassifier } from '../zone-classifier';

describe('ZoneClassifier', () => {
    let classifier: ZoneClassifier;

    beforeEach(() => {
        classifier = new ZoneClassifier();
    });

    it('assigns test files to test zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/utils.test.ts' } as any)).toBe('test');
        expect(classifier.getZoneForFile({ filePath: 'src/__tests__/utils.ts' } as any)).toBe('test');
        expect(classifier.getZoneForFile({ filePath: '/test/integration.ts' } as any)).toBe('test');
        expect(classifier.getZoneForFile({ filePath: 'src/component.spec.js' } as any)).toBe('test');
    });

    it('assigns entry point files to entry zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/main.ts' } as any)).toBe('entry');
        expect(classifier.getZoneForFile({ filePath: 'src/index.ts' } as any)).toBe('entry');
        expect(classifier.getZoneForFile({ filePath: 'server.js' } as any)).toBe('entry');
        expect(classifier.getZoneForFile({ filePath: 'cli.py' } as any)).toBe('entry');
        expect(classifier.getZoneForFile({ filePath: 'bin/start.ts' } as any)).toBe('entry');
    });

    it('assigns API files to api zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/api/users.ts' } as any)).toBe('api');
        expect(classifier.getZoneForFile({ filePath: 'src/routes/auth.ts' } as any)).toBe('api');
        expect(classifier.getZoneForFile({ filePath: 'src/controllers/user-controller.ts' } as any)).toBe('api');
        expect(classifier.getZoneForFile({ filePath: 'src/handlers/webhook-handler.ts' } as any)).toBe('api');
    });

    it('assigns data layer files to data zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/models/user.ts' } as any)).toBe('data');
        expect(classifier.getZoneForFile({ filePath: 'src/schemas/order-schema.ts' } as any)).toBe('data');
        expect(classifier.getZoneForFile({ filePath: 'src/repositories/user-repository.ts' } as any)).toBe('data');
        expect(classifier.getZoneForFile({ filePath: 'prisma/schema.prisma' } as any)).toBe('data');
        expect(classifier.getZoneForFile({ filePath: 'db/migrations/001_init.sql' } as any)).toBe('data');
    });

    it('assigns UI files to ui zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/components/Button.tsx' } as any)).toBe('ui');
        expect(classifier.getZoneForFile({ filePath: 'src/views/Dashboard.tsx' } as any)).toBe('ui');
        expect(classifier.getZoneForFile({ filePath: 'src/pages/Home.tsx' } as any)).toBe('ui');
        expect(classifier.getZoneForFile({ filePath: 'src/styles/main.css' } as any)).toBe('ui');
        expect(classifier.getZoneForFile({ filePath: 'src/layouts/MainLayout.tsx' } as any)).toBe('ui');
    });

    it('assigns infrastructure files to infra zone', () => {
        expect(classifier.getZoneForFile({ filePath: '.github/workflows/ci.yml' } as any)).toBe('infra');
        expect(classifier.getZoneForFile({ filePath: 'Dockerfile' } as any)).toBe('infra');
        expect(classifier.getZoneForFile({ filePath: 'docker-compose.yml' } as any)).toBe('infra');
        expect(classifier.getZoneForFile({ filePath: 'k8s/deployment.yaml' } as any)).toBe('infra');
        expect(classifier.getZoneForFile({ filePath: 'terraform/main.tf' } as any)).toBe('infra');
        expect(classifier.getZoneForFile({ filePath: 'deploy/scripts.sh' } as any)).toBe('infra');
    });

    it('assigns utility files to lib zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/utils/string-helpers.ts' } as any)).toBe('lib');
        expect(classifier.getZoneForFile({ filePath: 'lib/common.ts' } as any)).toBe('lib');
        expect(classifier.getZoneForFile({ filePath: 'src/shared/types.ts' } as any)).toBe('lib');
        expect(classifier.getZoneForFile({ filePath: 'package.json' } as any)).toBe('lib');
        expect(classifier.getZoneForFile({ filePath: 'tsconfig.json' } as any)).toBe('lib');
    });

    it('assigns core business logic to core zone', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/services/payment-service.ts' } as any)).toBe('core');
        expect(classifier.getZoneForFile({ filePath: 'src/domain/order.ts' } as any)).toBe('core');
        expect(classifier.getZoneForFile({ filePath: 'src/managers/session-manager.ts' } as any)).toBe('core');
    });

    it('falls back to core for generic source files', () => {
        expect(classifier.getZoneForFile({ filePath: 'src/something.ts' } as any)).toBe('core');
        expect(classifier.getZoneForFile({ filePath: 'lib/utils.py' } as any)).toBe('lib');
    });
});
