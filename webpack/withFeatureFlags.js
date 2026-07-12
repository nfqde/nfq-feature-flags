const path = require('path');

/**
 * Wraps a webpack configuration with feature flag cache busting by appending the current feature flags to the cache version.
 * It accepts either a webpack config object or a function that returns one, and modifies the cache settings to ensure
 * that builds are invalidated whenever the feature flags for the current environment change.
 *
 * @param {object} webpackConfig The webpack configuration object or a function that returns a webpack configuration.
 * @returns {function} An async function that resolves the webpack config and applies feature flag cache versioning.
 *
 * @example
 * ```tsx
 * const {withFeatureFlags} = require('@nfq/feature-flags/webpack/withFeatureFlags');
 *
 * module.exports = withFeatureFlags((env, argv) => ({
 *     entry: './src/index.js',
 *     cache: {type: 'filesystem', version: '', name: ''}
 * }));
 * ```
 */
module.exports.withFeatureFlags = webpackConfig => async (...args) => {
    if (typeof webpackConfig === 'function') {
        // eslint-disable-next-line no-param-reassign
        webpackConfig = await webpackConfig(...args);
    }

    // eslint-disable-next-line security/detect-non-literal-require, no-param-reassign
    webpackConfig.cache.version += `|${JSON.stringify(require(path.resolve(process.cwd(), `./features.${process.env.FEATURE_ENV}.js`)))}`;
    // eslint-disable-next-line no-param-reassign
    webpackConfig.cache.name = `${process.env.FEATURE_ENV}`;

    return webpackConfig;
};