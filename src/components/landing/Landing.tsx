import { useEffect, useState } from 'react';
import { BRAND } from '@/brand';
import { useLangStore } from '@/i18n';
import { useAuth } from '@/state/authStore';
import { PublicFooter, PublicHeader, RouteLink, SectionLink } from '../public/PublicChrome';
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
  const signedIn = useAuth((s) => !!s.user);
  const t = landingCopy(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  /**
   * Somebody opened `/homepage#inside` directly — from a middle-click, or a
   * link they were sent. The browser tried to scroll before any of this
   * existed, so it is done again once it does.
   */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const id = window.setTimeout(
      () => document.getElementById(hash)?.scrollIntoView({ block: 'start' }),
      60,
    );
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="scroll-thin h-full overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <PublicHeader onStart={onStart} onSignIn={onSignIn} />

      <main id="content">
      {/* ------------------------------------------------------------ hero */}
      {/*
        Ranged left, not centred.

        A centred hero is a poster: it asks to be admired, and it puts the
        first word of every line in a different place, so the eye has to find
        the start of each one. Ranged left gives all four elements — label,
        headline, sentence, button — one shared edge to hang off, and that
        single vertical line is most of what makes a page look composed rather
        than arranged. It also means the headline can run to two long lines
        instead of three short ones.
      */}
      <section className="relative overflow-hidden">
        <Glow />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-24">
          <div className="max-w-[860px]">
            <p
              className="animate-rise mb-6 text-[11.5px] font-medium uppercase tracking-[0.14em] text-faint"
            >
              {t.hero.eyebrow}
            </p>

            {/*
              Set at zero leading, which only works because this is Manrope.
              The two lines close up into a single block of shape — the detail
              that separates a headline that was designed from one that was
              merely made large.
            */}
            <h1
              className="animate-rise text-[clamp(38px,6.4vw,68px)] font-bold leading-[1] tracking-[-0.035em]"
              style={{ animationDelay: '0.05s', fontFamily: 'var(--font-display)' }}
            >
              {BRAND.tagline[lang]}
            </h1>

            <p
              className="animate-rise mt-6 max-w-[52ch] text-[16px] leading-[1.6] text-muted sm:text-[17.5px]"
              style={{ animationDelay: '0.1s' }}
            >
              {t.hero.lead}
            </p>

            {/* One solid button and one plain link. A second outlined button
                beside the first asks the reader to choose between two things
                that look equally important, when only one of them is. */}
            <div
              className="animate-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
              style={{ animationDelay: '0.15s' }}
            >
              {signedIn ? (
                <RouteLink to="/dashboard" className="btn btn-primary btn-lg px-6">
                  {lang === 'bg' ? 'Отвори Plauvia' : 'Open Plauvia'}
                  <Icon name="arrowRight" size={16} />
                </RouteLink>
              ) : (
                <button className="btn btn-primary btn-lg px-6" onClick={onStart}>
                  {t.hero.primary}
                  <Icon name="arrowRight" size={16} />
                </button>
              )}
              <SectionLink
                hash="how"
                className="text-[14px] font-medium underline-offset-4 hover:underline"
              >
                {t.hero.secondary}
              </SectionLink>
            </div>

            <ul
              className="animate-rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-faint"
              style={{ animationDelay: '0.2s' }}
            >
              {t.hero.trust.map((line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <Icon name="check" size={13} strokeWidth={2.6} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/*
            The product, laid back a few degrees.

            The reference page tilts its screenshot hard enough that the
            interface inside it becomes texture — which is the right call when
            the picture is only there to say "there is software here". This one
            is a working preview that navigates itself between five screens, so
            it gets six degrees instead of thirty, and it stands up the moment
            a pointer or the keyboard reaches it. Enough tilt to read as an
            object on a page; never enough to make the thing unusable.
          */}
          <div
            className="animate-rise relative mt-16 sm:mt-20"
            style={{ animationDelay: '0.25s', perspective: '2000px' }}
          >
            <div className="hero-tilt showcase">
              <ProductShot lang={lang} />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- metrics */}
      <section className="public-section-alt">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 px-5 py-9 sm:grid-cols-4 sm:px-8">
          {t.metrics.map((metric, i) => (
            <div
              key={metric.label}
              className="px-3 py-3 text-center sm:px-6"
              /* Hairlines between the cells rather than around them: four
                 numbers in four boxes is a table nobody asked for. */
              style={i > 0 ? { boxShadow: 'inset 1px 0 0 var(--c-line)' } : undefined}
            >
              <div
                className="t-num text-[clamp(28px,3.2vw,38px)] t-face leading-none tracking-[-0.035em]"
                style={{ color: 'var(--c-brand)' }}
              >
                {metric.value}
              </div>
              <div className="mx-auto mt-2.5 max-w-[16ch] text-[12.5px] leading-snug text-muted">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <section className="public-section mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {t.pillars.map((p, i) => (
            <article key={p.key} className="card card-hover p-5">
              <span className="tile tile-lg">
                <Icon name={p.icon} size={21} />
              </span>
              {/* h2, not h3: these four are the top-level claim of the page and
                  they sit directly under the h1 with nothing between. A level
                  skipped is a screen reader's outline with a hole in it. */}
              <h2 className="mt-4 flex items-baseline gap-2 text-[16.5px] font-semibold tracking-[-0.018em]">
                {p.title}
                <span className="t-num text-[11px] font-normal text-faint">0{i + 1}</span>
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section id="how" className="public-section-alt">
        <div className="public-section mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="max-w-[620px]">
            <p className="eyebrow mb-3">{lang === 'bg' ? 'Как работи' : 'How it works'}</p>
            <h2 className="text-[clamp(26px,3.6vw,40px)] t-face leading-[1.1] tracking-[-0.03em]">
              {t.how.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.how.lead}</p>
          </div>

          <ol className="mt-12 grid gap-x-7 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {t.how.steps.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="flex items-center gap-3">
                  <span
                    className="t-num grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13.5px] font-semibold text-white"
                    style={{
                      background: 'var(--grad-brand)',
                      boxShadow: '0 2px 8px -3px color-mix(in srgb, var(--c-brand) 60%, transparent)',
                    }}
                  >
                    {i + 1}
                  </span>
                  {/* The line only ever runs *between* two steps, and it stops
                      at the last one — a rule trailing off the right edge of
                      the grid is a diagram that lost its point. */}
                  {i < t.how.steps.length - 1 && (
                    <span
                      className="hidden h-px flex-1 lg:block"
                      style={{
                        background:
                          'linear-gradient(90deg, var(--c-line-strong), color-mix(in srgb, var(--c-line) 40%, transparent))',
                      }}
                    />
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
      <section id="inside" className="public-section mx-auto max-w-[1180px] px-5 sm:px-8">
        <div>
          <div className="max-w-[640px]">
            <p className="eyebrow mb-3">{lang === 'bg' ? 'Отвътре' : 'Inside'}</p>
            <h2 className="text-[clamp(26px,3.6vw,40px)] t-face leading-[1.1] tracking-[-0.03em]">
              {t.screens.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.screens.lead}</p>
          </div>

          <div className="mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {t.screens.items.map((item) => (
              <figure key={item.kind} className="group">
                {/* One height for every shot, so the captions under them read
                    as a row of labels rather than a ragged edge. Each sits in
                    a frame, because a screenshot bleeding into the page is a
                    screenshot the eye cannot find the edges of. */}
                <div
                  className="card flex h-[236px] items-center overflow-hidden p-3 transition-shadow group-hover:shadow-[var(--shadow-raised)] [&>*]:w-full"
                  style={{ background: 'var(--c-surface-2)' }}
                >
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
      <section className="public-section-alt">
        <div className="public-section mx-auto max-w-[1180px] px-5 sm:px-8">
          <p className="eyebrow mb-3">{lang === 'bg' ? 'Какво има вътре' : 'What is in it'}</p>
          <h2 className="max-w-2xl text-[clamp(24px,3.4vw,36px)] t-face leading-tight tracking-[-0.028em]">
            {t.featuresTitle}
          </h2>
          <div className="mt-11 grid gap-x-9 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f) => (
              <article key={f.title} className="flex gap-3.5">
                <span className="tile">
                  <Icon name={f.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-[-0.012em]">{f.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section className="public-section mx-auto max-w-[1180px] px-5 sm:px-8">
        <p className="eyebrow mb-3" style={{ color: 'var(--c-aurora)' }}>
          {lang === 'bg' ? 'Поверителност' : 'Privacy'}
        </p>
        <h2 className="text-[clamp(24px,3.4vw,36px)] t-face tracking-[-0.028em]">{t.trust.title}</h2>
        <div className="mt-8 grid gap-3.5 sm:grid-cols-3">
          {t.trust.items.map((item) => (
            <article key={item.title} className="card card-hover p-5">
              <span
                className="tile"
                style={{
                  background: 'color-mix(in srgb, var(--c-aurora) 12%, transparent)',
                  color: 'var(--c-aurora)',
                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--c-aurora) 16%, transparent)',
                }}
              >
                <Icon name={item.icon} size={19} />
              </span>
              <h3 className="mt-3.5 text-[14.5px] font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- faq */}
      <section id="faq" className="public-section-alt">
        <div className="public-section mx-auto max-w-[860px] px-5 sm:px-8">
          <p className="eyebrow mb-3">{lang === 'bg' ? 'Въпроси' : 'Questions'}</p>
          <h2 className="text-[clamp(24px,3.4vw,36px)] t-face tracking-[-0.028em]">{t.faq.title}</h2>
          <div className="card mt-8 divide-y overflow-hidden" style={{ borderColor: 'var(--c-line)' }}>
            {t.faq.items.map((item) => (
              <Faq key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <RouteLink to="/faq" className="link-accent mt-6">
            {lang === 'bg' ? 'Всички въпроси и отговори' : 'All questions and answers'}
            <Icon name="arrowRight" size={14} />
          </RouteLink>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="public-section px-5 sm:px-8">
        <div className="brand-panel brand-panel-grid mx-auto max-w-[1180px] rounded-[26px] px-6 py-16 text-center sm:px-12 sm:py-20">
          <span
            aria-hidden
            className="animate-breathe pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
            style={{ background: '#fff' }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-[20ch] text-[clamp(25px,3.6vw,38px)] t-face leading-[1.12] tracking-[-0.03em]">
              {t.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed" style={{ opacity: 0.88 }}>
              {t.cta.body}
            </p>
            {signedIn ? (
              <RouteLink
                to="/dashboard"
                className="btn btn-lg mt-8 px-7 font-semibold"
                style={{ background: '#fff', color: 'var(--c-brand-deep)' }}
              >
                {lang === 'bg' ? 'Отвори Plauvia' : 'Open Plauvia'}
                <Icon name="arrowRight" size={16} />
              </RouteLink>
            ) : (
              <button
                className="btn btn-lg mt-8 px-7 font-semibold"
                style={{ background: '#fff', color: 'var(--c-brand-deep)' }}
                onClick={onStart}
              >
                {t.cta.button}
                <Icon name="arrowRight" size={16} />
              </button>
            )}
            <p className="mt-4 text-[12px]" style={{ opacity: 0.78 }}>
              {signedIn
                ? lang === 'bg'
                  ? 'Вече си влязъл в профила си.'
                  : 'You are already signed in.'
                : t.cta.note}
            </p>
          </div>
        </div>
      </section>

      </main>

      <PublicFooter onSignIn={onSignIn} />
    </div>
  );
}

/* ------------------------------------------------------------------- faq */

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? 'bg-surface-2' : ''}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="text-[15px] font-medium tracking-[-0.012em]">{q}</span>
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform duration-200"
          style={{
            background: open ? 'var(--c-accent-soft)' : 'var(--c-surface-3)',
            color: open ? 'var(--c-accent)' : 'var(--c-muted)',
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        >
          <Icon name="chevronDown" size={15} />
        </span>
      </button>
      {open && <p className="animate-in px-5 pb-5 pr-12 text-[13.5px] leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

/**
 * What is behind the hero, which is now almost nothing.
 *
 * There used to be a blue radial wash and a teal blur sitting off to one
 * side. Both were doing the job an accent colour does on a page that has one;
 * on a monochrome page they read as a smudge somebody forgot to remove. The
 * ruled grid stays, because it is structure rather than decoration — it gives
 * the headline a floor to stand on — and it fades out before it reaches the
 * product shot so the two never fight.
 */
function Glow() {
  return (
    <>
      <div aria-hidden className="grid-lines pointer-events-none absolute inset-x-0 top-0 h-[620px]" />
      {/* A breath of grey at the very top, so the header does not sit on a
          hard white edge. Barely visible, and that is the intent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(70% 70% at 50% 0%, color-mix(in srgb, var(--c-text) 5%, transparent), transparent 70%)',
        }}
      />
    </>
  );
}
