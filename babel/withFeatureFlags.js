const path = require('path');

/**
 * Adds feature flag plugin to babel config.
 *
 * @param {Object} config  Babel rc config used.
 * @param {Object} options Plugin options.
 *
 * @returns {Function} Babel rc function.
 */
module.exports.withFeatureFlags = (config, options) => api => {
    if (!process.env.FEATURE_ENV) {
        process.env.FEATURE_ENV = 'dev';
    }

    if (typeof config === 'function') {
        // eslint-disable-next-line no-param-reassign
        config = config(api);
    }

    // eslint-disable-next-line security/detect-non-literal-require
    const cache = api.cache(() => process.env.FEATURE_ENV);

    config.plugins.push([path.join(__dirname, '/plugin/jsx-feature-flags-plugin.js'), {
        deprecationEnv: options.deprecationEnv ?? 'live',
        featureFlagImport: '@app/features',
        // eslint-disable-next-line security/detect-non-literal-require
        flags: require(path.resolve(process.cwd(), `./features.${cache}.js`)),
        jsxImport: options.jsxImport ?? '@nfq/feature-flags/jsx',
        jsxWithFeature: options.jsxWithFeature ?? 'WithFeature',
        jsxWithoutFeature: options.jsxWithoutFeature ?? 'WithoutFeature'
    }]);

    return config;
};