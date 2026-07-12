/**
 * Creates a custom Sass logger that intercepts deprecation warnings emitted by the feature flags SCSS mixins.
 * It parses the warning message and stack trace to produce human-readable, colorized console output indicating
 * which feature flag usage is deprecated and where it was called from in the source files.
 *
 * @returns {object} A Sass logger object with a `warn` method that formats feature flag deprecation warnings for the console.
 *
 * @example
 * ```tsx
 * const {featureFlagsLogger} = require('@nfq/feature-flags/scss/sassLogger');
 *
 * const sassOptions = {
 *     logger: featureFlagsLogger()
 * };
 * ```
 */
function featureFlagsLogger() {
    return {
        /**
         * Handles Sass warning messages by detecting feature flag deprecation warnings and formatting them with colors.
         * If the message contains 'feature-flags-expired', it parses the stack trace to identify the caller location
         * and outputs a colorized warning indicating which feature is deprecated and since when or why.
         * For non-feature-flag warnings, it falls through to the default `console.warn` behavior.
         *
         * @param {string} message The warning message string emitted by the Sass compiler.
         * @param {object} opts    The Sass warning options object containing the stack trace and other metadata.
         */
        warn(message, opts) {
            if (message.includes('feature-flags-expired')) {
                const stack = opts.stack || '';
                // Extract caller location from stack (second line)
                const stackLines = stack.split('\n');
                const callerLine = stackLines.find(
                    line => !line.includes('withFeature') && !line.includes('withoutFeature')
                );
                const isWithFeature = stackLines[0].includes('withFeature');
                const fileMatch = callerLine.trim().replace(/\s+@.*$/u, '');

                const prefix = '\x1b[33mWarning!:\x1b[0m';
                const file = `\x1b[34m${fileMatch}\x1b[0m`;

                const [type, featureName, deprecationDate] = message.split(',').map(s => s.trim());

                if (type === 'feature-flags-expired') {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `${prefix} ${file} \x1b[32m${isWithFeature ? 'withFeature' : 'withoutFeature'}\x1b[0m (with feature \x1b[32m${featureName}\x1b[0m) is deprecated since \x1b[32m${deprecationDate}\x1b[0m!`
                    );
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `${prefix} ${file} \x1b[32m${isWithFeature ? 'withFeature' : 'withoutFeature'}\x1b[0m (with feature \x1b[32m${featureName}\x1b[0m) is deprecated because its active in live features list!`
                    );
                }
            } else {
                // eslint-disable-next-line no-console
                console.warn(message);
            }
        }
    };
}

module.exports.featureFlagsLogger = featureFlagsLogger;