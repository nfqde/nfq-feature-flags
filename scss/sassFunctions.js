const fs = require('fs');
const path = require('path');

// eslint-disable-next-line import/no-unresolved
const sass = require('sass');
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

const TRUE = sass.sassTrue || sass.SassBoolean?.TRUE || sass.types?.Boolean?.TRUE;
const FALSE = sass.sassFalse || sass.SassBoolean?.FALSE || sass.types?.Boolean?.FALSE;

/**
 * Creates a set of custom Sass functions for evaluating feature flag deprecation states at compile time.
 * It loads the feature flags for the specified deprecation environment from a YAML file and provides
 * three Sass functions: `is-deprecated`, `is-deprecated-live`, and `is-never-deprecated` for use in SCSS stylesheets.
 *
 * @param {object} opts                The options object for configuring the feature flag Sass functions.
 * @param {string} opts.deprecationEnv The environment name to load deprecation flags from (e.g. 'live'). Defaults to 'live'.
 * @param {string} opts.featurePath    The relative path to the features directory containing the YAML flag files. Defaults to './features'.
 * @returns {object} An object of custom Sass functions that can be passed to the Sass compiler's `functions` option.
 * @throws Will throw an error if no feature flag file is found for the specified deprecation environment.
 *
 * @example
 * ```tsx
 * const {featureFlags} = require('@nfq/feature-flags/scss/sassFunctions');
 *
 * const sassOptions = {
 *     functions: featureFlags({deprecationEnv: 'live', featurePath: './features'})
 * };
 * ```
 */
function featureFlags(opts = {}) {
    const {
        deprecationEnv = 'live',
        featurePath = './features'
    } = opts;
    let liveFeatures = {};

    const ymlPath = path.resolve(process.cwd(), featurePath, `${deprecationEnv}.yml`);
    const yamlPath = path.resolve(process.cwd(), featurePath, `${deprecationEnv}.yaml`);

    // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
    if (fs.existsSync(ymlPath)) {
        liveFeatures = parseYamlFlags(ymlPath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
    } else if (fs.existsSync(yamlPath)) {
        liveFeatures = parseYamlFlags(yamlPath);
    } else {
        // eslint-disable-next-line @stylistic/max-len
        throw new Error('No feature flag file found for the current environment. Please create a {FEATURE_ENV}.yml or {FEATURE_ENV}.yaml file in the ./features directory.');
    }

    return {
        /**
         * Determines whether a feature is deprecated by comparing the given date string against the current date.
         * If the date string is 'false', the feature is not considered deprecated. Otherwise, it checks if the
         * current date has passed the specified deprecation date and returns a Sass boolean accordingly.
         *
         * @param {Array} args The Sass function arguments array containing the date string parameter.
         * @returns {boolean} A Sass boolean value indicating whether the feature is deprecated.
         */
        'is-deprecated($dateStr)': function(args) {
            const dateStr = args[0].assertString('dateStr').text;

            if (dateStr === 'false') {
                return FALSE;
            }

            const isDeprecated = new Date() > new Date(dateStr);

            return isDeprecated ? TRUE : FALSE;
        },
        /**
         * Checks whether a feature flag is enabled in the live (deprecation) environment by looking up the flag name.
         * It retrieves the flag's state from the loaded live features and returns a Sass boolean indicating
         * whether the flag is active in production, which is used to determine if deprecated code should still be included.
         *
         * @param {Array} args The Sass function arguments array containing the feature flag name parameter.
         * @returns {boolean} A Sass boolean value indicating whether the feature flag is enabled in the live environment.
         */
        'is-deprecated-live($name)': function(args) {
            const name = args[0].assertString('name').text;

            // eslint-disable-next-line security/detect-object-injection
            if (liveFeatures[name] === true) {
                return TRUE;
            }

            return FALSE;
        },
        /**
         * Determines whether a feature is marked as never being deprecated by checking if the date string equals 'never'.
         * This is used to identify features that should permanently remain in the codebase and never be removed.
         * It returns a Sass TRUE value if the deprecation date is set to 'never', and FALSE otherwise.
         *
         * @param {Array} args The Sass function arguments array containing the date string parameter.
         * @returns {boolean} A Sass boolean value indicating whether the feature is marked as never deprecated.
         */
        'is-never-deprecated($dateStr)': function(args) {
            const dateStr = args[0].assertString('dateStr').text;

            if (dateStr === 'never') {
                return TRUE;
            }

            return FALSE;
        }
    };
}

module.exports.featureFlags = featureFlags;