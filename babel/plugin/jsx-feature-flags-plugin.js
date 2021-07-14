const {buildFlag, handleJsxElement, isFlag, isJSX} = require('./helper');

module.exports = babel => {
    const {types} = babel;

    return {
        name: 'jsx-feature-flags-plugin',
        visitor: {
            ImportDeclaration: {
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
            JSXElement(path, state) {
                const elem = handleJsxElement(path, state, types);

                if (elem) {
                    path.replaceWith(elem);
                }
            }
        }
    };
};