import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="py-10 sm:py-14">
      <header className="border-b border-border pb-8">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted">{intro}</p>
        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-text-muted">
          Effective September 7, 2026
        </p>
      </header>

      <div className="legal-copy py-8">{children}</div>

      <nav className="grid gap-px border border-border bg-border sm:grid-cols-3" aria-label="Legal and support">
        {[
          ["Privacy", "/privacy"],
          ["Terms", "/terms"],
          ["Support", "/support"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="bg-bg px-4 py-4 font-mono text-xs font-bold uppercase tracking-widest text-text-muted hover:bg-surface hover:text-accent"
          >
            {label}
          </Link>
        ))}
      </nav>
    </article>
  );
}
