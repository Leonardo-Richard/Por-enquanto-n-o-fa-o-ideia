import type { Metadata } from "next";
import Link from "next/link";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { LEGAL_DOCUMENT_VERSION, publicLgpdContactLine } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: "Termos de uso · Portal de Automação de NF",
  description: "Condições gerais de utilização do portal e limitações de responsabilidade.",
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/5 px-6 py-6 dark:border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Termos de uso</h1>
          <Link
            href="/"
            className="text-sm text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            Voltar ao início
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10 text-sm leading-relaxed text-black/80 dark:text-white/75">
        <p className="text-xs text-black/50 dark:text-white/45">
          Versão dos documentos: <strong>{LEGAL_DOCUMENT_VERSION}</strong>
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">1. Aceitação</h2>
          <p>
            Ao criar conta ou utilizar o portal, declara que leu e compreendeu estes termos e a{" "}
            <Link href="/privacidade" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
              Política de privacidade
            </Link>
            . Se não concordar, não utilize o serviço.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">2. Descrição do serviço</h2>
          <p>
            O portal oferece funcionalidades de cadastro, organização e automação relacionadas com notas fiscais e
            empresas monitoradas, conforme as capacidades disponíveis em cada ambiente (incluindo componentes locais ou
            workers externos quando configurados).
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">3. Conta e segurança</h2>
          <p>
            É responsável pela veracidade dos dados fornecidos e pela confidencialidade das credenciais. Deve notificar
            de imediato qualquer uso não autorizado da sua conta através do canal de suporte do responsável pelo
            tratamento ou do operador do serviço.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">4. Uso aceitável</h2>
          <p>É proibido utilizar o portal para fins ilícitos, para violar direitos de terceiros ou para sobrecarregar o
            sistema (incluindo tentativas automatizadas abusivas). O operador pode suspender ou encerrar contas em caso
            de violação grave.</p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">5. Propriedade intelectual e licença de uso</h2>
          <p>
            O software, design e conteúdos do portal permanecem protegidos. É concedida uma licença limitada,
            revogável e não exclusiva para utilização conforme estes termos.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">6. Isenções e limitação de responsabilidade</h2>
          <p>
            O serviço pode incluir ambientes de demonstração ou protótipo. Na medida máxima permitida pela lei
            aplicável, o portal é fornecido «no estado em que se encontra», sem garantias expressas ou implícitas de
            comercialização ou adequação a um fim específico.
          </p>
          <p>
            Não nos responsabilizamos por danos indirectos, lucros cessantes ou perda de dados decorrentes de caso
            fortuito, força maior, falhas de terceiros ou mau uso da conta.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">7. Dados pessoais</h2>
          <p>
            O tratamento de dados pessoais segue a{" "}
            <Link href="/privacidade" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
              Política de privacidade
            </Link>
            . {publicLgpdContactLine()}
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">8. Lei aplicável e foro</h2>
          <p>
            Para utilizadores no Brasil, aplica-se a legislação brasileira, em especial o Código de Defesa do Consumidor
            quando for consumidor final, e a LGPD. O foro competente será o do domicílio do consumidor ou o da sede do
            fornecedor, conforme o caso e a lei aplicável.
          </p>
        </section>
      </article>

      <footer className="border-t border-black/5 px-6 py-8 dark:border-white/10">
        <div className="mx-auto max-w-3xl text-center text-xs text-black/50 dark:text-white/45">
          <LegalFooterLinks className="inline-flex flex-wrap justify-center gap-1" />
        </div>
      </footer>
    </div>
  );
}
