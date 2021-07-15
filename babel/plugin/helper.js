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
 * Checks if feature prop is valid.
 *
 * @param {String} tagName The name of the element.
 * @param {Object} props   Element props.
 * @param {Object} path    Ast Path.
 * @param {Object} state   Current babel state.
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
 * Checks if feature prop is valid.
 *
 * @param {String} tagName The name of the element.
 * @param {Object} props   Element props.
 * @param {Object} path    Ast Path.
 * @param {Object} state   Current babel state.
 */
const checkDeprecation = (tagName, props, path, state) => {
    const lineNumber = path.node.openingElement.loc.start.line;
    const columnNumber = path.node.openingElement.loc.start.column;
    const feats = props.feature.map(item => item.name);
    const prefix = 'Warning!: '.yellow;
    const file = `${state.filename}:${lineNumber}:${columnNumber}`.blue;

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
 * Generates an expression chain from an array if values.
 *
 * @param {Object} types         Object with all type constructors.
 * @param {Array}  [features=[]] Array of feature names.
 *
 * @returns {Object} Literal or LogicalExpression objects.
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