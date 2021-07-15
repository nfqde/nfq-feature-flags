const path = require('path');

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