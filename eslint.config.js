// eslint.config.js
import { defineConfig } from 'eslint/config'
import cmyr from 'eslint-config-cmyr'

export default defineConfig([
    ...cmyr,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    defaultProject: 'tsconfig.json',
                    allowDefaultProject: ['*.config.*', '*.config.js', 'commitlint.config.ts', 'release.config.js'],
                },
            },
        },
    },
])
