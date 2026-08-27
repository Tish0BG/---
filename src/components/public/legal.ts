import { addressClause, LEGAL, legalValue } from '@/legal';
import type { Section } from './content';

/**
 * The privacy policy, the terms and the cookie note.
 *
 * Written against what the code actually does, not against a template: the app
 * is local-first, an account is optional, the sync copy lives in one Postgres
 * table behind row-level security, and there is no analytics script anywhere
 * in the bundle. Every claim here is one that can be checked by reading the
 * repository, which is the only kind of claim a privacy policy should make.
 *
 * These are drafts by an engineer, not advice by a lawyer. They should be read
 * by someone qualified before launch, and the placeholders in `src/legal.ts`
 * must be filled in first.
 */

const OPERATOR = legalValue(LEGAL.operator);
/** Empty when no postal address is published, so the sentence still reads. */
const AT = addressClause();
const PRIVACY_MAIL = legalValue(LEGAL.privacyEmail);
const CONTACT_MAIL = legalValue(LEGAL.contactEmail);
const REGION = legalValue(LEGAL.hostingRegion);

export const PRIVACY_LEAD = {
  bg: 'Plauvia е направена така, че да ѝ трябват възможно най-малко данни за теб. Тази страница казва кои са те, къде отиват и как да си ги вземеш обратно.',
  en: 'Plauvia is built to need as little about you as possible. This page says what that little is, where it goes, and how to get it back.',
};

