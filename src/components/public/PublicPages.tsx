import { useEffect } from 'react';
import { useLangStore } from '@/i18n';
import { LEGAL, legalIncomplete } from '@/legal';
import { applyFaqSchema } from '@/seo/head';
import { PUBLIC_ROUTES, type PublicRouteId } from '@/seo/routes';
import { BRAND } from '@/brand';
import { useRoute } from '@/state/routeStore';
import { Icon } from '../Icon';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { PublicPage, RouteLink } from './PublicChrome';
import { ABOUT, ABOUT_LEAD, CONTACT_LEAD, CONTACT_ROWS, FAQ, type Section } from './content';
import { COOKIES, COOKIES_LEAD, PRIVACY, PRIVACY_LEAD, TERMS, TERMS_LEAD } from './legal';

/**
 * The pages behind the marketing page: what Plauvia is, the questions people
 * ask, how to reach a person, and the three documents that decide whether any
 * of it can be trusted.
 */

type Props = { id: PublicRouteId; onStart: () => void; onSignIn: () => void };

export function PublicPageView({ id, onStart, onSignIn }: Props) {
  const lang = useLangStore((s) => s.lang);
  const route = PUBLIC_ROUTES.find((r) => r.id === id)!;

  // FAQ markup belongs only on the page that shows the questions; left behind
  // on another page it is exactly the kind of thing that costs a site its
  // rich results.
  useEffect(() => {
    applyFaqSchema(id === 'faq' ? FAQ.map((f) => ({ q: f.q[lang], a: f.a[lang] })) : null);
    return () => applyFaqSchema(null);
  }, [id, lang]);

  const shared = { onStart, onSignIn, title: route.label[lang] };

  if (id === 'faq') {
    return (
      <PublicPage
        {...shared}
        title={lang === 'bg' ? 'Въпроси и отговори' : 'Questions and answers'}
        lead={
          lang === 'bg'
            ? 'Ако нещо липсва тук, писмо стига до човек — адресите са на страницата за контакт.'
            : 'If something is missing here, an e-mail reaches a person — the addresses are on the contact page.'
        }
      >
        <dl className="divide-y" style={{ borderColor: 'var(--c-line)' }}>
          {FAQ.map((item) => (
            <div key={item.q.en} className="py-6 first:pt-0">
              <dt className="text-[16px] font-semibold tracking-[-0.015em]">{item.q[lang]}</dt>
              <dd className="mt-2 text-[14.5px] leading-relaxed text-muted">{item.a[lang]}</dd>
            </div>
          ))}
        </dl>
        <StartStrip onStart={onStart} />
      </PublicPage>
    );
  }

  if (id === 'contact') {
    return (
      <PublicPage {...shared} title={lang === 'bg' ? 'Контакт' : 'Contact'} lead={CONTACT_LEAD[lang]}>
        {legalIncomplete() && <PlaceholderWarning />}
        <ul className="grid gap-3">
          {CONTACT_ROWS.map((row) => (
            <li key={row.label.en} className="card p-5">
              <h2 className="text-[15px] font-semibold">{row.label[lang]}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{row.note[lang]}</p>
              <p className="t-num mt-3 text-[14px] font-medium" style={{ color: 'var(--c-accent)' }}>
                {row.value}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[13.5px] leading-relaxed text-muted">
          {lang === 'bg'
            ? 'Преди да пишеш за загубени данни: приложението пази всичко първо на устройството ти, а Настройки → Резервно копие изнася цялата библиотека в един файл.'
            : 'Before writing about lost data: the app keeps everything on your device first, and Settings → Backup exports the whole library as a single file.'}
        </p>
      </PublicPage>
    );
  }

  if (id === 'about') {
    return (
      <PublicPage {...shared} title={lang === 'bg' ? 'За Plauvia' : 'About Plauvia'} lead={ABOUT_LEAD[lang]}>
        <Prose sections={ABOUT} />
        <StartStrip onStart={onStart} />
      </PublicPage>
    );
  }

  const legal: Record<'privacy' | 'terms' | 'cookies', { lead: { bg: string; en: string }; body: Section[] }> = {
    privacy: { lead: PRIVACY_LEAD, body: PRIVACY },
    terms: { lead: TERMS_LEAD, body: TERMS },
    cookies: { lead: COOKIES_LEAD, body: COOKIES },
  };
  const doc = legal[id as 'privacy' | 'terms' | 'cookies'];

  return (
    <PublicPage
      {...shared}
      title={route.title[lang].replace(` — ${BRAND.name}`, '')}
      lead={doc.lead[lang]}
      updated={`${lang === 'bg' ? 'В сила от' : 'Effective from'} ${LEGAL.effective}`}
    >
      {legalIncomplete() && <PlaceholderWarning />}
      <Prose sections={doc.body} />
    </PublicPage>
  );
}

/* ------------------------------------------------------------------ parts */

function Prose({ sections }: { sections: Section[] }) {
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="space-y-9">
      {sections.map((section) => (
        <section key={section.h.en}>
          <h2 className="t-h2 text-[19px]">{section.h[lang]}</h2>
          {section.p?.map((para) => (
            <p key={para.en} className="mt-3 text-[14.5px] leading-[1.7] text-muted">
              {para[lang]}
            </p>
          ))}
          {section.ul && (
            <ul className="mt-4 space-y-2.5">
              {section.ul.map((item) => (
                <li key={item.en} className="flex gap-3 text-[14.5px] leading-[1.7] text-muted">
                  <span
                    aria-hidden
                    className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--c-line-strong)' }}
                  />
                  <span>{item[lang]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Says out loud that the operator's details have not been filled in yet.
 *
 * A legal page with a plausible-looking but invented address is worse than one
 * that admits it is a draft, so the draft admits it — and the banner
 * disappears on its own the moment `src/legal.ts` is completed.
 */
function PlaceholderWarning() {
  const lang = useLangStore((s) => s.lang);
  return (
    <div
      className="mb-8 flex gap-3 rounded-[var(--radius-lg)] p-4"
      style={{ background: 'var(--c-warn-soft)', border: '1px solid color-mix(in srgb, var(--c-warn) 35%, transparent)' }}
    >
      <Icon name="alert" size={17} className="mt-px shrink-0" style={{ color: 'var(--c-warn)' }} />
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--c-warn)' }}>
        {lang === 'bg'
          ? 'Чернова. Данните на оператора (име, адрес, имейли) още не са попълнени в src/legal.ts — страницата не бива да се публикува така.'
          : 'Draft. The operator details (name, address, e-mail addresses) are not filled in yet in src/legal.ts — this page should not be published as it stands.'}
      </p>
    </div>
  );
}

function StartStrip({ onStart }: { onStart: () => void }) {
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-line pt-8">
      <button className="btn btn-primary btn-lg" onClick={onStart}>
        {lang === 'bg' ? 'Започни' : 'Get started'}
        <Icon name="arrowRight" size={16} />
      </button>
      <RouteLink to="/" className="btn btn-outline btn-lg">
        {lang === 'bg' ? 'Обратно към началото' : 'Back to the home page'}
      </RouteLink>
    </div>
  );
}

/**
 * The branded 404.
 *
 * A dead end on a marketing site is usually a mistyped or an old link, so the
 * page spends its space on where to go next rather than on the number.
 */
export function NotFoundPage({ onStart }: { onStart: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const go = useRoute((s) => s.go);

  useEffect(() => {
    // A soft 404 is a page that says "not found" while telling crawlers it is
    // fine. The static host cannot send a 404 status for an SPA route, so at
    // least keep the page out of the index.
    const tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = tag?.content;
    if (tag) tag.content = 'noindex,follow';
    return () => {
      if (tag && previous) tag.content = previous;
    };
  }, []);

  return (
    <div className="grid h-full place-items-center px-5 py-12" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full max-w-[420px] text-center">
        <span className="mx-auto flex w-fit items-center gap-2.5">
          <PlauviaTile size={34} title={BRAND.name} />
          <PlauviaWordmark size={18} />
        </span>
        <p className="t-num mt-8 text-[13px] font-semibold tracking-[0.12em] text-faint">404</p>
        <h1 className="t-h1 mt-2">{lang === 'bg' ? 'Няма такава страница' : 'No page here'}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          {lang === 'bg'
            ? 'Връзката е сгрешена или страницата вече не съществува. Останалото от Plauvia си е на мястото.'
            : 'The link is wrong, or the page no longer exists. The rest of Plauvia is where you left it.'}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button className="btn btn-primary btn-lg" onClick={() => go('/')}>
            {lang === 'bg' ? 'Към началото' : 'Go to the home page'}
          </button>
          <button className="btn btn-outline btn-lg" onClick={onStart}>
            {lang === 'bg' ? 'Влез в профила си' : 'Sign in'}
          </button>
        </div>
        <p className="mt-6 text-[12.5px] text-faint">
          <RouteLink to="/faq" className="underline underline-offset-2 hover:text-muted">
            {lang === 'bg' ? 'Въпроси' : 'FAQ'}
          </RouteLink>
          {' · '}
          <RouteLink to="/contact" className="underline underline-offset-2 hover:text-muted">
            {lang === 'bg' ? 'Контакт' : 'Contact'}
          </RouteLink>
        </p>
      </div>
    </div>
  );
}
