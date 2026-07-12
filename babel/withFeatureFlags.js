const fs = require('fs');
const path = require('path');

const {parse} = require('yaml');

/**
 * Parses a YAML feature flag file and returns an object mapping flag names to their enabled state.
 * The function reads the file synchronously, parses the YAML content, and extracts the flags
 * from the `feature_flag.flags` structure. Each flag is mapped to a boolean value based on its `enabled` property.
 *
 * @param {string} filePath The absolute path to the YAML feature flag file to parse.
 * @returns {object} An object where keys are feature flag names and values are booleans indicating whether the flag is enabled.
 *
 * @example
 * ```tsx
 * const flags = parseYamlFlags('/path/to/features/live.yml');
 * // flags => { myFeature: true, oldFeature: false }
 * ```
 */
const parseYamlFlags = filePath => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const rawFlags = parse(fileContent);

    return Object.fromEntries(Object.entries(rawFlags.feature_flag.flags).map(([key, value]) => {
        if (value.enabled) {
            return [key, true];
        }

        return [key, false];
    }));
};

/**
 * Adds feature flag plugin to babel config.
 *
 * @param {object} config  Babel rc config used.
 * @param {object} options Plugin options.
 *
 * @returns {Function} Babel rc function.
 */
module.exports.withFeatureFlags = (config, options) => api => {
    let flags = {};
    let deprecationFlags = {};

    const cache = api.cache(() => process.env.FEATURE_ENV);
    const deprecationEnv = options.deprecationEnv ?? 'live';

    if (typeof config === 'function') {
        // eslint-disable-next-line no-param-reassign
        config = config(api);
    }

    if (options.isJs && cache) {
        // eslint-disable-next-line security/detect-non-literal-require
        flags = require(path.resolve(process.cwd(), `./features.${cache}.js`));
        // eslint-disable-next-line security/detect-non-literal-require
        deprecationFlags = require(path.resolve(process.cwd(), `./features.${deprecationEnv}.js`));
    } else if (cache) {
        const ymlPath = path.resolve(process.cwd(), `./features/${cache}.yml`);
        const yamlPath = path.resolve(process.cwd(), `./features/${cache}.yaml`);

        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        if (fs.existsSync(ymlPath)) {
            flags = parseYamlFlags(ymlPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        } else if (fs.existsSync(yamlPath)) {
            flags = parseYamlFlags(yamlPath);
        } else {
            // eslint-disable-next-line @stylistic/max-len
            throw new Error('No feature flag file found for the current environment. Please create a {FEATURE_ENV}.yml or {FEATURE_ENV}.yaml file in the ./features directory.');
        }

        const ymlDepPath = path.resolve(process.cwd(), `./features/${deprecationEnv}.yml`);
        const yamlDepPath = path.resolve(process.cwd(), `./features/${deprecationEnv}.yaml`);

        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        if (fs.existsSync(ymlDepPath)) {
            deprecationFlags = parseYamlFlags(ymlDepPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        } else if (fs.existsSync(yamlDepPath)) {
            deprecationFlags = parseYamlFlags(yamlDepPath);
        }
    }

    const plugin = [path.join(__dirname, '/plugin/jsx-feature-flags-plugin.js'), {
        deprecationFlags,
        featureFlagImport: '@app/features',
        flags,
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