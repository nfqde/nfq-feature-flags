import {NFQEslintConfig} from '@nfq/eslint-config';
import {defineConfig} from 'eslint/config';

export default defineConfig([{
    extends: [NFQEslintConfig],
    ignores: [
        'src/app/(payload)/admin/importMap.js',
        'next-env.d.ts',
        'coverage/**',
        '.nyc_output/**',
        '.history/**',
        'public/mockServiceWorker.js',
        '.storybook/mock/mockServiceWorker.js',
        'next.config.js'
    ]
}]);