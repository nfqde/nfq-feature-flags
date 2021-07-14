const path = require('path');

const withTM = require('next-transpile-modules')(['@nfq/feature-flags']);

module.exports.withFeatureFlags = nextConfig => {
    const transpiledConfig = withTM(nextConfig);

    return {
        ...transpiledConfig,
        webpack(config, options) {
            // eslint-disable-next-line security/detect-non-literal-require, no-param-reassign
            config.cache.version += `|${JSON.stringify(require(path.resolve(process.cwd(), `./features.${process.env.FEATURE_ENV}.js`)))}`;
            // eslint-disable-next-line no-param-reassign
            config.cache.name = `${config.name}-${process.env.FEATURE_ENV}`;

            if (typeof transpiledConfig.webpack === 'function') {
                return transpiledConfig.webpack(config, options);
            }

            return config;
        }
    };
};