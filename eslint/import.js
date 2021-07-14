module.exports = ignore => ({
    rules: {
        'import/no-unresolved': [
            'error',
            {
                caseSensitive: true,
                commonjs: true,
                ignore
            }
        ]
    }
});