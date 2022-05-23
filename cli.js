#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const generateTypeFiles = require('./generateTypeFiles');

const definition = [
    {
        content: 'Generates types for feature flags.',
        header: 'Feature flag type generator.'
    },
    {
        header: 'Options',
        optionList: [
            {
                alias: 'f',
                description: 'The import name for feature flags configured in your babel config.',
                name: 'feature-import',
                type: String,
                typeLabel: '{underline String}'
            },
            {
                alias: 'j',
                description: `The import name for the jsx components that render feature flags. As configured in your
                babel config.`,
                name: 'jsx-import',
                type: String,
                typeLabel: '{underline String}'
            },
            {
                alias: 'i',
                description: 'The name of the with feature flag jsx component. As configured in your babel config.',
                name: 'feature-name',
                type: String,
                typeLabel: '{underline String}'
            },
            {
                alias: 'x',
                description: 'The name of the without feature flag jsx component. As configured in your babel config.',
                name: 'no-feature-name',
                type: String,
                typeLabel: '{underline String}'
            },
            {
                alias: 'e',
                description: 'The feature env to use the flags from.',
                name: 'env',
                type: String,
                typeLabel: '{underline String}'
            },
            {
                alias: 'h',
                description: 'Displays this help guide.',
                name: 'help',
                type: Boolean
            }
        ]
    }
];

const help = commandLineUsage(definition);

const options = commandLineArgs(definition[1].optionList);

if (options.help) {
    process.stdout.write(help);
} else {
    generateTypeFiles(
        options['feature-import'],
        options['jsx-import'],
        options['feature-name'],
        options['no-feature-name'],
        options.env
    );
    process.stdout.write('Done');
}