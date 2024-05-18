const fs = require('fs');
const path = require('path');

/**
 * Generate Type Files.
 *
 * @param {string} featureFlagImport The import name for feature flags configured in your babel config.
 * @param {string} jsxImport         The import name for the jsx components that render feature flags. As configured in your babel config.
 * @param {string} jsxWithFeature    The name of the with feature flag jsx component. As configured in your babel config.
 * @param {string} jsxWithoutFeature The name of the without feature flag jsx component. As configured in your babel config.
 * @param {string} usedEnv           The env to use the flags from.
 */
const generateTypeFiles = (featureFlagImport, jsxImport, jsxWithFeature, jsxWithoutFeature, usedEnv) => {
    const rootPath = process.cwd();
    const featureJsx = `/* eslint-disable max-classes-per-file, react/no-multi-comp */
declare module '${jsxImport}' {
    import type {ReactNode} from 'react';
    import {Component} from 'react';

    interface IFeature {
        children: ReactNode;
        deprecatesOn?: string;
        feature: boolean[] | boolean;
        neverDeprecates?: boolean;
    }

    /**
     * WithFeature component.
     */
    export class ${jsxWithFeature} extends Component<IFeature, any> {}
    /**
     * WithoutFeature component.
     */
    export class ${jsxWithoutFeature} extends Component<IFeature, any> {}
}`;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename, node/no-sync
        fs.mkdirSync(`${rootPath}/types`);
    } catch (e) {}

    // eslint-disable-next-line security/detect-non-literal-fs-filename, node/no-sync
    fs.writeFileSync(`${rootPath}/types/featureJsx.d.ts`, featureJsx);

    // eslint-disable-next-line security/detect-non-literal-require
    const flags = require(path.resolve(rootPath, `./features.${usedEnv}.js`)) || {};

    const featureFlags = `declare module '${featureFlagImport}' {
    ${Object.keys(flags).map(key => `export const ${key}: boolean;`).join('\n    ')}
}`;

    // eslint-disable-next-line security/detect-non-literal-fs-filename, node/no-sync
    fs.writeFileSync(`${rootPath}/types/featureFlags.d.ts`, featureFlags);
};

module.exports = generateTypeFiles;