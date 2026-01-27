import { ZoneClassifier } from '../zone-classifier';

describe('ZoneClassifier Priority', () => {
    let classifier: ZoneClassifier;

    beforeEach(() => {
        classifier = new ZoneClassifier();
    });

    it('should classify services as "core" even if they contain "util" in the name', () => {
        const file = { filePath: 'src/services/user-util-service.ts' };
        const zone = classifier.getZoneForFile(file as any);

        expect(zone).toBe('core');
    });

    it('should classify providers as "core"', () => {
        const file = { filePath: 'src/providers/auth-provider.ts' };
        const zone = classifier.getZoneForFile(file as any);
        expect(zone).toBe('core');
    });
});
