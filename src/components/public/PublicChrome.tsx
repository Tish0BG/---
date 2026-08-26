import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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

const SECTION_LINKS: { hash: string; label: Record<Lang, string> }[] = [
  { hash: 'how', label: { bg: 'Как работи', en: 'How it works' } },
  { hash: 'inside', label: { bg: 'Отвътре', en: 'Inside' } },
];

/**
 * Waits for a section to exist, then puts it under the header — and checks
 * that it stayed there.
 *
 * Two separate problems, which is why this is longer than one line. Coming
 * from another page the home page's chunk is still being fetched, so the
 * element genuinely is not there yet and has to be waited for. And once it is
 * there the page is still mounting underneath it — the product mockups settle
 * into their final heights a few frames later — so a scroll that lands
 * correctly can be several hundred pixels off by the time anyone sees it. So
 * it scrolls, then confirms, a bounded number of times.
 */
function scrollToSection(hash: string, smooth: boolean, left = 60): void {
  const el = document.getElementById(hash);
  if (!el) {
    if (left > 0) window.setTimeout(() => scrollToSection(hash, smooth, left - 1), 50);
    return;
  }

  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });

  let checks = 0;
  const settle = () => {
    const { top } = el.getBoundingClientRect();
    // `scroll-margin-top` puts it just under the sticky header; anywhere in
    // that band means it arrived.
    if ((top >= 0 && top <= 130) || checks >= 6) return;
    checks += 1;
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
    window.setTimeout(settle, 160);
  };
  window.setTimeout(settle, 320);
}

/**
 * A link to a section of the home page — "How it works", "Inside".
 *
 * These are parts of one page, not pages: they are not in the sitemap and are
 * not meant to be indexed on their own. So a click scrolls to them and leaves
 * the address alone. It used to append `#inside`, which was untidy on the home
 * page and actively wrong once you walked on from there — the fragment
 * followed you, and the About page ended up announcing itself as
 * `/about#inside`, a section it does not have.
 *
 * The `href` is still the real anchor, because that is what a middle-click,
 * a "copy link address" and a crawler all read.
 */
export function SectionLink({
  hash,
  className,
  children,
}: {
  hash: string;
  className?: string;
  children: ReactNode;
}) {
  const lang = useLangStore((s) => s.lang);
  const path = useRoute((s) => s.path);
  const home = routeByPath(path)?.id === 'home';
  const href = home ? `#${hash}` : `${hrefFor(HOME, lang)}#${hash}`;

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        // Already here: animate. Arriving from another page: land on it, and
        // let the page draw itself around a section that is already in place.
        if (!home) useRoute.getState().go(HOME);
        scrollToSection(hash, home);
      }}
    >
      {children}
    </a>
  );
}

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
  // Somebody already signed in is reading the privacy policy, not shopping.
  // Offering them "Sign in" twice is the sort of detail that makes a site feel
  // like it was assembled rather than used.
  const signedIn = useAuth((s) => !!s.user);
  const faq = PUBLIC_ROUTES.find((r) => r.id === 'faq')!;
  const about = PUBLIC_ROUTES.find((r) => r.id === 'about')!;

  /**
   * The rule under the header appears once the page has moved.
   *
   * At the top of a hero, a bar with a line under it cuts the page in two
   * before the visitor has read a word; the moment content starts sliding
   * beneath it, the same line is what stops the two from mixing. Listening in
   * the capture phase because the public pages scroll inside a container of
   * their own rather than on the window.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement | Document;
      const top = target instanceof HTMLElement ? target.scrollTop : window.scrollY;
      setScrolled(top > 8);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  return (
    <>
      <a href="#content" className="skip-link">
        {lang === 'bg' ? 'Към съдържанието' : 'Skip to content'}
      </a>
      <header
        className={`sticky top-0 z-30 border-b transition-[background-color,border-color,backdrop-filter] duration-200 ${
          scrolled ? 'glass border-line' : 'border-transparent'
        }`}
      >
        <div className="relative mx-auto flex h-[68px] max-w-[1180px] items-center gap-3 px-5 sm:px-8">
          <RouteLink to={HOME} className="flex items-center gap-2.5" aria-label={BRAND.name}>
            <PlauviaTile size={30} title={BRAND.name} />
            <PlauviaWordmark size={17} />
          </RouteLink>

          {/* Centred, not left-shunted against the mark.
              With the logo at one edge and the account controls at the other,
              a nav that starts immediately after the wordmark leaves a wide
              empty stretch in the middle of the bar. Absolute centring puts
              the links on the page's optical axis and keeps them there
              regardless of how long the wordmark or the buttons get. */}
          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex"
            aria-label={lang === 'bg' ? 'Основна' : 'Main'}
          >
            {SECTION_LINKS.map((link) => (
              <SectionLink
                key={link.hash}
                hash={link.hash}
                className="inline-flex min-h-[24px] items-center text-[13.5px] text-muted transition-colors hover:text-ink"
              >
                {link.label[lang]}
              </SectionLink>
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
  const byId = (id: string) => PUBLIC_ROUTES.find((r) => r.id === id)!;
  const signedIn = useAuth((s) => !!s.user);
  const linkClass = 'inline-flex min-h-[24px] items-center text-muted transition-colors hover:text-ink';

  const columns: { title: string; items: ReactNode[] }[] = [
    {
      title: lang === 'bg' ? 'Продукт' : 'Product',
      items: [
        <SectionLink key="how" hash="how" className={linkClass}>
          {lang === 'bg' ? 'Как работи' : 'How it works'}
        </SectionLink>,
        <SectionLink key="inside" hash="inside" className={linkClass}>
          {lang === 'bg' ? 'Отвътре' : 'Inside'}
        </SectionLink>,
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
