module.exports = ignore => ({
    rules: {
        'import/no-unresolved': [
            2,
            {
                caseSensitive: true,
                commonjs: true,
                ignore
            }
        ]
    }
});