import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
);
