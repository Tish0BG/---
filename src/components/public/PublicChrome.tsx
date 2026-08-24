import type { ReactNode } from 'react';
import { useState } from 'react';
import { BRAND, browserLang, type Lang } from '@/brand';
import { useLangStore } from '@/i18n';
import { useAuth } from '@/state/authStore';
import { hrefFor, useRoute } from '@/state/routeStore';
import { HOME, LANGS, PUBLIC_ROUTES, routeByPath } from '@/seo/routes';
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
 *
 * Every link in here is a real `<a href>` pointing at a real, canonical
 * address. That is not a detail: a crawler follows hrefs and ignores click
 * handlers, so a nav built out of buttons is a site with no internal links at
 * all — and a link to `/faq` written from the English page has to say
 * `/en/faq`, or half the crawl walks out of the language it came in on.
 */

/** An in-app link: keeps the SPA, but behaves like a link for middle-click and copy. */
export function RouteLink({
  to,
  lang,
  children,
  className = '',
  onClick,
  ...rest
}: {
  to: string;
  /** force a language — only the switch needs this */
  lang?: Lang;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick' | 'lang'>) {
  // Subscribed so the hrefs in the nav follow the reader from `/about` to
  // `/en/about` the moment the language changes, rather than going stale.
  const current = useLangStore((s) => s.lang);
  const href = hrefFor(to, lang ?? current);

  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        // Let the browser handle anything that is not a plain left click, so
        // "open in new tab" keeps working.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
        useRoute.getState().go(to, lang ? { lang } : undefined);
      }}
    >
      {children}
    </a>
  );
}

/** The home page's own sections, reachable from any page in either language. */
function useSectionHref(): (hash: string) => string {
  const lang = useLangStore((s) => s.lang);
  const path = useRoute((s) => s.path);
  const home = routeByPath(path)?.id === 'home';
  return (hash) => (home ? `#${hash}` : `${hrefFor('/', lang)}#${hash}`);
}

const SECTION_LINKS: { hash: string; label: Record<Lang, string> }[] = [
  { hash: 'how', label: { bg: 'Как работи', en: 'How it works' } },
  { hash: 'inside', label: { bg: 'Отвътре', en: 'Inside' } },
];

/**
 * The language switch.
 *
 * Two links, not two buttons. The English page has an address of its own, so
 * the switch is a link to it — which is what makes the translation something
 * a crawler can find, a reader can bookmark and a browser can open in a new
 * tab, instead of a preference hidden inside this device.
 */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const lang = useLangStore((s) => s.lang);
  const path = useRoute((s) => s.path);
  const label = { bg: 'Език', en: 'Language' }[lang];

  return (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
      {LANGS.map((l) => (
        <RouteLink
          key={l}
          to={path}
          lang={l}
          hrefLang={l}
          aria-current={lang === l ? 'true' : undefined}
          className="px-2.5"
        >
          {l.toUpperCase()}
        </RouteLink>
      ))}
    </div>
  );
}

/**
 * "This page is also in English."
 *
 * A visitor whose browser asks for English lands on the Bulgarian page,
 * because `/` serves Bulgarian to everybody — no sniffing, no redirect by
 * location, no page that changes underneath the address. What is left is to
 * say so, once, in a strip that can be dismissed and does not move the page
 * while it appears.
 */
function LanguageOffer() {
  const lang = useLangStore((s) => s.lang);
  const path = useRoute((s) => s.path);
  const [gone, setGone] = useState(() => localStorage.getItem('plauvia.langOffer') === 'no');
  const wanted = browserLang();

  if (gone || wanted === lang) return null;
  const dismiss = () => {
    try {
      localStorage.setItem('plauvia.langOffer', 'no');
    } catch {
      /* private mode */
    }
    setGone(true);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)]">
      <div className="card flex items-center gap-2 py-2 pl-3.5 pr-2 shadow-lg">
        <Icon name="globe" size={15} className="shrink-0 text-faint" />
        <RouteLink
          to={path}
          lang={wanted}
          hrefLang={wanted}
          onClick={dismiss}
          className="text-[13px] font-medium"
          style={{ color: 'var(--c-accent)' }}
        >
          {wanted === 'en' ? 'Read this page in English' : 'Прочети страницата на български'}
        </RouteLink>
        <button
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-faint hover:text-ink"
          aria-label={lang === 'bg' ? 'Затвори' : 'Dismiss'}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

