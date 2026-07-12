const fs = require('fs');
const path = require('path');

const {parse} = require('yaml');

/**
 * Generates an SCSS file containing feature flag configuration for use with the Sass feature flags system.
 * It reads feature flags from a YAML file based on the current environment and produces a `_features.scss` file
 * that configures the `@nfq/feature-flags/features/config` module with the correct flag values and Sass variables.
 *
 * @example
 * ```tsx
 * const {SassGenerator} = require('@nfq/feature-flags/webpack/SassGenerator');
 *
 * const generator = new SassGenerator('./features', './src/styles', 'live');
 * generator.generate();
 * ```
 */
class SassGenerator {
    /**
     * Creates a new SassGenerator instance with the specified feature path, output path, and environment.
     * The constructor stores the configuration needed to locate and parse the YAML feature flag files
     * and to determine where the generated SCSS output should be written.
     *
     * @param {string} featurePath The relative path to the directory containing the feature flag YAML files.
     * @param {string} outputPath  The relative path to the directory where the generated `_features.scss` file will be written.
     * @param {string} featureEnv  The environment name used to select the correct YAML feature flag file (e.g. 'live', 'dev').
     */
    constructor(featurePath, outputPath, featureEnv) {
        this.featurePath = featurePath;
        this.outputPath = outputPath;
        this.featureEnv = featureEnv;
    }

    /**
     * Parses a YAML feature flag file and returns an object mapping flag names to their enabled state.
     * The method reads the file synchronously, parses the YAML content, and extracts the flags
     * from the `feature_flag.flags` structure. Each flag is mapped to a boolean value based on its `enabled` property.
     *
     * @param {string} filePath The absolute path to the YAML feature flag file to parse.
     * @returns {object} An object where keys are feature flag names and values are booleans indicating whether the flag is enabled.
     */
    parseYamlFlags(filePath) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rawFlags = parse(fileContent);

        return Object.fromEntries(Object.entries(rawFlags.feature_flag.flags).map(([key, value]) => {
            if (value.enabled) {
                return [key, true];
            }

            return [key, false];
        }));
    }

    /**
     * Generates a `_features.scss` file containing the feature flag configuration for the current environment.
     * It resolves the appropriate YAML file (`.yml` or `.yaml`), parses the flags, and writes an SCSS file
     * that imports the feature flags config module with the correct flag values and exports Sass variables for each flag.
     *
     * @throws Will throw an error if no feature flag YAML file is found for the configured environment.
     */
    generate() {
        let flags = {};
        let css = '';
        const ymlPath = path.resolve(process.cwd(), this.featurePath, `${this.featureEnv}.yml`);
        const yamlPath = path.resolve(process.cwd(), this.featurePath, `${this.featureEnv}.yaml`);

        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        if (fs.existsSync(ymlPath)) {
            flags = this.parseYamlFlags(ymlPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        } else if (fs.existsSync(yamlPath)) {
            flags = this.parseYamlFlags(yamlPath);
        } else {
            // eslint-disable-next-line @stylistic/max-len
            throw new Error('No feature flag file found for the current environment. Please create a {FEATURE_ENV}.yml or {FEATURE_ENV}.yaml file in the ./features directory.');
        }

        css += '@use "@nfq/feature-flags/features/config" with (\n';
        css += '    $features: (\n';
        css += `${Object.entries(flags).map(([flagName, flagValue]) => `        ${flagName}: ${flagValue}`).join(',\n')}\n`;
        css += '    )\n';
        css += ');\n';
        css += '\n';
        css += Object.entries(flags).map(([flagName]) => `$${flagName}: '${flagName}';`).join('\n');

        // eslint-disable-next-line security/detect-non-literal-fs-filename, n/no-sync
        fs.writeFileSync(path.resolve(process.cwd(), this.outputPath, '_features.scss'), css);
    }
}

module.exports.SassGenerator = SassGenerator;