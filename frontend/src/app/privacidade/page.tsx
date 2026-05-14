import type { Metadata } from "next";
import Link from "next/link";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { LEGAL_DOCUMENT_VERSION, publicLgpdContactLine } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: "Política de privacidade · Portal de Automação de NF",
  description:
    "Informações sobre tratamento de dados pessoais, bases legais e direitos dos titulares (LGPD).",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/5 px-6 py-6 dark:border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Política de privacidade</h1>
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
          <h2 className="text-base font-semibold text-[var(--foreground)]">1. Quem somos</h2>
          <p>
            O <strong>Portal de Automação de NF</strong> é um serviço digital orientado a organizar e automatizar
            fluxos relacionados com notas fiscais e cadastros de empresas. O responsável pelo tratamento dos seus
            dados pessoais é a entidade que lhe concedeu acesso ao portal (por exemplo, o seu empregador ou o
            prestador de serviços contratado), salvo indicação em contrato ou nos termos comerciais aplicáveis.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">2. Que dados tratamos</h2>
          <p>Em regra, tratamos categorias como:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Identificação e contacto</strong> (nome, e-mail) para autenticação, gestão de conta e
              comunicações operacionais;
            </li>
            <li>
              <strong>Dados de organização e empresas monitoradas</strong> (ex.: CNPJ, denominações, configurações
              técnicas) necessários às funcionalidades do produto;
            </li>
            <li>
              <strong>Dados técnicos</strong> (sessão segura, registos de auditoria quando activos, endereço IP ou
              agente de utilizador em conformidade com a configuração do sistema) para segurança e prevenção de abuso.
            </li>
          </ul>
          <p>
            O tratamento de <strong>credenciais sensíveis</strong> (ex.: certificados ou segredos de integração) deve
            seguir políticas internas de cofre e minimização; esta política não substitui requisitos contratuais ou
            normativos específicos do seu sector.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">3. Finalidades e bases legais (LGPD)</h2>
          <p>Tratamos dados pessoais para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Execução de contrato ou procedimentos precontratuais</strong> (art. 7º, V) — prestação do
              serviço solicitado, gestão de conta e organizações;
            </li>
            <li>
              <strong>Legítimo interesse</strong> (art. 7º, IX), observado o equilíbrio com os seus direitos — segurança
              da informação, prevenção de fraude, melhoria técnica e suporte;
            </li>
            <li>
              <strong>Cumprimento de obrigação legal ou regulamentar</strong> (art. 7º, II), quando aplicável ao
              responsável pelo tratamento.
            </li>
          </ul>
          <p>
            Quando depender de <strong>consentimento</strong> (art. 7º, I), este será solicitado de forma destacada,
            podendo ser revogado sem prejuízo da licitude do tratamento anterior.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">4. Partilha de dados e encarregados</h2>
          <p>
            Podemos recorrer a <strong>subencarregados</strong> (fornecedores de alojamento, base de dados, e-mail,
            monitorização) estritamente necessários à operação do serviço, com cláusulas contratuais de protecção de
            dados. Não vendemos listas de contactos.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">5. Conservação</h2>
          <p>
            Conservamos dados pelo tempo necessário às finalidades descritas e às obrigações legais aplicáveis ao
            responsável pelo tratamento. Critérios exactos (prazos por tipo de dado) devem constar da documentação
            interna do responsável e podem ser solicitados via canal de contacto abaixo.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">6. Os seus direitos (art. 18º da LGPD)</h2>
          <p>Nos termos da lei, pode solicitar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>confirmação da existência de tratamento, acesso e correção de dados incompletos ou desactualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>portabilidade dos dados a outro fornecedor de serviço, quando aplicável;</li>
            <li>informação sobre entidades públicas ou privadas com as quais partilhamos dados;</li>
            <li>revogação do consentimento e informação sobre a possibilidade de não fornecer consentimento.</li>
          </ul>
          <p>{publicLgpdContactLine()}</p>
          <p className="text-xs text-black/55 dark:text-white/50">
            Pode ainda apresentar reclamação à Autoridade Nacional de Protecção de Dados (ANPD), nos termos da lei.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">7. Segurança</h2>
          <p>
            A autenticação utiliza mecanismos como sessão em <strong>cookie HttpOnly</strong> e boas práticas de
            armazenamento de credenciais. Deve proteger a sua senha e dispositivos; em ambiente partilhado, termine
            sempre a sessão.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">8. Actualizações</h2>
          <p>
            Esta política pode ser actualizada. A versão em vigor indica-se no topo desta página; em caso de mudança
            relevante, procuraremos informá-lo por meios adequados (por exemplo, aviso no portal ou e-mail).
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
