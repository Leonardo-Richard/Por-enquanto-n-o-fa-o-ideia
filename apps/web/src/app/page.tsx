export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/5 dark:border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            Portal de Automação de NF
          </span>
          <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-black/60 dark:bg-white/[0.08] dark:text-white/60">
            MVP em construção
          </span>
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
            <a
              href="#como-funciona"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
            >
              Como funciona
            </a>
            <a
              href="#mvp"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-black/15 bg-transparent px-5 text-sm font-medium transition-colors hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
            >
              Escopo do MVP
            </a>
          </div>
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

        <section id="mvp" className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-lg font-semibold tracking-tight">
            O que o MVP precisa entregar
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/70 dark:text-white/65">
            Conta com login, cadastro de empresas vinculado ao usuário e um{" "}
            <strong className="font-medium text-[var(--foreground)]">
              componente no computador
            </strong>{" "}
            que efetivamente grava os arquivos na pasta escolhida — requisito
            para cumprir &quot;no seu disco&quot;, além do que o navegador sozinho
            permite.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-black/80 dark:text-white/75">
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              Autenticação e empresas por conta
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              Pastas: raiz local configurável + CNPJ + segmentação por código do
              sistema
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              Jobs ao cadastrar e agendados para o dia 1º de cada mês
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-black/5 py-10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-black/50 dark:text-white/45">
          Portal de Automação de Notas Fiscais · documento de visão alinhado ao
          project brief interno
        </div>
      </footer>
    </div>
  );
}
