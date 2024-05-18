/* eslint-disable no-console */
const nodePath = require('path');

// eslint-disable-next-line no-unused-vars
const colors = require('colors');

module.exports.buildFlag = (value, name, babelTypes) => {
    const replacement = babelTypes.booleanLiteral(value);
    const comment = {
        leading: false,
        trailing: true,
        type: 'CommentBlock',
        value: ` ${name} `
    };

    replacement.trailingComments = [comment];

    return replacement;
};

module.exports.handleJsxElement = (path, state, babelTypes) => {
    const {openingElement} = path.node;
    const tagName = openingElement.name.name;

    if (![state.opts.jsxWithFeature, state.opts.jsxWithoutFeature].includes(tagName)) {
        return null;
    }

    const {children} = path.node;

    const props = openingElement.attributes.map(attribute => {
        const lineNumber = path.node.openingElement.loc.start.line;
        const columnNumber = path.node.openingElement.loc.start.column;
        const file = `${state.filename}:${lineNumber}:${columnNumber}`.blue;
        let value;

        if (attribute.name.name === 'neverDeprecates') {
            return [attribute.name.name, true];
        }
        if (attribute.name.name === 'deprecatesOn') {
            if (babelTypes.isStringLiteral(attribute.value)) {
                value = attribute.value.value;
            }

            return [attribute.name.name, value];
        }
        if (attribute.name.name === 'feature') {
            if (babelTypes.isArrayExpression(attribute.value.expression)) {
                try {
                    value = attribute.value.expression.elements.map(item => ({
                        name: item.trailingComments[0].value.trim(),
                        value: item
                    }));
                } catch (e) {
                    throw new Error(
                        `${file}: ${tagName} one or more features are no flags from ${state.opts.featureFlagImport}! (If you are sure they are then consider to import the flags first.)`.red
                    );
                }
            } else {
                try {
                    value = [{
                        name: attribute.value.expression.trailingComments[0].value.trim(),
                        value: attribute.value.expression
                    }];
                } catch (e) {
                    throw new Error(
                        `${file}: ${tagName} one or more features are no flags from ${state.opts.featureFlagImport}! (If you are sure they are then consider to import the flags first.)`.red
                    );
                }
            }

            return [attribute.name.name, value];
        }

        return false;
    })
        .filter(Boolean)
        .reduce((acc, [key, value]) => {
            acc[String(key)] = value;

            return acc;
        }, {});

    checkFeatures(tagName, props, path, state);
    checkDeprecation(tagName, props, path, state);

    props.feature.forEach(item => {
        item.value.trailingComments = [];
    });

    const jsxRightHandSideFragment = babelTypes.jsxFragment(
        babelTypes.jsxOpeningFragment(),
        babelTypes.jsxClosingFragment(),
        children
    );

    if (state.opts.jsxWithoutFeature === tagName) {
        props.feature = props.feature.map(item => ({
            name: item.name,
            value: babelTypes.unaryExpression('!', item.value)
        }));
    }

    const LeftHandSideExpression = generateExpressionChain(babelTypes, props.feature);

    const jsxExpression = babelTypes.logicalExpression(
        '&&',
        LeftHandSideExpression,
        jsxRightHandSideFragment
    );

    let container;

    if (babelTypes.isReturnStatement(path.parent)) {
        container = babelTypes.returnStatement(jsxExpression);
    } else {
        container = babelTypes.jsxExpressionContainer(jsxExpression);
    }

    return container;
};

/**
 * Validates that a JSX tag includes a 'feature' prop as part of its attributes during a Babel transformation process.
 * This function checks if the 'feature' prop is defined on a given JSX element. If the prop is missing,
 * it throws an error to prevent processing of components without required feature flags,
 * ensuring that feature-dependent components are correctly flagged in the source code.
 *
 * @param {string} tagName The name of the JSX tag being checked.
 * @param {object} props   The properties of the JSX tag. This should include a 'feature' property if the component is feature-toggled.
 * @param {object} path    The Babel path object corresponding to the JSX element, used to extract line and column information for detailed error reporting.
 * @param {object} state   State object passed through by the Babel transformation process, containing contextual information like the filename.
 *
 * @example
 * // Example usage in a Babel plugin to enforce feature flagging of components
 * checkFeatures('MyComponent', element.props, path, state);
 *
 * @throws {Error} Throws an error if the 'feature' prop is undefined, indicating that the component is missing required configuration.
 */
