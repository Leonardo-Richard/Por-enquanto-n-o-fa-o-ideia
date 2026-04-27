import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            Portal de Automação de NF
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
            >
              Entrar
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90"
            >
              Abrir painel
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-14 sm:pt-20">
          <p className="mb-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Para contadores, financeiros e quem centraliza NF de vários CNPJs
          </p>
          <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl sm:leading-tight">
            Notas fiscais organizadas no seu computador, por empresa e por
            sistema de origem
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-black/70 dark:text-white/65">
            Cadastre cada empresa com CNPJ e um{" "}
            <strong className="font-medium text-[var(--foreground)]">
              código do sistema
            </strong>{" "}
            de onde as notas são emitidas ou consultadas. A automação baixa as
            NF e grava em pastas previsíveis — com gatilho ao concluir o
            cadastro e{" "}
            <strong className="font-medium text-[var(--foreground)]">
              no dia 1º de cada mês
            </strong>
            , sem depender só de lembrete manual.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/empresas/nova"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
            >
              Começar cadastro
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-black/15 bg-transparent px-5 text-sm font-medium transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
            >
              Como funciona
            </Link>
          </div>
          <p className="mt-4 text-xs text-black/45 dark:text-white/40">
            O cadastro e o painel ficam na área logada. Sem sessão, você será
            redirecionado para entrar.
          </p>
        </section>

        <section
          id="como-funciona"
          className="border-t border-black/5 bg-black/[0.02] py-16 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-lg font-semibold tracking-tight">
              Proposta em três pilares
            </h2>
            <ul className="mt-10 grid gap-8 sm:grid-cols-3">
              <li>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  1
                </div>
                <h3 className="font-medium">Cadastro por empresa</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/65">
                  CNPJ validado, nome fantasia opcional e o código que identifica
                  o sistema de origem das notas — configurável por você.
                </p>
              </li>
              <li>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  2
                </div>
                <h3 className="font-medium">Pastas previsíveis no disco</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/65">
                  Estrutura local por CNPJ e pelo código do sistema, para não
                  misturar empresas nem perder arquivos na Área de Trabalho.
                </p>
              </li>
              <li>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  3
                </div>
                <h3 className="font-medium">Automação nos momentos certos</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/65">
                  Primeira coleta após cadastrar a empresa e rotina mensal no dia
                  1º — alinhada ao fechamento e às obrigações recorrentes.
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section
          id="produto"
          className="mx-auto max-w-5xl px-6 py-16"
        >
          <h2 className="text-lg font-semibold tracking-tight">
            O que o produto cobre além do núcleo
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/70 dark:text-white/65">
            O site inclui painel com métricas locais, lista e detalhe de empresas
            com caminho de pasta, histórico de execuções (simulado),
            configuração de raiz e fuso, preferência de alertas por e-mail e
            fluxos de sincronização manual ou “dia 1º”. O download real no disco
            continua exigindo o agente local — a UI já reflete pastas, gatilhos e
            responsabilidades.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Autenticação com sessão persistida no navegador (demo)",
              "CRUD de empresas com validação de CNPJ",
              "Execuções com status, origem do gatilho e detalhe",
              "Configurações de pasta, timezone e notificações",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-2 rounded-lg border border-black/5 px-4 py-3 text-sm dark:border-white/10"
              >
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-black/5 bg-black/[0.02] py-16 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-lg font-semibold tracking-tight">
              Requisitos de implementação real
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/70 dark:text-white/65">
              Conta com login, cadastro de empresas vinculado ao usuário e um{" "}
              <strong className="font-medium text-[var(--foreground)]">
                componente no computador
              </strong>{" "}
              que efetivamente grava os arquivos na pasta escolhida — requisito
              para cumprir &quot;no seu disco&quot;, além do que o navegador
              sozinho permite.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 py-10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-black/50 dark:text-white/45">
          Portal de Automação de Notas Fiscais · alinhado ao project brief
        </div>
      </footer>
    </div>
  );
}
