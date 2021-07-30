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
    if (typeof config === 'function') {
        // eslint-disable-next-line no-param-reassign
        config = config(api);
    }

    // eslint-disable-next-line security/detect-non-literal-require
    const cache = api.cache(() => process.env.FEATURE_ENV);
    const plugin = [path.join(__dirname, '/plugin/jsx-feature-flags-plugin.js'), {
        deprecationEnv: options.deprecationEnv ?? 'live',
        featureFlagImport: '@app/features',
        // eslint-disable-next-line security/detect-non-literal-require
        flags: cache ? require(path.resolve(process.cwd(), `./features.${cache}.js`)) : {},
        jsxImport: options.jsxImport ?? '@nfq/feature-flags/jsx',
        jsxWithFeature: options.jsxWithFeature ?? 'WithFeature',
        jsxWithoutFeature: options.jsxWithoutFeature ?? 'WithoutFeature'
    }];


    if (typeof config.env !== 'undefined') {
        Object.keys(config.env).forEach(env => {
            if (!Array.isArray(config.env[String(env)].plugins)) {
                // eslint-disable-next-line no-param-reassign
                config.env[String(env)].plugins = [];
            }

            config.env[String(env)].plugins.push(plugin);
        });
    }

    if (Array.isArray(config.plugins)) {
        config.plugins.push(plugin);
    }

    return config;
};