const checkFeatures = (tagName, props, path, state) => {
    const lineNumber = path.node.openingElement.loc.start.line;
    const columnNumber = path.node.openingElement.loc.start.column;
    const file = `${state.filename}:${lineNumber}:${columnNumber}`.blue;

    if (typeof props.feature === 'undefined') {
        throw new Error(
            `${file}: ${tagName} has no feature prop!`.red
        );
    }
};

/**
 * Checks if a given JSX tag is deprecated based on its usage context and properties.
 * This function evaluates whether a tag is deprecated by checking a specific deprecation date or by inspecting active features in a live environment configuration.
 * Warnings are issued to the console if the tag is found to be deprecated.
 *
 * @param {string} tagName The name of the JSX tag being checked.
 * @param {object} props   The properties of the JSX tag, which include deprecation details and feature flags.
 * @param {object} path    The Babel path object corresponding to the JSX element.
 * @param {object} state   State object passed through by the Babel transformation process, containing file and environment details.
 *
 * @example
 * // Example usage in a Babel plugin to check deprecation of JSX elements
 * checkDeprecation('MyComponent', {
 *   deprecatesOn: '2021-01-01',
 *   feature: [{name: 'feature1'}, {name: 'feature2'}]
 * }, path, state);
 */
const checkDeprecation = (tagName, props, path, state) => {
    const lineNumber = path.node.openingElement.loc.start.line;
    const columnNumber = path.node.openingElement.loc.start.column;
    const feats = props.feature.map(item => item.name);
    const prefix = 'Warning!: '.yellow;
    const file = `${state.filename}:${lineNumber}:${columnNumber}`.blue;

    if (props.neverDeprecates) return;

    if (props.deprecatesOn) {
        if (new Date() > new Date(props.deprecatesOn)) {
            console.warn(`${prefix}${file} ${tagName.green} (with features ${feats.join(', ').green}) is deprecated since ${props.deprecatesOn.green}!`);
        }
    } else {
        // eslint-disable-next-line security/detect-non-literal-require
        const liveEnv = require(nodePath.resolve(process.cwd(), `./features.${state.opts.deprecationEnv}.js`));

        if (props.feature.some(item => (liveEnv[item.name]))) {
            console.warn(`${prefix}${file} ${tagName.green} (with features ${feats.join(', ').green}) is deprecated because its active in live features list!`);
        }
    }
};

/**
 * Generates a logical AND expression chain from an array of feature objects.
 * This function recursively constructs a nested logical expression using the `&&` operator.
 * It handles arrays of various lengths, reducing them into a single expression. If the array has one element,
 * it returns the value of that element. For two elements, it directly constructs a logical expression.
 * For more than two elements, it recursively combines them into a single expression.
 *
 * @param {typeof import("@babel/types")} types         The Babel types utility used to create AST nodes.
 * @param {Array<{ value: any }>}         [features=[]] An array of objects where each object contains a `value` property that represents a condition or expression to be combined.
 *
 * @returns {Expression} A Babel AST expression that represents the combined logical expression of the input features.
 *
 * @example
 * // Example usage within a Babel plugin:
 * const t = require("@babel/types");
 * const featureConditions = [
 *   { value: t.identifier("featureA") },
 *   { value: t.identifier("featureB") },
 *   { value: t.identifier("featureC") }
 * ];
 * const combinedExpression = generateExpressionChain(t, featureConditions);
 * // This would output an AST for: featureA && featureB && featureC
 */
const generateExpressionChain = (types, features = []) => {
    if (features.length <= 1) {
        return features[0].value;
    // eslint-disable-next-line @nfq/no-magic-numbers
    } else if (features.length === 2) {
        return types.logicalExpression('&&', features[0].value, features[1].value);
    }

    return types.logicalExpression(
        '&&',
        generateExpressionChain(types, features.splice(0, features.length - 1)),
        features[features.length - 1]
    );
};

module.exports.isFlag = (state, importPath) => (state.opts.featureFlagImport === importPath);
module.exports.isJSX = (state, importPath) => (state.opts.jsxImport === importPath);