export const PRIVACY: Section[] = [
  {
    h: { bg: 'Кой отговаря за данните', en: 'Who is responsible for the data' },
    p: [
      {
        bg: `Администратор на личните данни, обработвани през plauvia.com, е ${OPERATOR}${AT} — физическо лице, а не дружество. Plauvia се прави и поддържа от един човек. Пиши на ${PRIVACY_MAIL} за всичко по тази политика; това е и адресът, на който се упражняват правата по-долу.`,
        en: `The controller of personal data processed through plauvia.com is ${OPERATOR}${AT} — an individual, not a company. Plauvia is built and run by one person. Write to ${PRIVACY_MAIL} for anything about this policy; it is also the address where the rights below are exercised.`,
      },
    ],
  },
  {
    h: { bg: 'Без профил не се събира нищо', en: 'Without an account, nothing is collected' },
    p: [
      {
        bg: 'Ако използваш Plauvia без да влизаш в профил, никакви твои данни не напускат устройството ти. Учебниците, бележките, картите, задачите и часовете се пазят в браузъра (IndexedDB и localStorage) и не се изпращат никъде. Няма пиксели и няма рекламни мрежи, а вътре в приложението няма и аналитика.',
        en: 'If you use Plauvia without signing in, none of your data leaves your device. Textbooks, notes, cards, tasks and hours are kept in the browser (IndexedDB and localStorage) and are sent nowhere. There are no pixels and no ad networks, and inside the app there is no analytics either.',
      },
      {
        bg: 'Публичните страници са отделен случай и е честно да се каже. Началната страница, „За Plauvia“, въпросите и правните текстове броят посещения през Vercel Web Analytics: записват се адресът на страницата, откъде е дошло посещението, държавата и видът устройство. Няма бисквитка, няма запис в браузъра ти и нищо, което да те свърже с посещение отпреди ден. Броенето спира на вратата — щом отвориш приложението, нищо повече не се измерва.',
        en: 'The public pages are a separate case, and it is fair to say so. The home page, About, the questions and the legal texts count visits through Vercel Web Analytics: the page address, where the visit came from, the country and the kind of device are recorded. There is no cookie, nothing written to your browser, and nothing that ties you to a visit from a day ago. The counting stops at the door — once you open the app, nothing further is measured.',
      },
    ],
  },
  {
    h: { bg: 'Какво се събира с профил', en: 'What is collected with an account' },
    p: [
      {
        bg: 'Профилът съществува, за да имаш същата библиотека на второ устройство. За да работи това, се обработват:',
        en: 'An account exists so that you have the same library on a second device. To make that work, the following is processed:',
      },
    ],
    ul: [
      {
        bg: 'Имейл адрес и парола. Паролата никога не се пази в четим вид — съхранява се само необратим хеш, изчислен от системата за удостоверяване.',
        en: 'E-mail address and password. The password is never stored in readable form — only an irreversible hash, computed by the authentication system, is kept.',
      },
      {
        bg: 'Име за поздрава, ако си въвел такова, и по избор потребителско име и аватар.',
        en: 'A first name for the greeting, if you entered one, and optionally a username and an avatar.',
      },
      {
        bg: 'Съдържанието, което създаваш: качени PDF файлове, дъски, бележки върху страниците, флашкарти, предмети, задачи, изпити, оценки и записи на фокус сесии.',
        en: 'The content you create: uploaded PDF files, boards, page annotations, flashcards, subjects, tasks, exams, grades and focus-session records.',
      },
      {
        bg: 'Технически записи, необходими на хостинга и на базата — включително IP адрес и време на заявката — които се пазят за кратко и служат за сигурност и диагностика.',
        en: 'Technical records the hosting and the database need — including IP address and request time — kept briefly, for security and diagnostics.',
      },
    ],
  },
  {
    h: { bg: 'Какво нарочно не се събира', en: 'What is deliberately not collected' },
    p: [
      {
        bg: 'Няма поле за адрес, телефон, точна дата на раждане, местоположение или документ за самоличност — нито в интерфейса, нито в базата. Не се използват рекламни или аналитични бисквитки. Не се прави профилиране, не се проследява поведение между сайтове и не се взимат автоматизирани решения с правен ефект.',
        en: 'There is no field for an address, a phone number, an exact date of birth, a location or an identity document — not in the interface and not in the database. No advertising or analytics cookies are used. There is no profiling, no cross-site tracking and no automated decision-making with legal effect.',
      },
    ],
  },
  {
    h: { bg: 'На какво основание', en: 'On what legal basis' },
    ul: [
      {
        bg: 'Изпълнение на договор: поддържането на профила ти и синхронизацията на съдържанието, което си поискал да се пази в облака.',
        en: 'Performance of a contract: keeping your account and syncing the content you asked to be kept in the cloud.',
      },
      {
        bg: 'Законен интерес: сигурността на услугата — ограничаване на злоупотреби, откриване на атаки, поддържане на дневници за кратко.',
        en: 'Legitimate interest: the security of the service — limiting abuse, detecting attacks, keeping short-lived logs.',
      },
      {
        bg: 'Съгласие: изпращане на писма, които не са необходими за работата на профила. Такива не се изпращат без изрично съгласие и то може да се оттегли по всяко време.',
        en: 'Consent: e-mail that is not required for the account to work. None is sent without explicit consent, and it can be withdrawn at any time.',
      },
    ],
  },
  {
    h: { bg: 'Кой друг вижда данните', en: 'Who else sees the data' },
    p: [
      {
        bg: `Plauvia не продава и не предоставя данни на трети страни за техни цели. За да работи услугата, се използват двама обработващи: Supabase (удостоверяване, база данни и файлово хранилище, регион ${REGION}) и Vercel заедно с Cloudflare (хостинг и доставка на самия сайт).`,
        en: `Plauvia does not sell data and does not hand it to third parties for their own purposes. Two processors are used to run the service: Supabase (authentication, database and file storage, region ${REGION}) and Vercel together with Cloudflare (hosting and delivery of the site itself).`,
      },
      {
        bg: `Важно и честно казано: правилата за достъп на ниво ред (RLS) не позволяват на един профил да чете редовете на друг. Те обаче не важат за администратора на самата база. ${OPERATOR}, като собственик на проекта в Supabase, има техническата възможност да достъпи съхраненото съдържание. Този достъп се използва само когато е необходим за поддръжка или по законово задължение — но твърдение, че „никой освен теб няма достъп“, би било невярно и затова не се прави.`,
        en: `Plainly, and importantly: row-level security stops one account from reading another account's rows. It does not apply to the administrator of the database itself. ${OPERATOR}, as the owner of the Supabase project, has the technical ability to reach the stored content. That access is used only where necessary for support or where the law requires it — but a claim that "nobody but you can reach it" would be untrue, so it is not made.`,
      },
    ],
  },
  {
    h: { bg: 'Колко дълго се пази', en: 'How long it is kept' },
    p: [
      {
        bg: 'Съдържанието в профила се пази, докато профилът съществува. Изтриеш ли профила от Настройки → Профил, редовете и качените файлове се изтриват веднага и заедно с него. Копието на твоето устройство остава — то е твое и не се пипа.',
        en: 'Account content is kept for as long as the account exists. Delete the account from Settings → Account and the rows and uploaded files go with it, immediately. The copy on your device stays — it is yours and it is not touched.',
      },
    ],
  },
  {
    h: { bg: 'Твоите права', en: 'Your rights' },
    p: [
      {
        bg: 'Ако си в Европейския съюз, имаш право на достъп, поправка, изтриване, ограничаване, преносимост и възражение. Две от тях са вградени в приложението и не изискват никого да ги одобрява: пълен износ на данните от Настройки → Резервно копие и незабавно изтриване на профила от Настройки → Профил.',
        en: 'If you are in the European Union you have the right of access, rectification, erasure, restriction, portability and objection. Two of them are built into the app and need nobody’s approval: a full export from Settings → Backup, and immediate account deletion from Settings → Account.',
      },
      {
        bg: `За всичко останало пиши на ${PRIVACY_MAIL}. Имаш право и на жалба до надзорния орган по защита на данните в страната, в която живееш.`,
        en: `For anything else, write to ${PRIVACY_MAIL}. You also have the right to complain to the data-protection authority in the country where you live.`,
      },
    ],
  },
  {
    h: { bg: 'Деца', en: 'Children' },
    p: [
      {
        bg: 'Plauvia е учебен инструмент и се използва от ученици. Приложението не иска възраст и не събира данни, насочени към деца, извън изброените по-горе. Ако си под възрастта, на която можеш сам да дадеш съгласие в своята държава, използвай Plauvia със знанието на родител или настойник.',
        en: 'Plauvia is a study tool and is used by school students. The app does not ask for an age and collects no data aimed at children beyond what is listed above. If you are below the age at which you can consent on your own in your country, use Plauvia with the knowledge of a parent or guardian.',
      },
    ],
  },
  {
    h: { bg: 'Промени', en: 'Changes' },
    p: [
      {
        bg: `Тази политика важи от ${LEGAL.effective}. При съществена промяна датата се обновява и промяната се обявява в приложението, преди да влезе в сила.`,
        en: `This policy is effective from ${LEGAL.effective}. On a material change the date is updated and the change is announced in the app before it takes effect.`,
      },
    ],
  },
];

