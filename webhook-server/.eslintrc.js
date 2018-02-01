module.exports = {
    "globals": {
        "log": true,
        "describe": true,
        "it": true,
        "beforeEach": true,
        "afterEach": true,
    },
    "env": {
        "es6": true,
        "node": true
    },
    "parserOptions": {
        "ecmaVersion": 8,
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "never"
        ],
        "prefer-const": ["error", {
            "destructuring": "any",
            "ignoreReadBeforeAssign": false
        }],
        "comma-dangle": ["error", "always-multiline"],
        "strict": ["error", "global"],
        "no-console": ["error",  { allow: ["dir", "error", "log"]}],
        "no-constant-condition": ["error", { "checkLoops": false }],
        "no-unused-vars": ["error", { "args": "none" }],
    }
};