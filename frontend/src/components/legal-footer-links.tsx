import Link from "next/link";

export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Documentos legais">
      <Link href="/privacidade" className="underline-offset-2 hover:underline">
        Política de privacidade
      </Link>
      <span className="text-black/35 dark:text-white/35"> · </span>
      <Link href="/termos" className="underline-offset-2 hover:underline">
        Termos de uso
      </Link>
    </nav>
  );
}
