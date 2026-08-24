import { useEffect, useState } from 'react';
import { BRAND } from '@/brand';
import { useLangStore } from '@/i18n';
import { PublicFooter, PublicHeader, RouteLink } from '../public/PublicChrome';
import { Icon } from '../Icon';
import { landingCopy } from './copy';
import { MiniShot, ProductShot } from './ProductShot';

/**
 * The public face of Plauvia.
 *
 * A visitor who has never heard of it should know what it is before the first
 * scroll, and see the product itself rather than a stock photo of a laptop.
 * Every mockup on this page is built from the app's own components, so the
 * marketing cannot drift away from the thing it is selling — and there is not
 * one invented statistic or testimonial anywhere on it.
 */
export function Landing({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const lang = useLangStore((s) => s.lang);
  const t = landingCopy(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="scroll-thin h-full overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <PublicHeader onStart={onStart} onSignIn={onSignIn} />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <Glow />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-[820px] text-center">
            <p
              className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-medium tracking-[0.03em]"
              style={{
                background: 'color-mix(in srgb, var(--c-brand) 10%, transparent)',
                color: 'var(--c-brand)',
                border: '1px solid color-mix(in srgb, var(--c-brand) 22%, transparent)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--c-brand)' }} />
              {t.hero.eyebrow}
            </p>

            <h1
              className="animate-rise text-[clamp(38px,7vw,74px)] font-semibold leading-[1.02] tracking-[-0.04em]"
              style={{ animationDelay: '0.05s' }}
            >
              {BRAND.tagline[lang]}
            </h1>

            <p
              className="animate-rise mx-auto mt-6 max-w-[46ch] text-[16px] leading-relaxed text-muted sm:text-[17.5px]"
              style={{ animationDelay: '0.1s' }}
            >
              {t.hero.lead}
            </p>

            <div
              className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-2.5"
              style={{ animationDelay: '0.15s' }}
            >
              <button className="btn btn-primary btn-lg px-6" onClick={onStart}>
                {t.hero.primary}
                <Icon name="arrowRight" size={16} />
              </button>
              <a href="#how" className="btn btn-outline btn-lg px-5">
                {t.hero.secondary}
              </a>
            </div>

            <ul
              className="animate-rise mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-muted"
              style={{ animationDelay: '0.2s' }}
            >
              {t.hero.trust.map((line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <Icon name="check" size={13} style={{ color: 'var(--c-aurora)' }} strokeWidth={2.6} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-rise mt-14 sm:mt-18" style={{ animationDelay: '0.25s' }}>
            <ProductShot lang={lang} />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- metrics */}
      <section className="border-y border-line" style={{ background: 'var(--c-surface)' }}>
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-y-8 px-5 py-10 sm:grid-cols-4 sm:px-8">
          {t.metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <div className="t-num text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em]">
                {metric.value}
              </div>
              <div className="mt-1 text-[12px] text-muted">{metric.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.pillars.map((p, i) => (
            <article key={p.key} className="card card-hover p-5">
              <span
                className="grid h-11 w-11 place-items-center rounded-[10px]"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-brand)' }}
              >
                <Icon name={p.icon} size={20} />
              </span>
              <h3 className="mt-4 flex items-baseline gap-2 text-[16.5px] font-semibold tracking-[-0.018em]">
                {p.title}
                <span className="t-num text-[11px] font-normal text-faint">0{i + 1}</span>
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section id="how" className="border-y border-line" style={{ background: 'var(--c-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-[620px]">
            <h2 className="text-[clamp(26px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              {t.how.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.how.lead}</p>
          </div>

          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="flex items-center gap-3">
                  <span
                    className="t-num grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
                    style={{ background: 'var(--c-accent-soft)', color: 'var(--c-brand)' }}
                  >
                    {i + 1}
                  </span>
                  {i < t.how.steps.length - 1 && (
                    <span className="hidden h-px flex-1 lg:block" style={{ background: 'var(--c-line)' }} />
                  )}
                </span>
                <h3 className="mt-4 flex items-center gap-2 text-[15.5px] font-semibold tracking-[-0.015em]">
                  <Icon name={step.icon} size={16} style={{ color: 'var(--c-brand)' }} />
                  {step.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- inside */}
      {/*
        The gallery — "Inside", and the only section with that name.

        There used to be two: three prose blocks with a mockup beside each,
        and then this. Both were answering the same question with the same
        pictures, one of them at four times the length, and a visitor who
        scrolled past the first had no reason to read the second. Nine screens
        with a line each is the shorter answer, and the shorter answer is the
        one that gets read.

        Each shot is drawn from the app's own components rather than
        screenshotted, so they follow the reader's theme, stay sharp at any
        size, and cannot drift away from the product the way a folder of PNGs
        does the first time a padding changes.
      */}
      <section id="inside" className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
        <div>
          <div className="max-w-[640px]">
            <h2 className="text-[clamp(26px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              {t.screens.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.screens.lead}</p>
          </div>

          <div className="mt-12 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {t.screens.items.map((item) => (
              <figure key={item.kind}>
                {/* One height for every shot, so the captions under them read
                    as a row of labels rather than a ragged edge. */}
                <div className="flex h-[224px] items-center [&>*]:w-full">
                  <MiniShot kind={item.kind} lang={lang} />
                </div>
                <figcaption className="mt-3.5">
                  <span className="flex items-baseline gap-2 text-[14px] font-semibold tracking-[-0.012em]">
                    {item.label}
                  </span>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{item.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="border-y border-line" style={{ background: 'var(--c-surface)' }}>
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="max-w-2xl text-[clamp(24px,3.4vw,36px)] font-semibold leading-tight tracking-[-0.028em]">
            {t.featuresTitle}
          </h2>
          <div className="mt-11 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
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
      <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="text-[clamp(24px,3.4vw,36px)] font-semibold tracking-[-0.028em]">{t.trust.title}</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {t.trust.items.map((item) => (
            <article key={item.title} className="card p-5">
              <Icon name={item.icon} size={19} style={{ color: 'var(--c-aurora)' }} />
              <h3 className="mt-3 text-[14.5px] font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- faq */}
      <section id="faq" className="border-y border-line" style={{ background: 'var(--c-surface)' }}>
        <div className="mx-auto max-w-[820px] px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="text-[clamp(24px,3.4vw,36px)] font-semibold tracking-[-0.028em]">{t.faq.title}</h2>
          <div className="mt-8 divide-y" style={{ borderColor: 'var(--c-line)' }}>
            {t.faq.items.map((item) => (
              <Faq key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <RouteLink
            to="/faq"
            className="mt-7 inline-flex items-center gap-1.5 text-[13.5px] font-medium"
            /* the rest of the questions, on a page of their own */
          >
            <span style={{ color: 'var(--c-accent)' }}>
              {lang === 'bg' ? 'Всички въпроси и отговори' : 'All questions and answers'}
            </span>
            <Icon name="arrowRight" size={14} style={{ color: 'var(--c-accent)' }} />
          </RouteLink>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div
          className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[26px] px-6 py-16 text-center sm:px-12 sm:py-20"
          style={{ background: 'var(--grad-brand)', color: '#fff' }}
        >
          <span
            aria-hidden
            className="animate-breathe pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: '#fff' }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-[20ch] text-[clamp(25px,3.6vw,38px)] font-semibold leading-[1.12] tracking-[-0.03em]">
              {t.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed" style={{ opacity: 0.88 }}>
              {t.cta.body}
            </p>
            <button
              className="btn btn-lg mt-8 px-7 font-semibold"
              style={{ background: '#fff', color: 'var(--c-brand-deep)' }}
              onClick={onStart}
            >
              {t.cta.button}
              <Icon name="arrowRight" size={16} />
            </button>
            <p className="mt-4 text-[12px]" style={{ opacity: 0.78 }}>
              {t.cta.note}
            </p>
          </div>
        </div>
      </section>

      <PublicFooter onSignIn={onSignIn} />
    </div>
  );
}

/* ------------------------------------------------------------------- faq */

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-[15px] font-medium tracking-[-0.012em]">{q}</span>
        <Icon
          name="chevronDown"
          size={17}
          className="shrink-0 text-faint transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {open && <p className="animate-in pb-5 pr-8 text-[13.5px] leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

/** A soft brand-coloured wash behind the hero. Decorative only. */
function Glow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
        style={{
          background:
            'radial-gradient(58% 62% at 50% 0%, color-mix(in srgb, var(--c-brand) 20%, transparent), transparent 72%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] top-[220px] h-64 w-64 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'var(--grad-aurora)' }}
      />
    </>
  );
}
