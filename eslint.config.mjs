// ESLint 설정 (flat config, ESLint 9)
// 원칙: 실제 버그로 이어지는 규칙만 오류(error)로 두고, 모양·정리 성격의 규칙은 경고(warn)로 둔다.
// `npm run lint`는 경고도 실패로 친다(--max-warnings=0). 경고는 "고칠 것"이지 "무시해도 되는 것"이 아니다.
import js from "@eslint/js";
import globals from "globals";

// recommended 중 "버그는 아니지만 고칠 만한 것"을 경고로 내린다.
const softened = {
  "no-unused-vars": [
    "warn",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrors: "none",
      ignoreRestSiblings: true,
    },
  ],
  "no-empty": ["warn", { allowEmptyCatch: false }],
  "no-useless-escape": "warn",
  "no-prototype-builtins": "warn",
  "no-case-declarations": "warn",
  "no-fallthrough": "warn",
  "no-cond-assign": ["warn", "except-parens"],
  "no-constant-condition": "warn",
  "no-control-regex": "warn",
  "no-useless-catch": "warn",
  "no-regex-spaces": "warn",
  "no-extra-boolean-cast": "warn",
  "no-empty-pattern": "warn",
  "no-irregular-whitespace": "warn",
};

// 버그를 잡는 규칙. recommended에 들어 있어도 의도를 드러내려고 명시한다.
const bugs = {
  "no-undef": "error",
  "no-dupe-keys": "error",
  "no-dupe-args": "error",
  "no-dupe-else-if": "error",
  "no-dupe-class-members": "error",
  "no-duplicate-case": "error",
  "no-unreachable": "error",
  "no-const-assign": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-redeclare": "error",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "no-loss-of-precision": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "getter-return": "error",
  "no-setter-return": "error",
  "no-obj-calls": "error",
  "no-template-curly-in-string": "warn",
};

export default [
  {
    // 빌드 결과(deploy/), 의존성, 테스트 결과, 로컬 도구 설정(.claude/)은 검사하지 않는다.
    ignores: ["deploy/**", "node_modules/**", "test-results/**", ".claude/**"],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "warn" },
  },
  js.configs.recommended,

  // 게임: 브라우저에서 도는 ES 모듈
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: { ...softened, ...bugs },
  },

  // 빌드·측정 도구와 테스트: Node ES 모듈. 테스트는 모의 브라우저 전역(window·document)도 쓴다.
  {
    files: ["tools/**/*.mjs", "tests/**/*.js", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { ...softened, ...bugs },
  },
];
