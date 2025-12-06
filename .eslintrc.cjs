module.exports = {
  "env": {
    "node": true,
    "es2021": true
  },
  "globals": {
    "NodeJS": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:eslint-config-node",
    "plugin:eslint-config-prettier",
    "plugin:prettier/recommended"
  ],
  "overrides": [
    {
      "env": {
        "node": true
      },
      "files": [
        ".eslintrc.{js,cjs}"
      ],
      "parserOptions": {
        "sourceType": "script"
      }
    }
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint",
    "eslint-plugin-node",
    "eslint-plugin-prettier",
    "eslint-plugin-jsdoc"
  ],
  "rules": {
    "indent": [
      "error",
      2
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ]
  }
};
