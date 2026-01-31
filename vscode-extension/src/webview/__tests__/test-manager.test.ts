import { TestManager } from '../test-manager';
import { CodeObjectManager } from '../code-object-manager';
import { FileObject } from '../objects/file-object';

describe('TestManager', () => {
    let testManager: TestManager;
    let mockObjects: jest.Mocked<CodeObjectManager>;
    let mockPostMessage: jest.Mock;

    beforeEach(() => {
        mockObjects = {
            getObject: jest.fn()
        } as unknown as jest.Mocked<CodeObjectManager>;
        mockPostMessage = jest.fn();
        testManager = new TestManager(mockObjects, mockPostMessage);
    });

    it('should sanitize file IDs to match CodebaseAnalyzer format', () => {
        const rawId = 'src/test/demo.test.ts:my test';
        const sanitizedFileId = 'src_test_demo_test_ts';

        const mockFile = {
            setTestStatus: jest.fn()
        } as unknown as { setTestStatus: jest.Mock };
        Object.setPrototypeOf(mockFile, FileObject.prototype);

        mockObjects.getObject.mockReturnValue(mockFile as unknown as FileObject);

        testManager.updateTestResult(rawId, 'passed');

        // Should look for the sanitized ID
        expect(mockObjects.getObject).toHaveBeenCalledWith(sanitizedFileId);
        expect(mockFile.setTestStatus).toHaveBeenCalledWith('passed');
    });

    it('should aggregate test statuses (Fail > Running > Pass)', () => {
        const fileId = 'src/test.ts';
        // const sanitizedId = 'src_test_ts';
        const mockFile = {
            setTestStatus: jest.fn()
        } as unknown as { setTestStatus: jest.Mock };
        Object.setPrototypeOf(mockFile, FileObject.prototype);

        mockObjects.getObject.mockReturnValue(mockFile as unknown as FileObject);

        // 1. Pass
        testManager.updateTestResult(`${fileId}:test1`, 'passed');
        expect(mockFile.setTestStatus).toHaveBeenLastCalledWith('passed');

        // 2. Add Running (Running > Pass)
        testManager.updateTestResult(`${fileId}:test2`, 'running');
        expect(mockFile.setTestStatus).toHaveBeenLastCalledWith('running');

        // 3. Add Fail (Fail > Running)
        testManager.updateTestResult(`${fileId}:test3`, 'failed');
        expect(mockFile.setTestStatus).toHaveBeenLastCalledWith('failed');

        // 4. Update Fail to Pass (Still Fail if other fails exist, but here we only have 1 fail)
        // Actually our current implementation overwrites testId statuses correctly.
        testManager.updateTestResult(`${fileId}:test3`, 'passed');
        expect(mockFile.setTestStatus).toHaveBeenLastCalledWith('running'); // test2 is still running
    });
});
