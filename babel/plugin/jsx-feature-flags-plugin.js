const {buildFlag, handleJsxElement, isFlag, isJSX} = require('./helper');

module.exports = babel => {
    const {types} = babel;

    return {
        name: 'jsx-feature-flags-plugin',
        visitor: {
            ImportDeclaration: {
                /**
                 * Removes an import declaration if it imports a feature flag or a JSX element that is not used,
                 * based on the presence of specifiers and whether the import path matches a flag or JSX condition.
                 *
                 * @param {object} path  The Babel path object for the import declaration.
                 * @param {object} state The current state of the transformation, including options and other metadata.
                 */
                exit(path, state) {
                    const importPath = path.node.source.value;

                    if (
                        (isFlag(state, importPath) || isJSX(state, importPath))
                        && path.get('specifiers').length === 0
                    ) {
                        path.remove();
                    }
                }
            },
            /**
             * Processes individual import specifiers, replacing references based on feature flags or removing unsupported imports.
             * Throws an error if an import does not match the supported flags or JSX elements.
             *
             * @param {object} path  The Babel path object for the import specifier.
             * @param {object} state The transformation state with options specifying supported flags and JSX elements.
             * @throws {Error} If an imported flag or JSX element is not supported.
             */
            ImportSpecifier(path, state) {
                const importPath = path.parent.source.value;
                const {flags} = state.opts;
                const jsxElements = [state.opts.jsxWithFeature, state.opts.jsxWithoutFeature];

                if (isFlag(state, importPath) || isJSX(state, importPath)) {
                    const importName = path.node.imported.name;
                    const bindingName = path.node.local.name;

                    if (isFlag(state, importPath) && !(importName in flags)) {
                        throw new Error(
                            `Imported ${importName} from ${importPath} which is not a supported flag.`
                        );
                    }
                    if (isJSX(state, importPath) && !(jsxElements.includes(importName))) {
                        throw new Error(
                            `Imported ${importName} from ${importPath} which is not a supported jsx import.`
                        );
                    }
                    if (
                        isFlag(state, importPath)
                        && (typeof flags[String(importName)] === 'undefined' || flags[String(importName)] === null)
                    ) {
                        return;
                    }

                    const binding = path.scope.getBinding(bindingName);

                    binding.referencePaths.forEach(p => {
                        if (isFlag(state, importPath)) {
                            p.replaceWith(buildFlag(flags[String(importName)], importName, types));
                        }
                    });

                    path.remove();
                    path.scope.removeOwnBinding(bindingName);
                }
            },
            /**
             * Handles JSX elements based on feature flags or conditional rendering settings.
             * It manipulates JSX tree elements directly to reflect feature flag states or configured JSX elements.
             *
             * @param {object} path  The Babel path object for the JSX element.
             * @param {object} state The transformation state, including configuration for feature flags and conditional JSX.
             */
            JSXElement(path, state) {
                const elem = handleJsxElement(path, state, types);

                if (elem) {
                    path.replaceWith(elem);
                }
            }
        }
    };
};