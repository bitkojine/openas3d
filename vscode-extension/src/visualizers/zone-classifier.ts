import * as path from 'path';
import { CodeFile } from '../core/domain/code-file';

/**
 * Responsibility: Classifying files into architectural zones.
 */
export class ZoneClassifier {
    /**
     * Determine which zone a file belongs to based on architectural patterns.
     * 
     * Priority order (highest to lowest):
     * 1. Tests - explicitly marked test files
     * 2. Entry Points - main/index files, CLI handlers
     * 3. API Layer - routes, controllers, handlers
     * 4. Data Layer - models, schemas, repositories
     * 5. UI Layer - components, views, styles
     * 6. Infrastructure - CI/CD, Docker, K8s
     * 7. Utilities - utils, helpers, lib
     * 8. Core - business logic (fallback for source files)
     */
    public getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        const lowerPath = file.filePath.toLowerCase();
        const basename = path.basename(file.filePath).toLowerCase();
        const basenameNoExt = path.basename(file.filePath, ext).toLowerCase();

        // ========================================
        // 1. TESTS - highest priority
        // ========================================
        if (lowerPath.includes('.test.') ||
            lowerPath.includes('.spec.') ||
            lowerPath.includes('__tests__') ||
            lowerPath.includes('/test/') ||
            lowerPath.includes('/tests/') ||
            basename.endsWith('.test.ts') ||
            basename.endsWith('.test.js') ||
            basename.endsWith('.spec.ts') ||
            basename.endsWith('.spec.js')) {
            return 'test';
        }

        // ========================================
        // 2. INFRASTRUCTURE - CI/CD, Docker, K8s
        // ========================================
        if (lowerPath.includes('.github/') ||
            lowerPath.includes('.gitlab-ci') ||
            lowerPath.includes('ci/') ||
            lowerPath.includes('cd/') ||
            lowerPath.includes('docker') ||
            lowerPath.includes('k8s/') ||
            lowerPath.includes('kubernetes/') ||
            lowerPath.includes('helm/') ||
            lowerPath.includes('terraform/') ||
            lowerPath.includes('ansible/') ||
            lowerPath.includes('deploy/') ||
            lowerPath.includes('infra/') ||
            basename.startsWith('dockerfile') ||
            basename === 'docker-compose.yml' ||
            basename === 'docker-compose.yaml' ||
            basename.endsWith('.dockerfile') ||
            ['.tf', '.tfvars'].includes(ext)) {
            return 'infra';
        }

        // ========================================
        // 3. ENTRY POINTS - main files, CLI, app bootstrapping
        // ========================================
        const entryPatterns = ['main', 'index', 'app', 'server', 'cli', 'bin', 'entry', 'bootstrap', 'startup'];
        if (entryPatterns.includes(basenameNoExt) ||
            lowerPath.includes('/bin/') ||
            lowerPath.includes('/cmd/') ||
            lowerPath.includes('/cli/') ||
            lowerPath.startsWith('bin/') ||
            lowerPath.startsWith('cmd/') ||
            lowerPath.startsWith('cli/')) {
            // Only for source-like files
            if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'].includes(ext)) {
                return 'entry';
            }
        }


        // ========================================
        // 4. API LAYER - routes, controllers, handlers
        // ========================================
        if (lowerPath.includes('/api/') ||
            lowerPath.includes('/routes/') ||
            lowerPath.includes('/route/') ||
            lowerPath.includes('/controllers/') ||
            lowerPath.includes('/controller/') ||
            lowerPath.includes('/handlers/') ||
            lowerPath.includes('/handler/') ||
            lowerPath.includes('/endpoints/') ||
            lowerPath.includes('/resolvers/') ||
            lowerPath.includes('/graphql/') ||
            lowerPath.includes('/rest/') ||
            lowerPath.includes('/rpc/') ||
            basename.includes('controller') ||
            basename.includes('handler') ||
            basename.includes('route') ||
            basename.includes('endpoint')) {
            return 'api';
        }

        // ========================================
        // 5. DATA LAYER - models, schemas, repositories
        // ========================================
        if (lowerPath.includes('/models/') ||
            lowerPath.includes('/model/') ||
            lowerPath.includes('/schemas/') ||
            lowerPath.includes('/schema/') ||
            lowerPath.includes('/entities/') ||
            lowerPath.includes('/entity/') ||
            lowerPath.includes('/repositories/') ||
            lowerPath.includes('/repository/') ||
            lowerPath.includes('/repos/') ||
            lowerPath.includes('/dao/') ||
            lowerPath.includes('/migrations/') ||
            lowerPath.includes('/database/') ||
            lowerPath.includes('/db/') ||
            lowerPath.includes('/orm/') ||
            lowerPath.includes('/prisma/') ||
            basename.includes('model') ||
            basename.includes('schema') ||
            basename.includes('entity') ||
            basename.includes('repository') ||
            basename.includes('migration') ||
            ['.prisma', '.sql'].includes(ext)) {
            return 'data';
        }

        // ========================================
        // 6. UI LAYER - components, views, styles
        // ========================================
        if (lowerPath.includes('/components/') ||
            lowerPath.includes('/component/') ||
            lowerPath.includes('/views/') ||
            lowerPath.includes('/view/') ||
            lowerPath.includes('/pages/') ||
            lowerPath.includes('/page/') ||
            lowerPath.includes('/layouts/') ||
            lowerPath.includes('/layout/') ||
            lowerPath.includes('/screens/') ||
            lowerPath.includes('/ui/') ||
            lowerPath.includes('/widgets/') ||
            lowerPath.includes('/templates/') ||
            lowerPath.includes('/styles/') ||
            lowerPath.includes('/css/') ||
            lowerPath.includes('/scss/') ||
            basename.includes('component') ||
            basename.includes('view') ||
            basename.includes('page') ||
            basename.includes('layout') ||
            basename.includes('screen') ||
            ['.css', '.scss', '.sass', '.less', '.styl'].includes(ext) ||
            ['.tsx', '.jsx'].includes(ext)) { // React/Vue components
            return 'ui';
        }

        // ========================================
        // 7. UTILITIES - helpers, shared code
        // ========================================
        if (lowerPath.includes('/utils/') ||
            lowerPath.includes('/util/') ||
            lowerPath.includes('/helpers/') ||
            lowerPath.includes('/helper/') ||
            lowerPath.includes('/lib/') ||
            lowerPath.includes('/libs/') ||
            lowerPath.includes('/common/') ||
            lowerPath.includes('/shared/') ||
            lowerPath.includes('/tools/') ||
            lowerPath.includes('/utilities/') ||
            basename.includes('util') ||
            basename.includes('helper') ||
            basename.includes('common') ||
            basename.includes('constants') ||
            basename.includes('config') ||
            ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext)) {
            return 'lib';
        }

        // ========================================
        // 8. CORE - business logic, services, domain
        // ========================================
        if (lowerPath.includes('/services/') ||
            lowerPath.includes('/service/') ||
            lowerPath.includes('/domain/') ||
            lowerPath.includes('/core/') ||
            lowerPath.includes('/business/') ||
            lowerPath.includes('/logic/') ||
            lowerPath.includes('/managers/') ||
            lowerPath.includes('/providers/') ||
            basename.includes('service') ||
            basename.includes('manager') ||
            basename.includes('provider') ||
            basename.includes('use-case') ||
            basename.includes('usecase')) {
            return 'core';
        }

        // ========================================
        // FALLBACK: Source files -> core, others -> lib
        // ========================================
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go',
            '.cs', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php'].includes(ext)) {
            return 'core';
        }

        return 'lib';
    }
}