/* ------------------------------------------------------------------ terms */

export const TERMS_LEAD = {
  bg: 'Кратко и на човешки език: използвай Plauvia за учене, не я чупи нарочно, а ние ще се стараем да работи и да не ти изгуби работата.',
  en: 'Short, and in plain words: use Plauvia to study, do not deliberately break it, and the service will do its best to work and to not lose your work.',
};

export const TERMS: Section[] = [
  {
    h: { bg: 'Услугата', en: 'The service' },
    p: [
      {
        bg: `Plauvia е уеб приложение за учене, предоставяно от ${OPERATOR}${AT} — един човек, не компания. Използването му означава, че приемаш тези условия. Ако не ги приемаш, не използвай услугата.`,
        en: `Plauvia is a web application for studying, provided by ${OPERATOR}${AT} — one person, not a company. Using it means you accept these terms. If you do not accept them, do not use the service.`,
      },
      {
        bg: 'Приложението е безплатно за ползване. Ако някога бъде въведен платен план, той ще важи за нови възможности; вече използваните функции няма да бъдат заключени с обратна сила.',
        en: 'The app is free to use. If a paid plan is ever introduced it will apply to new capabilities; features already in use will not be locked behind it retroactively.',
      },
    ],
  },
  {
    h: { bg: 'Профил', en: 'Your account' },
    ul: [
      {
        bg: 'Отговаряш за паролата си и за това, което се случва през твоя профил. Ако забележиш чужд достъп, смени паролата и пиши ни.',
        en: 'You are responsible for your password and for what happens through your account. If you notice access that is not yours, change the password and write to us.',
      },
      {
        bg: 'Един човек, един профил. Създаването на профили автоматично или в големи количества не е позволено.',
        en: 'One person, one account. Creating accounts automatically or in bulk is not permitted.',
      },
      {
        bg: 'Можеш да изтриеш профила си по всяко време от самото приложение, без да питаш никого.',
        en: 'You can delete your account at any time from inside the app, without asking anyone.',
      },
    ],
  },
  {
    h: { bg: 'Твоето съдържание', en: 'Your content' },
    p: [
      {
        bg: 'Каквото качиш или създадеш, остава твое. Не се придобиват права върху него и то не се използва за нищо друго освен за да ти бъде показано и синхронизирано между устройствата ти.',
        en: 'Whatever you upload or create stays yours. No rights over it are acquired and it is used for nothing except showing it to you and syncing it between your devices.',
      },
      {
        bg: 'Ти отговаряш за това, че имаш право да качиш файловете, които качваш. Учебник, който нямаш право да разпространяваш, не бива да се споделя през услугата.',
        en: 'You are responsible for having the right to upload the files you upload. A textbook you are not allowed to distribute must not be shared through the service.',
      },
    ],
  },
  {
    h: { bg: 'Какво не е позволено', en: 'What is not allowed' },
    ul: [
      {
        bg: 'Опити за достъп до чужди данни, заобикаляне на удостоверяването или на правилата за достъп.',
        en: "Attempts to reach another person's data, or to bypass authentication or the access rules.",
      },
      {
        bg: 'Автоматизирано извличане, натоварване на услугата или изпращане на заявки в количества, които вредят на другите потребители.',
        en: 'Automated scraping, load testing, or sending requests in volumes that harm other users.',
      },
      {
        bg: 'Качване на зловреден софтуер или на съдържание, което е незаконно.',
        en: 'Uploading malicious software, or content that is unlawful.',
      },
    ],
  },
  {
    h: { bg: 'Наличност и отговорност', en: 'Availability and liability' },
    p: [
      {
        bg: 'Услугата се предоставя „както е“. Не се обещава непрекъсната работа: хостингът може да прекъсне, а сървърът, който пази копието ти, може да е недостъпен. Точно затова Plauvia е направена да работи офлайн и да пази всичко първо при теб — и точно затова редовното резервно копие от Настройки → Резервно копие си остава твоя най-добра защита.',
        en: 'The service is provided "as is". Uninterrupted operation is not promised: hosting can fail, and the server holding your copy can be unreachable. That is exactly why Plauvia is built to work offline and to keep everything on your side first — and exactly why a regular backup from Settings → Backup remains your best protection.',
      },
      {
        bg: 'В рамките на позволеното от закона не се носи отговорност за косвени вреди или за загуба на данни, освен когато е причинена умишлено или при груба небрежност.',
        en: 'To the extent the law allows, there is no liability for indirect damage or for loss of data, except where caused deliberately or through gross negligence.',
      },
    ],
  },
  {
    h: { bg: 'Прекратяване', en: 'Ending it' },
    p: [
      {
        bg: 'Можеш да спреш по всяко време, като изтриеш профила си. Профил може да бъде спрян и от наша страна при нарушение на горните правила — по възможност след предупреждение и винаги с възможност да си изнесеш данните.',
        en: 'You can stop at any time by deleting your account. An account may also be suspended from our side if the rules above are broken — where possible after a warning, and always with the chance to export your data.',
      },
    ],
  },
  {
    h: { bg: 'Право и промени', en: 'Law and changes' },
    p: [
      {
        bg: `Прилага се българското право, доколкото това не отнема защитата, която ти дава законът на държавата, в която живееш. Условията важат от ${LEGAL.effective}; при съществена промяна ще бъдеш уведомен в приложението. Въпроси: ${CONTACT_MAIL}.`,
        en: `Bulgarian law applies, to the extent that this does not remove the protection given to you by the law of the country where you live. These terms are effective from ${LEGAL.effective}; on a material change you will be told inside the app. Questions: ${CONTACT_MAIL}.`,
      },
    ],
  },
];

