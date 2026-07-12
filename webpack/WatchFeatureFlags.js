const path = require('path');

const {SassGenerator} = require('./SassGenerator');

/**
 * A webpack plugin that watches for changes to feature flag YAML files and regenerates the SCSS output automatically.
 * It hooks into the webpack compilation lifecycle to generate the initial `_features.scss` file after plugins are resolved,
 * adds the features directory as a context dependency for watch mode, and re-generates the SCSS whenever a flag file changes.
 *
 * @example
 * ```tsx
 * const {WatchFeatureFlagsPlugin} = require('@nfq/feature-flags/webpack/WatchFeatureFlags');
 *
 * module.exports = {
 *     plugins: [
 *         new WatchFeatureFlagsPlugin({featurePath: './features', outputPath: './src/styles'})
 *     ]
 * };
 * ```
 */
class WatchFeatureFlagsPlugin {
    /**
     * The relative path to the directory containing the feature flag YAML files.
     */
    featurePath = '';

    /**
     * The relative path to the directory where the generated `_features.scss` file will be written.
     */
    outputPath = '';

    /**
     * The current feature environment name derived from the `FEATURE_ENV` environment variable.
     */
    featureEnv = process.env.FEATURE_ENV;

    /**
     * Creates a new WatchFeatureFlagsPlugin instance with the specified feature path and output path.
     * It validates that both required options are provided and throws an error if either is missing.
     * The constructor stores the paths for use during the webpack compilation lifecycle hooks.
     *
     * @param {object} options             The plugin options object.
     * @param {string} options.featurePath The relative path to the directory containing feature flag YAML files.
     * @param {string} options.outputPath  The relative path to the directory where the generated SCSS file will be written.
     *
     * @throws Will throw an error if `featurePath` or `outputPath` is not provided.
     */
    constructor(options) {
        if (!options.featurePath) {
            throw new Error('Missing featurePath option for WatchFeatureFlagsPlugin');
        }

        if (!options.outputPath) {
            throw new Error('Missing outputPath option for WatchFeatureFlagsPlugin');
        }

        this.featurePath = options.featurePath;
        this.outputPath = options.outputPath;
    }

    /**
     * Applies the plugin to the webpack compiler by registering hooks for initial generation, dependency tracking, and watch mode.
     * It taps into `afterPlugins` to generate the initial SCSS file, `afterCompile` to register the features directory
     * as a watched context dependency, and `watchRun` to regenerate the SCSS when feature flag files are modified.
     *
     * @param {object} compiler The webpack compiler instance to attach the plugin hooks to.
     */
    apply(compiler) {
        compiler.hooks.afterPlugins.tap('WatchFeatureFlagsPlugin', () => {
            const generator = new SassGenerator(
                this.featurePath,
                this.outputPath,
                this.featureEnv
            );

            generator.generate();
        });
        compiler.hooks.afterCompile.tap('WatchFeatureFlagsPlugin', compilation => {
            compilation.contextDependencies.add(path.resolve(this.featurePath));
        });
        compiler.hooks.watchRun.tap('WatchFeatureFlagsPlugin', compilation => {
            if (!compilation.modifiedFiles) {
                return;
            }

            const [changedFile] = Array.from(compilation.modifiedFiles);

            if (!changedFile) {
                return;
            }

            const resolvedFeaturePath = path.resolve(this.featurePath);

            if (changedFile.includes(resolvedFeaturePath)) {
                const generator = new SassGenerator(
                    this.featurePath,
                    this.outputPath,
                    this.featureEnv
                );

                generator.generate();
            }
        });
    }
}

module.exports.WatchFeatureFlagsPlugin = WatchFeatureFlagsPlugin;