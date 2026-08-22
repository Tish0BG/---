import type { ReactNode } from 'react';
import { BRAND, type Lang } from '@/brand';
import { useLangStore } from '@/i18n';
import { useRoute } from '@/state/routeStore';
import { PUBLIC_ROUTES } from '@/seo/routes';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';

/**
 * The frame every public page shares: the same header, the same footer, the
 * same language switch.
 *
 * The marketing page and the legal pages used to be different kinds of thing —
 * one a designed page, the others an afterthought. A visitor reading the
 * privacy policy is deciding whether to trust the product, which makes it the
 * worst possible page to look unfinished on.
 */

/** An in-app link: keeps the SPA, but behaves like a link for middle-click and copy. */
export function RouteLink({
  to,
  children,
  className = '',
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        // Let the browser handle anything that is not a plain left click, so
        // "open in new tab" keeps working.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
        useRoute.getState().go(to);
      }}
    >
      {children}
    </a>
  );
}

const SECTION_LINKS: { href: string; label: Record<Lang, string> }[] = [
  { href: '#how', label: { bg: 'Как работи', en: 'How it works' } },
  { href: '#inside', label: { bg: 'Отвътре', en: 'Inside' } },
];

export function PublicHeader({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const path = useRoute((s) => s.path);
  const home = path === '/';
  const faq = PUBLIC_ROUTES.find((r) => r.id === 'faq')!;
  const about = PUBLIC_ROUTES.find((r) => r.id === 'about')!;

  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-5 sm:px-8">
        <RouteLink to="/" className="flex items-center gap-2.5">
          <PlauviaTile size={30} title={BRAND.name} />
          <PlauviaWordmark size={17} />
        </RouteLink>

        <nav className="ml-8 hidden items-center gap-6 lg:flex" aria-label={lang === 'bg' ? 'Основна' : 'Main'}>
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              // From a legal page the anchors have to travel home first, or
              // they scroll to nothing.
              href={home ? link.href : `/${link.href}`}
              className="inline-flex min-h-[24px] items-center text-[13.5px] text-muted transition-colors hover:text-ink"
            >
              {link.label[lang]}
            </a>
          ))}
          {[faq, about].map((route) => (
            <RouteLink
              key={route.id}
              to={route.path}
              className="inline-flex min-h-[24px] items-center text-[13.5px] text-muted transition-colors hover:text-ink"
            >
              {route.label[lang]}
            </RouteLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="segmented hidden sm:flex" role="group" aria-label={lang === 'bg' ? 'Език' : 'Language'}>
            {(['bg', 'en'] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className="px-2.5">
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn" onClick={onSignIn}>
            {lang === 'bg' ? 'Влез' : 'Sign in'}
          </button>
          <button className="btn btn-primary" onClick={onStart}>
            {lang === 'bg' ? 'Започни' : 'Get started'}
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ onSignIn }: { onSignIn: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const byId = (id: string) => PUBLIC_ROUTES.find((r) => r.id === id)!;
  const home = useRoute((s) => s.path) === '/';

  const columns: { title: string; items: ReactNode[] }[] = [
    {
      title: lang === 'bg' ? 'Продукт' : 'Product',
      items: [
        <a key="how" href={home ? '#how' : '/#how'} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {lang === 'bg' ? 'Как работи' : 'How it works'}
        </a>,
        <a key="inside" href={home ? '#inside' : '/#inside'} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {lang === 'bg' ? 'Отвътре' : 'Inside'}
        </a>,
        <RouteLink key="faq" to={byId('faq').path} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {byId('faq').label[lang]}
        </RouteLink>,
      ],
    },
    {
      title: lang === 'bg' ? 'Компания' : 'Company',
      items: [
        <RouteLink key="about" to={byId('about').path} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {byId('about').label[lang]}
        </RouteLink>,
        <RouteLink key="contact" to={byId('contact').path} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {byId('contact').label[lang]}
        </RouteLink>,
      ],
    },
    {
      title: lang === 'bg' ? 'Правни' : 'Legal',
      items: (['privacy', 'terms', 'cookies'] as const).map((id) => (
        <RouteLink key={id} to={byId(id).path} className="inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink">
          {byId(id).label[lang]}
        </RouteLink>
      )),
    },
    {
      title: lang === 'bg' ? 'Профил' : 'Account',
      items: [
        <button
          key="signin"
          className="inline-flex min-h-[24px] cursor-pointer items-center text-left text-muted transition-colors hover:text-ink"
          onClick={onSignIn}
        >
          {lang === 'bg' ? 'Влез' : 'Sign in'}
        </button>,
      ],
    },
  ];

  return (
    <footer className="border-t border-line" style={{ background: 'var(--c-surface)' }}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-5 py-12 sm:px-8 lg:flex-row">
        <div className="min-w-0 lg:max-w-[300px] lg:flex-1">
          <RouteLink to="/" className="flex w-fit items-center gap-2.5">
            <PlauviaTile size={28} title={BRAND.name} />
            <PlauviaWordmark size={16} />
          </RouteLink>
          <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted">{BRAND.description[lang]}</p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-8 text-[13px] sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-1">
              <span className="t-label mb-1.5">{col.title}</span>
              {col.items}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-[1180px] px-5 py-5 text-[12px] text-faint sm:px-8">
          © {new Date().getFullYear()} {BRAND.name}. {lang === 'bg' ? 'Всички права запазени.' : 'All rights reserved.'}
        </p>
      </div>
    </footer>
  );
}

/**
 * A public page that is mostly words: the legal texts, About, Contact.
 *
 * The measure is capped at 68 characters — long-form text set the full width
 * of a 1180 px container is text nobody finishes.
 */
export function PublicPage({
  title,
  lead,
  updated,
  children,
  onStart,
  onSignIn,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children: ReactNode;
  onStart: () => void;
  onSignIn: () => void;
}) {
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="scroll-thin h-full overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <PublicHeader onStart={onStart} onSignIn={onSignIn} />

      <main className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
        <nav aria-label={lang === 'bg' ? 'Пътека' : 'Breadcrumb'} className="mb-6 text-[12.5px] text-faint">
          <RouteLink to="/" className="inline-flex min-h-[24px] items-center transition-colors hover:text-ink">
            {lang === 'bg' ? 'Начало' : 'Home'}
          </RouteLink>
          <Icon name="chevronRight" size={12} className="mx-1.5 inline align-[-1px]" />
          <span className="text-muted">{title}</span>
        </nav>

        <div className="max-w-[68ch]">
          <h1 className="t-h1 text-[clamp(28px,4vw,40px)]">{title}</h1>
          {lead && <p className="mt-4 text-[15.5px] leading-relaxed text-muted">{lead}</p>}
          {updated && <p className="mt-3 text-[12.5px] text-faint">{updated}</p>}
          <div className="mt-10">{children}</div>
        </div>
      </main>

      <PublicFooter onSignIn={onSignIn} />
    </div>
  );
}