export function PublicHeader({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const sectionHref = useSectionHref();
  // Somebody already signed in is reading the privacy policy, not shopping.
  // Offering them "Sign in" twice is the sort of detail that makes a site feel
  // like it was assembled rather than used.
  const signedIn = useAuth((s) => !!s.user);
  const faq = PUBLIC_ROUTES.find((r) => r.id === 'faq')!;
  const about = PUBLIC_ROUTES.find((r) => r.id === 'about')!;

  return (
    <>
      <a href="#content" className="skip-link">
        {lang === 'bg' ? 'Към съдържанието' : 'Skip to content'}
      </a>
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-5 sm:px-8">
          <RouteLink to={HOME} className="flex items-center gap-2.5" aria-label={BRAND.name}>
            <PlauviaTile size={30} title={BRAND.name} />
            <PlauviaWordmark size={17} />
          </RouteLink>

          <nav className="ml-8 hidden items-center gap-6 lg:flex" aria-label={lang === 'bg' ? 'Основна' : 'Main'}>
            {SECTION_LINKS.map((link) => (
              <a
                key={link.hash}
                // From a legal page the anchors have to travel home first, or
                // they scroll to nothing — and home means home *in this
                // language*, not the Bulgarian one.
                href={sectionHref(link.hash)}
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
            {/* Visible on a phone too. It used to disappear under 640px, which
                left the entire mobile site with no way to change language. */}
            <LanguageSwitch />
            {signedIn ? (
              // `/app`, not `/`: the home page is the marketing page, and
              // sending somebody who already has an account there means one
              // more redirect before they reach the thing they came for.
              <RouteLink to="/dashboard" className="btn btn-primary">
                {lang === 'bg' ? 'Отвори Plauvia' : 'Open Plauvia'}
              </RouteLink>
            ) : (
              <>
                <button className="btn hidden sm:inline-flex" onClick={onSignIn}>
                  {lang === 'bg' ? 'Влез' : 'Sign in'}
                </button>
                <button className="btn btn-primary" onClick={onStart}>
                  {lang === 'bg' ? 'Започни' : 'Get started'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <LanguageOffer />
    </>
  );
}

export function PublicFooter({ onSignIn }: { onSignIn: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const sectionHref = useSectionHref();
  const byId = (id: string) => PUBLIC_ROUTES.find((r) => r.id === id)!;
  const signedIn = useAuth((s) => !!s.user);
  const linkClass = 'inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink';

  const columns: { title: string; items: ReactNode[] }[] = [
    {
      title: lang === 'bg' ? 'Продукт' : 'Product',
      items: [
        <a key="how" href={sectionHref('how')} className={linkClass}>
          {lang === 'bg' ? 'Как работи' : 'How it works'}
        </a>,
        <a key="inside" href={sectionHref('inside')} className={linkClass}>
          {lang === 'bg' ? 'Отвътре' : 'Inside'}
        </a>,
        <RouteLink key="faq" to={byId('faq').path} className={linkClass}>
          {byId('faq').label[lang]}
        </RouteLink>,
      ],
    },
    {
      title: lang === 'bg' ? 'Компания' : 'Company',
      items: [
        <RouteLink key="about" to={byId('about').path} className={linkClass}>
          {byId('about').label[lang]}
        </RouteLink>,
        <RouteLink key="contact" to={byId('contact').path} className={linkClass}>
          {byId('contact').label[lang]}
        </RouteLink>,
      ],
    },
    {
      title: lang === 'bg' ? 'Правни' : 'Legal',
      items: (['privacy', 'terms', 'cookies'] as const).map((id) => (
        <RouteLink key={id} to={byId(id).path} className={linkClass}>
          {byId(id).label[lang]}
        </RouteLink>
      )),
    },
    {
      title: lang === 'bg' ? 'Профил' : 'Account',
      items: [
        signedIn ? (
          <RouteLink key="open" to="/dashboard" className={linkClass}>
            {lang === 'bg' ? 'Отвори Plauvia' : 'Open Plauvia'}
          </RouteLink>
        ) : (
          <button
            key="signin"
            className={`${linkClass} cursor-pointer text-left`}
            onClick={onSignIn}
          >
            {lang === 'bg' ? 'Влез' : 'Sign in'}
          </button>
        ),
      ],
    },
  ];

  return (
    <footer className="border-t border-line" style={{ background: 'var(--c-surface)' }}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-5 py-12 sm:px-8 lg:flex-row">
        <div className="min-w-0 lg:max-w-[300px] lg:flex-1">
          <RouteLink to={HOME} className="flex w-fit items-center gap-2.5" aria-label={BRAND.name}>
            <PlauviaTile size={28} title={BRAND.name} />
            <PlauviaWordmark size={16} />
          </RouteLink>
          <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted">{BRAND.description[lang]}</p>
          {/* The other language, spelled out as a link, at the bottom of every
              page — the one place a reader looks for it after scrolling. */}
          <LanguageSwitch className="mt-5 w-fit" />
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

      <main id="content" className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
        <nav aria-label={lang === 'bg' ? 'Пътека' : 'Breadcrumb'} className="mb-6 text-[12.5px] text-faint">
          <RouteLink to={HOME} className="inline-flex min-h-[24px] items-center transition-colors hover:text-ink">
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
