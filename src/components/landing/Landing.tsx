import { useEffect, useState } from 'react';
import { BRAND, guessLang, rememberLang, type Lang } from '@/brand';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { landingCopy } from './copy';
import { ProductShot } from './ProductShot';

/**
 * The public face of Plauvia.
 *
 * A visitor who has never heard of it should know what it is before the first
 * scroll, and see the product itself rather than a stock photo of a laptop.
 * Everything below the hero exists to answer one of three questions: what
 * does it do, what is it like to use, and what happens to my work.
 */
export function Landing({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const [lang, setLang] = useState<Lang>(() => guessLang());
  const t = landingCopy(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'bg';
    };
  }, [lang]);

  const switchTo = (next: Lang) => {
    rememberLang(next);
    setLang(next);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <Header lang={lang} onLang={switchTo} t={t} onStart={onStart} onSignIn={onSignIn} />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <Glow />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-24">
          <p
            className="mb-5 inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-medium tracking-[0.04em]"
            style={{ background: 'var(--c-accent-soft)', color: 'var(--c-brand)' }}
          >
            {t.hero.eyebrow}
          </p>

          <h1 className="max-w-3xl text-[clamp(34px,6.2vw,64px)] font-semibold leading-[1.05] tracking-[-0.033em]">
            {BRAND.tagline[lang]}
          </h1>

          <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-muted sm:text-[17px]">{t.hero.lead}</p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <button className="btn btn-primary h-11 px-5 text-[14px]" onClick={onStart}>
              {t.hero.primary}
              <Icon name="chevronRight" size={16} />
            </button>
            <a href="#what" className="btn btn-outline h-11 px-5 text-[14px]">
              {t.hero.secondary}
            </a>
          </div>

          <div className="mt-14 sm:mt-20">
            <ProductShot lang={lang} />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <section id="what" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.pillars.map((p, i) => (
            <article key={p.key} className="panel panel-hover p-5">
              <span
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-brand)' }}
              >
                <Icon name={p.icon} size={19} />
              </span>
              <h3 className="mt-4 flex items-baseline gap-2 text-[16px] font-semibold tracking-[-0.015em]">
                {p.title}
                <span className="text-[11px] font-normal tabular-nums text-faint">0{i + 1}</span>
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section
        className="border-y border-line"
        style={{ background: 'var(--c-surface)' }}
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="max-w-2xl text-[clamp(24px,3.4vw,36px)] font-semibold leading-tight tracking-[-0.025em]">
            {t.featuresTitle}
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f) => (
              <article key={f.title}>
                <Icon name={f.icon} size={20} style={{ color: 'var(--c-brand)' }} />
                <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.012em]">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="text-[clamp(24px,3.4vw,36px)] font-semibold tracking-[-0.025em]">{t.trust.title}</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {t.trust.items.map((item) => (
            <article key={item.title} className="panel p-5">
              <Icon name={item.icon} size={18} style={{ color: 'var(--c-aurora)' }} />
              <h3 className="mt-3 text-[14.5px] font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20"
          style={{
            background: 'linear-gradient(140deg, var(--c-brand-lift), var(--c-brand-deep))',
            color: '#fff',
          }}
        >
          <h2 className="mx-auto max-w-xl text-[clamp(23px,3.2vw,34px)] font-semibold leading-tight tracking-[-0.025em]">
            {t.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed" style={{ opacity: 0.86 }}>
            {t.cta.body}
          </p>
          <button
            className="btn mt-7 h-11 px-6 text-[14px] font-semibold"
            style={{ background: '#fff', color: 'var(--c-brand-deep)' }}
            onClick={onStart}
          >
            {t.cta.button}
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </section>

      <Footer lang={lang} t={t} onSignIn={onSignIn} />
    </div>
  );
}

/* ---------------------------------------------------------------- header */

function Header({
  lang,
  onLang,
  t,
  onStart,
  onSignIn,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  t: ReturnType<typeof landingCopy>;
  onStart: () => void;
  onSignIn: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-line"
      style={{
        background: 'color-mix(in srgb, var(--c-bg) 82%, transparent)',
        backdropFilter: 'blur(14px) saturate(1.4)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label={BRAND.name}>
          <PlauviaTile size={30} />
          <PlauviaWordmark size={17} />
        </a>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="segmented hidden sm:flex" role="group" aria-label="Language">
            {(['bg', 'en'] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => onLang(l)} className="px-2.5">
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn h-9 px-3" onClick={onSignIn}>
            {t.nav.signIn}
          </button>
          <button className="btn btn-primary h-9 px-3.5" onClick={onStart}>
            {t.nav.start}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- footer */

function Footer({
  lang,
  t,
  onSignIn,
}: {
  lang: Lang;
  t: ReturnType<typeof landingCopy>;
  onSignIn: () => void;
}) {
  return (
    <footer className="border-t border-line" style={{ background: 'var(--c-surface)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2.5">
            <PlauviaTile size={26} />
            <PlauviaWordmark size={15} />
          </span>
          <p className="mt-2.5 text-[12.5px] text-muted">{BRAND.tagline[lang]}</p>
        </div>

        <div className="flex flex-col gap-1.5 text-[12.5px] sm:items-end">
          <button className="cursor-pointer text-muted transition-colors hover:text-ink" onClick={onSignIn}>
            {t.nav.signIn}
          </button>
          <a
            href={BRAND.url}
            className="text-muted transition-colors hover:text-ink"
            rel="noreferrer"
          >
            {BRAND.domain}
          </a>
          <span className="text-faint">
            © {new Date().getFullYear()} {BRAND.name}. {t.footer.rights}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** A soft brand-coloured wash behind the hero. Decorative only. */
function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
      style={{
        background:
          'radial-gradient(60% 70% at 15% 0%, color-mix(in srgb, var(--c-brand) 22%, transparent), transparent 70%)',
      }}
    />
  );
}