/* ---------------------------------------------------------------- cookies */

export const COOKIES_LEAD = {
  bg: 'Plauvia не поставя рекламни или аналитични бисквитки, затова и няма банер, който да те моли за съгласие. Това, което все пак се пази в браузъра ти, е изброено тук.',
  en: 'Plauvia sets no advertising or analytics cookies, which is why there is no banner asking for your consent. What is nonetheless kept in your browser is listed here.',
};

export const COOKIES: Section[] = [
  {
    h: { bg: 'Няма бисквитки за проследяване', en: 'No tracking cookies' },
    p: [
      {
        bg: 'Няма Google Analytics, няма рекламни пиксели и няма скрипт, който да те следва от сайт на сайт. Публичните страници броят посещенията си през Vercel Web Analytics, но без бисквитка и без нищо записано в браузъра ти — затова и няма банер, който да иска съгласие: съгласие се иска за неща, които оставят следа на устройството ти, а такива тук няма.',
        en: 'There is no Google Analytics, no advertising pixel and no script that follows you from site to site. The public pages count their visits through Vercel Web Analytics, but with no cookie and nothing written to your browser — which is why there is no banner asking for consent: consent is for things that leave a trace on your device, and there are none here.',
      },
    ],
  },
  {
    h: { bg: 'Какво се пази и защо', en: 'What is stored, and why' },
    ul: [
      {
        bg: 'IndexedDB — цялата ти библиотека: учебници, дъски, бележки, карти, задачи и история. Това е самото приложение, не проследяване.',
        en: 'IndexedDB — your whole library: textbooks, boards, notes, cards, tasks and history. This is the application itself, not tracking.',
      },
      {
        bg: 'localStorage — настройките ти (тема, акцент, език, размер на текста), последно отвореният документ и, ако си влязъл, знакът за сесията от системата за удостоверяване.',
        en: 'localStorage — your preferences (theme, accent, language, text size), the last document you had open and, if you are signed in, the session token from the authentication system.',
      },
      {
        bg: 'Cache Storage — копие на самото приложение, за да се отваря офлайн.',
        en: 'Cache Storage — a copy of the application itself, so that it opens offline.',
      },
    ],
  },
  {
    h: { bg: 'Как да ги изчистиш', en: 'How to clear them' },
    p: [
      {
        bg: 'Изчистването на данните на сайта от настройките на браузъра премахва всичко изброено — включително библиотеката ти. Направи резервно копие от Настройки → Резервно копие преди това, ако държиш на нея.',
        en: 'Clearing site data from your browser settings removes everything listed — including your library. Take a backup from Settings → Backup first if you want to keep it.',
      },
    ],
  },
];
