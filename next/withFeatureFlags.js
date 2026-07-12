/* eslint-disable no-param-reassign */
const path = require('path');

/**
 * Wraps a Next.js configuration with feature flag support by modifying the webpack cache strategy.
 * It ensures the `@nfq/feature-flags` package is included in `transpilePackages` and adjusts the webpack
 * cache version and name based on the current feature environment, so builds are correctly invalidated when flags change.
 *
 * @param {object} nextConfig    The Next.js configuration object to enhance with feature flag support.
 * @param {object} options       The options object containing the Next.js phase.
 * @param {string} options.phase The current Next.js build phase (e.g., `PHASE_DEVELOPMENT_SERVER` or `PHASE_PRODUCTION_BUILD`).
 * @returns {object} The enhanced Next.js configuration object with feature flag webpack caching and transpile settings applied.
 *
 * @example
 * ```tsx
 * const {withFeatureFlags} = require('@nfq/feature-flags/next');
 * const {PHASE_DEVELOPMENT_SERVER} = require('next/constants');
 *
 * module.exports = (phase) => withFeatureFlags({reactStrictMode: true}, {phase});
 * ```
 */
module.exports.withFeatureFlags = (nextConfig, {phase}) => {
    if (nextConfig.transpilePackages) {
        nextConfig.transpilePackages.push('@nfq/feature-flags');
    } else {
        nextConfig.transpilePackages = ['@nfq/feature-flags'];
    }

    return {
        ...nextConfig,
        /**
         * The webpack config.
         *
         * @param {import('webpack').Configuration} config  Webpack config.
         * @param {object}                          options The webpack options.
         * @returns {import('webpack').Configuration} Webpack config.
         */
        webpack(config, options) {
            // eslint-disable-next-line security/detect-non-literal-require
            config.cache.version += `|${JSON.stringify(require(path.resolve(process.cwd(), `./features.${process.env.FEATURE_ENV}.js`)))}`;
            config.cache.name = `${config.name}-${process.env.FEATURE_ENV}-${phase}`;

            if (typeof nextConfig.webpack === 'function') {
                return nextConfig.webpack(config, options);
            }

            return config;
        }
    };
};