// https://docs.expo.dev/guides/using-eslint/
//
// Legacy (eslintrc) format, matching the installed ESLint 8 + eslint-config-expo 8.
// If ESLint is upgraded to 9, replace this with a flat `eslint.config.mjs`
// importing `eslint-config-expo/flat.js`.
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/android/*', '/ios/*', '/coverage/*', '/.expo/*'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // A stray console.log ships to every user's device. Deliberate diagnostics
    // go through warn/error/info.
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    // `T[]` for simple types, `Array<T>` for inline object literals — the
    // latter is far more readable than a trailing `[]` after a nested brace.
    '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
  },
};
