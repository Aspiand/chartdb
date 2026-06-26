import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd(), '..');

describe('Project Structure', () => {
    it('should have all required directories', () => {
        for (const dir of [
            'backend/pb_hooks',
            'backend/pb_migrations',
            'shared/src',
            'docker/nginx',
            'docs',
        ]) {
            expect(existsSync(`${PROJECT_ROOT}/${dir}`), `${dir}`).toBe(true);
        }
    });

    it('should have required config files', () => {
        for (const file of [
            '.env.example',
            'package.json',
            'flake.nix',
            'docker/docker-compose.yml',
        ]) {
            expect(existsSync(`${PROJECT_ROOT}/${file}`), `${file}`).toBe(true);
        }
    });

    it('should have valid npm workspaces', () => {
        const content = readFileSync(`${PROJECT_ROOT}/package.json`, 'utf-8');
        const pkg = JSON.parse(content);
        expect(pkg.workspaces).toContain('frontend');
        expect(pkg.workspaces).toContain('shared');
    });
});
