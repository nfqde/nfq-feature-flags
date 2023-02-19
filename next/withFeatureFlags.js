/* eslint-disable no-param-reassign */
const path = require('path');

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
            // eslint-disable-next-line security/detect-non-literal-require, no-param-reassign
            config.cache.version += `|${JSON.stringify(require(path.resolve(process.cwd(), `./features.${process.env.FEATURE_ENV}.js`)))}`;
            // eslint-disable-next-line no-param-reassign
            config.cache.name = `${config.name}-${process.env.FEATURE_ENV}-${phase}`;

            if (typeof nextConfig.webpack === 'function') {
                return nextConfig.webpack(config, options);
            }

            return config;
        }
    };
};