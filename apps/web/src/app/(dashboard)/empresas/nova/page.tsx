import Link from "next/link";
import { CompanyForm } from "@/components/company-form";

export default function NovaEmpresaPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/empresas"
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Empresas
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Nova empresa
        </h1>
        <p className="mt-2 max-w-xl text-sm text-black/65 dark:text-white/60">
          Após salvar, uma execução de boas-vindas é registrada (simulada) e a
          estrutura de pastas aparece no detalhe da empresa.
        </p>
      </div>
      <CompanyForm />
    </div>
  );
}
