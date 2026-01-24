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
    private tests: Map<string, Map<string, TestState>> = new Map(); // fileId -> testId -> TestState

    constructor(
        private objects: CodeObjectManager,
        private postMessage: (msg: WebviewMessage) => void
    ) { }

    public updateTestResult(id: string, status: 'passed' | 'failed' | 'running' | 'unknown') {
        const parts = id.split(':');
        const rawFileId = parts[0];
        // Sanitize to match CodebaseAnalyzer's generateFileId logic
        const fileId = rawFileId.replace(/[^a-zA-Z0-9]/g, '_');

        let fileTests = this.tests.get(fileId);
        if (!fileTests) {
            fileTests = new Map();
            this.tests.set(fileId, fileTests);
        }

        fileTests.set(id, {
            id,
            fileId,
            label: parts[1] || id,
            status
        });

        this.syncFileStatus(fileId);
    }

    private syncFileStatus(fileId: string) {
        const fileTests = this.tests.get(fileId);
        if (!fileTests) return;

        const allTests = Array.from(fileTests.values());

        // Aggregate status: Fail > Running > Pass > Unknown
        let aggregate: 'passed' | 'failed' | 'running' | 'unknown' = 'unknown';

        if (allTests.some(t => t.status === 'failed')) {
            aggregate = 'failed';
        } else if (allTests.some(t => t.status === 'running')) {
            aggregate = 'running';
        } else if (allTests.some(t => t.status === 'passed')) {
            aggregate = 'passed';
        }

        const obj = this.objects.getObject(fileId);
        if (obj && typeof (obj as any).setTestStatus === 'function') {
            (obj as any).setTestStatus(aggregate);
        }
    }

    public updateTests(tests: any[]) {
        tests.forEach(test => {
            this.updateTestResult(test.id, test.status);
        });
    }
}
