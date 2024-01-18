module.exports = {
  extends: ['airbnb', 'prettier'],
  parser: "@babel/eslint-parser",
  parserOptions: {
    requireConfigFile: false,
  },
  rules: {
    'no-restricted-syntax': [
      2,
      'ForInStatement',
      'LabeledStatement',
      'WithStatement',
    ],
    'no-unused-vars': [
      'error',
      {
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    'prettier/prettier': ['error'],
  },
  plugins: ['prettier'],
};
