import { CodeObjectManager } from './code-object-manager';
import { FileObject } from './objects/file-object';
import { WebviewMessage } from '../shared/messages';
import * as THREE from 'three';

interface TestState {
    id: string; // Test ID (fileId:testName)
    fileId: string;
    label: string;
    status: 'passed' | 'failed' | 'running' | 'unknown';
}

export class TestManager {
    private tests: Map<string, TestState> = new Map();

    constructor(
        private objects: CodeObjectManager,
        private postMessage: (msg: WebviewMessage) => void
    ) { }

    public updateTestResult(id: string, status: 'passed' | 'failed' | 'running') {
        // ID is likely just a file path in our simple implementation
        // Or "fileId:TestName".
        // Find the file object
        const parts = id.split(':');
        const fileId = parts[0];

        const obj = this.objects.getObject(fileId);
        if (obj && obj instanceof FileObject) {
            obj.setTestStatus(status);

            // If failed, maybe create a Failure Cone? (Future)
        }
    }

    public updateTests(tests: any[]) {
        // Bulk update logic
        tests.forEach(test => {
            // Map TestDTO status to visual status
            // test.status: 'unknown' | 'passed' | 'failed' | 'running'
            const status = test.status === 'passed' ? 'passed' :
                test.status === 'failed' ? 'failed' :
                    test.status === 'running' ? 'running' : 'unknown';

            // Allow Unknown to clear badge if needed, or just ignore?
            // Let's pass it through.
            if (status !== 'unknown') {
                this.updateTestResult(test.id, status);
            }
        });
    }
}
