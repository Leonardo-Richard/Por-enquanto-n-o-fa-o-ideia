import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const noDbLayer = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@repo/db",
          message:
            "Camada de dados apenas no servidor (FR4/FR5): use rotas em app/api ou lib/db.ts no servidor.",
        },
        {
          name: "@/lib/db",
          message:
            "getDb apenas em rotas API e código servidor (FR4/FR5). A UI deve consumir /api/v1/...",
        },
      ],
    },
  ],
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: noDbLayer,
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: noDbLayer,
  },
];

export default eslintConfig;
