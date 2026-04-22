import Link from "next/link";
import { CompanyForm } from "@/components/company-form";

export default function NovaEmpresaPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Painel
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Empresas monitoradas</h1>
        <p className="mt-1 text-sm font-medium text-black/70 dark:text-white/65">Cadastro na automação</p>
        <p className="mt-2 max-w-xl text-sm text-black/65 dark:text-white/60">
          Após salvar, uma execução de boas-vindas é registrada (simulada) e a estrutura de pastas aparece no detalhe
          da empresa monitorada.
        </p>
      </div>
      <CompanyForm />
    </div>
  );
}
