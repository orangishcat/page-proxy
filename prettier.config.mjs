/** @type {import("prettier").Config} */
const config = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  rules: {
    curly: ["error", "multi-line"],
    "nonblock-statement-body-position": ["error", "beside"],
  },
  plugins: ["prettier-plugin-svelte"],
  overrides: [
    {
      files: "*.svelte",
      options: {
        parser: "svelte",
      },
    },
  ],
};

export default config;
