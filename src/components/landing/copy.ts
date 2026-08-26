import type { Lang } from '@/brand';
import type { ShotKind } from './ProductShot';

/**
 * Every word on the public page, in both languages.
 *
 * Kept apart from the markup so the two versions can be read side by side —
 * that is the only way translations stay equivalent instead of drifting into
 * two different pitches for the same product.
 */
export interface LandingCopy {
  nav: { signIn: string; start: string; links: { href: string; label: string }[] };
  hero: {
    eyebrow: string;
    lead: string;
    primary: string;
    secondary: string;
    trust: string[];
  };
  /** Facts about the product, not invented numbers about its users. */
  metrics: { value: string; label: string }[];
  pillars: { key: string; title: string; body: string; icon: string }[];
  how: { title: string; lead: string; steps: { title: string; body: string; icon: string }[] };
  /** The gallery: one picture of each screen, drawn from the app's own parts. */
  screens: {
    title: string;
    lead: string;
    items: { kind: ShotKind; label: string; body: string }[];
  };
  featuresTitle: string;
  features: { title: string; body: string; icon: string }[];
  trust: { title: string; items: { title: string; body: string; icon: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; body: string; button: string; note: string };
  footer: { rights: string; madeFor: string };
}

const EN: LandingCopy = {
  nav: {
    signIn: 'Sign in',
    start: 'Get started',
    links: [
      { href: '#how', label: 'How it works' },
      { href: '#inside', label: 'Inside' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
  hero: {
    eyebrow: 'Plan · Do · Focus · Track · Improve',
    lead: 'Plauvia holds your day and your long game on one screen — tasks, reminders, goals, documents and the hours you actually put in, so the work you plan is the work that gets done.',
    primary: 'Get started',
    secondary: 'See how it works',
    trust: ['Works offline', 'No ads, no profiling', 'Your data stays yours'],
  },
  metrics: [
    { value: '11', label: 'screens, one product' },
    { value: '0', label: 'ad networks' },
    { value: '100%', label: 'works offline' },
    { value: '2', label: 'languages' },
  ],
  pillars: [
    {
      key: 'plan',
      title: 'Plan',
      body: 'Today on one side, the long haul on the other. Drag what you will actually do into today.',
      icon: 'calendarCheck',
    },
    {
      key: 'focus',
      title: 'Focus',
      body: 'Sessions that record themselves against what you were reading. No stopwatch to remember.',
      icon: 'timer',
    },
    {
      key: 'track',
      title: 'Track',
      body: 'Hours per area, progress per document, and how your cards are holding up.',
      icon: 'chartLine',
    },
    {
      key: 'improve',
      title: 'Improve',
      body: 'Goals, streaks and spaced repetition turn one good week into a term you can rely on.',
      icon: 'target',
    },
  ],
  how: {
    title: 'Four minutes to set up. Then it keeps itself.',
    lead: 'Nothing here is typed in twice, and no number on any screen was entered by hand.',
    steps: [
      {
        title: 'Name the parts of your life',
        body: 'Work, home, training, a subject at school — everything hangs off one of them, so any screen can be narrowed to just that.',
        icon: 'layers',
      },
      {
        title: 'Fill today, and the long list',
        body: 'The plan is one screen: today on the left, everything with a longer rope beside it, your goals on the right. You drag between them.',
        icon: 'calendar',
      },
      {
        title: 'Work it however it wants to be worked',
        body: 'A tick, a checklist, a counter or a focus block — and a reminder when something has to reach you at a particular hour.',
        icon: 'bell',
      },
      {
        title: 'Watch it add up',
        body: 'Goals move on their own, streaks build, levels and achievements follow the hours — not the app opening.',
        icon: 'trophy',
      },
    ],
  },
  screens: {
    title: 'Every screen, before you sign up',
    lead: 'Nine views of the same records. No stock photography and no invented dashboards — each of these is drawn from the components the app itself is built from.',
    items: [
      {
        kind: 'tasks',
        label: 'Tasks',
        body: 'Today, overdue, upcoming and someday. Add one in a line; reschedule it without opening it.',
      },
      {
        kind: 'calendar',
        label: 'Calendar',
        body: 'Month, week, day and the timetable. Drag a deadline onto another day and it is moved.',
      },
      {
        kind: 'library',
        label: 'Library',
        body: 'PDFs and whiteboards in folders, with how far through each one you actually are.',
      },
      {
        kind: 'page',
        label: 'The page',
        body: 'Work on the document itself, with a ruler, a calculator and the periodic table docked beside it.',
      },
      {
        kind: 'cards',
        label: 'Flashcards',
        body: 'Cut a problem out of a page and it becomes a card, with spaced repetition behind it.',
      },
      {
        kind: 'focus',
        label: 'Focus',
        body: 'A full-screen session tied to the task you are on. The minutes count themselves afterwards.',
      },
      {
        kind: 'exams',
        label: 'Exams',
        body: 'A countdown and a readiness figure worked out from tasks, cards and hours actually logged.',
      },
      {
        kind: 'goals',
        label: 'Goals',
        body: 'Measured in minutes, tasks, cards or pages — and told plainly when you are behind the pace.',
      },
      {
        kind: 'stats',
        label: 'Statistics',
        body: 'Where the hours went, by day and by subject. Nothing here is typed in by hand.',
      },
    ],
  },
  featuresTitle: 'Built for the way a day actually goes',
  features: [
    {
      title: 'Four ways to finish a thing',
      body: 'A tick for the small ones, a checklist for the ones with steps, a counter for repetitions, a focus block for the deep work. The timer is an option, not the only road.',
      icon: 'checkCircle',
    },
    {
      title: 'Reminders that arrive',
      body: 'Give an entry an hour and it reaches you then — as a real notification, even when the app is behind another window. An evening check says what is still open.',
      icon: 'bell',
    },
    {
      title: 'Documents and boards, one surface',
      body: 'Open a PDF or start on blank paper. Writing, erasing, shapes and export work the same on both.',
      icon: 'book',
    },
    {
      title: 'Write like you would on paper',
      body: 'Pressure-sensitive strokes, palm rejection, shape recognition — and a ruler, set square, protractor and compass your ink snaps to.',
      icon: 'pencil',
    },
    {
      title: 'Cut a problem into a flashcard',
      body: 'Frame anything on the page and it becomes a card — question and answer, or an image with the labels hidden.',
      icon: 'scissors',
    },
    {
      title: 'The tools you reach for, beside the page',
      body: 'Calculator, periodic table, unit converter, function grapher and formula sheet — docked next to your work, not in another tab.',
      icon: 'tools',
    },
    {
      title: 'Everything hangs off one area',
      body: 'Work, home, training, a subject at school — materials, cards, tasks and hours all carry one, so "where did this month go" is one glance.',
      icon: 'layers',
    },
    {
      title: 'Works offline. Syncs when it can.',
      body: 'Everything is written to your device first. Sign in and the same library is on your phone.',
      icon: 'cloud',
    },
  ],
  trust: {
    title: 'Yours, and only yours',
    items: [
      {
        title: 'Your device holds the original',
        body: 'Everything is written to your browser first and opens with no network at all. Sync is something you switch on, not something you are signed up for.',
        icon: 'shield',
      },
      {
        title: 'No ads, no profiling',
        body: 'Nothing you do inside the app is measured, and nothing about you is sold or sent anywhere you did not ask it to go.',
        icon: 'eyeOff',
      },
      {
        title: 'Take it with you',
        body: 'One file holds the whole library — books, notes, cards and history. Export it any time.',
        icon: 'archive',
      },
    ],
  },
  faq: {
    title: 'Questions people actually ask',
    items: [
      {
        q: 'Does it work without internet?',
        a: 'Yes. Everything is written to your device first and the app opens with no network at all. Signing in only adds sync between devices.',
      },
      {
        q: 'Where is my data kept?',
        a: 'In your browser, and — if you sign in — in the database behind plauvia.com, where row-level security stops any other account from reading your rows. The privacy policy says exactly who can reach what.',
      },
      {
        q: 'Do I need a stylus?',
        a: 'No. A mouse or a finger works for everything; a stylus only makes the writing part nicer. Palm rejection is there when you have one.',
      },
      {
        q: 'What happens to the hours I log?',
        a: 'They become the statistics, the streaks, the goals and the levels. Nothing on those screens is typed in by hand — which is why they are worth reading.',
      },
      {
        q: 'Can I export everything?',
        a: 'Yes. Annotated PDFs export as PDFs, and the whole library — books, cards, tasks and history — exports as a single backup file.',
      },
    ],
  },
  cta: {
    title: 'Start with the next thing you have to do.',
    body: 'It takes a minute, and nothing has to be organised first.',
    button: 'Create your account',
    note: 'Free to start · no card · works offline',
  },
  footer: { rights: 'All rights reserved.', madeFor: 'Made for people who run their own day.' },
};

const BG: LandingCopy = {
  nav: {
    signIn: 'Влез',
    start: 'Започни',
    links: [
      { href: '#how', label: 'Как работи' },
      { href: '#inside', label: 'Отвътре' },
      { href: '#faq', label: 'Въпроси' },
    ],
  },
  hero: {
    eyebrow: 'Планирай · Върши · Фокус · Следи · Подобри',
    lead: 'Plauvia държи деня и дългия път на един екран — задачи, напомняния, цели, документи и часовете, които наистина си вложил, за да се случва планираното.',
    primary: 'Започни',
    secondary: 'Виж как работи',
    trust: ['Работи офлайн', 'Без реклами и профилиране', 'Данните остават твои'],
  },
  metrics: [
    { value: '11', label: 'екрана, един продукт' },
    { value: '0', label: 'рекламни мрежи' },
    { value: '100%', label: 'работи офлайн' },
    { value: '2', label: 'езика' },
  ],
  pillars: [
    {
      key: 'plan',
      title: 'Планирай',
      body: 'Днес от едната страна, дългият план от другата. Дърпаш в днес това, което наистина ще направиш.',
      icon: 'calendarCheck',
    },
    {
      key: 'focus',
      title: 'Фокус',
      body: 'Сесии, които се записват сами към това, което си чел. Няма хронометър за помнене.',
      icon: 'timer',
    },
    {
      key: 'track',
      title: 'Следи',
      body: 'Часове по направление, напредък по документ и как се държат картите ти.',
      icon: 'chartLine',
    },
    {
      key: 'improve',
      title: 'Подобри',
      body: 'Цели, серии и интервално повторение превръщат една добра седмица в срок, на който можеш да разчиташ.',
      icon: 'target',
    },
  ],
  how: {
    title: 'Четири минути настройка. После се води само.',
    lead: 'Нищо тук не се въвежда два пъти и никое число на никой екран не е писано на ръка.',
    steps: [
      {
        title: 'Назови частите от деня си',
        body: 'Работа, дом, тренировки, предмет в училище — всичко виси на някоя от тях, затова всеки екран се свива до точно нея.',
        icon: 'layers',
      },
      {
        title: 'Напълни днес и дългия списък',
        body: 'Планът е един екран: днес отляво, всичко с по-дълъг срок до него, целите отдясно. Дърпаш между тях с ръка.',
        icon: 'calendar',
      },
      {
        title: 'Върши го както иска да бъде свършено',
        body: 'Отметка, списък, брояч или фокус блок — и напомняне, когато нещо трябва да те намери в точен час.',
        icon: 'bell',
      },
      {
        title: 'Гледай как се трупа',
        body: 'Целите се движат сами, сериите растат, нивата и постиженията следват часовете — не отварянето на приложението.',
        icon: 'trophy',
      },
    ],
  },
  screens: {
    title: 'Всеки екран, преди да си създал профил',
    lead: 'Девет изгледа към едни и същи записи. Без стокови снимки и без измислени табла — всяко от тези е нарисувано от частите, от които е направено и самото приложение.',
    items: [
      {
        kind: 'tasks',
        label: 'Задачи',
        body: 'Днес, просрочени, предстоящи и някой ден. Добавяш на един ред; пренасрочваш, без да отваряш.',
      },
      {
        kind: 'calendar',
        label: 'Календар',
        body: 'Месец, седмица, ден и програмата. Влачиш срок върху друг ден и той е преместен.',
      },
      {
        kind: 'library',
        label: 'Библиотека',
        body: 'PDF-и и дъски в папки, заедно с това докъде наистина си стигнал във всяко.',
      },
      {
        kind: 'page',
        label: 'Страницата',
        body: 'Работиш върху самия документ — с линийка, калкулатор и периодична таблица до него.',
      },
      {
        kind: 'cards',
        label: 'Флашкарти',
        body: 'Изрязваш задача от страницата и тя става карта, с интервално повторение зад нея.',
      },
      {
        kind: 'focus',
        label: 'Фокус',
        body: 'Сесия на цял екран, вързана за задачата, по която си. Минутите после се броят сами.',
      },
      {
        kind: 'exams',
        label: 'Изпити',
        body: 'Обратно броене и готовност, сметната от задачите, картите и часовете, които наистина си направил.',
      },
      {
        kind: 'goals',
        label: 'Цели',
        body: 'В минути, задачи, карти или страници — и казано направо, когато изоставаш от темпото.',
      },
      {
        kind: 'stats',
        label: 'Статистика',
        body: 'Къде отидоха часовете, по дни и по предмети. Нищо тук не се въвежда на ръка.',
      },
    ],
  },
  featuresTitle: 'Направено за начина, по който денят наистина върви',
  features: [
    {
      title: 'Четири начина да свършиш нещо',
      body: 'Отметка за дребните, списък за многостъпковите, брояч за повторенията, фокус блок за дълбоката работа. Таймерът е опция, не единственият път.',
      icon: 'checkCircle',
    },
    {
      title: 'Напомняния, които идват',
      body: 'Дай на записа час и той те намира тогава — с истинско известие, дори когато приложението е зад друг прозорец. Вечерна проверка казва какво е останало.',
      icon: 'bell',
    },
    {
      title: 'Документи и дъски — една повърхност',
      body: 'Отваряш PDF или започваш на празна хартия. Писането, гумата, фигурите и експортът работят еднакво и на двете.',
      icon: 'book',
    },
    {
      title: 'Пишеш както на хартия',
      body: 'Линия според натиска, защита от длан, разпознаване на фигури — плюс линийка, триъгълник, транспортир и пергел, по които мастилото ляга точно.',
      icon: 'pencil',
    },
    {
      title: 'Изрязваш задача и става карта',
      body: 'Очертаваш каквото и да е на страницата и то става карта — въпрос и отговор или схема със скрити надписи.',
      icon: 'scissors',
    },
    {
      title: 'Инструментите, до самата страница',
      body: 'Калкулатор, периодична таблица, мерни единици, графика на функция и формули — залепени до работата ти, не в друг раздел.',
      icon: 'tools',
    },
    {
      title: 'Всичко виси на едно направление',
      body: 'Работа, дом, тренировки, предмет в училище — материалите, картите, задачите и часовете носят по едно, затова „къде отиде месецът“ е един поглед.',
      icon: 'layers',
    },
    {
      title: 'Работи офлайн. Синхронизира, когато може.',
      body: 'Всичко се записва първо на устройството ти. Влезеш ли в профил, същата библиотека е и на телефона.',
      icon: 'cloud',
    },
  ],
  trust: {
    title: 'Твое, и само твое',
    items: [
      {
        title: 'Оригиналът е на твоето устройство',
        body: 'Всичко се записва първо в браузъра ти и се отваря дори без мрежа. Синхронизацията е нещо, което включваш, а не нещо, в което те записват.',
        icon: 'shield',
      },
      {
        title: 'Без реклами и профилиране',
        body: 'Нищо от това, което правиш вътре в приложението, не се мери, а нищо за теб не се продава и не тръгва натам, накъдето не си го пратил.',
        icon: 'eyeOff',
      },
      {
        title: 'Носиш го със себе си',
        body: 'Един файл побира цялата библиотека — книги, записки, карти и история. Изнасяш го по всяко време.',
        icon: 'archive',
      },
    ],
  },
  faq: {
    title: 'Въпросите, които наистина се задават',
    items: [
      {
        q: 'Работи ли без интернет?',
        a: 'Да. Всичко се записва първо на устройството ти и приложението се отваря напълно без мрежа. Влизането в профил добавя само синхронизация между устройства.',
      },
      {
        q: 'Къде стоят данните ми?',
        a: 'В браузъра ти, а ако влезеш в профил — и в базата зад plauvia.com, където правилата за достъп на ниво ред не позволяват на друг профил да чете твоите редове. Политиката за поверителност казва точно кой до какво има достъп.',
      },
      {
        q: 'Трябва ли ми писалка?',
        a: 'Не. Мишка или пръст върши работа навсякъде; писалката просто прави писането по-приятно. Защитата от длан е там, ако имаш такава.',
      },
      {
        q: 'Какво става с часовете, които записвам?',
        a: 'Стават статистиката, сериите, целите и нивата. Нищо на тези екрани не се въвежда на ръка — затова си струва да се гледа.',
      },
      {
        q: 'Мога ли да си изнеса всичко?',
        a: 'Да. Учебниците с бележките излизат като PDF, а цялата библиотека — книги, карти, задачи и история — като един архивен файл.',
      },
    ],
  },
  cta: {
    title: 'Започни със следващото, което трябва да направиш.',
    body: 'Отнема минута и нищо не е нужно да е подредено предварително.',
    button: 'Създай профил',
    note: 'Безплатно за начало · без карта · работи офлайн',
  },
  footer: { rights: 'Всички права запазени.', madeFor: 'Направено за хора, които водят деня си сами.' },
};

export const landingCopy = (lang: Lang): LandingCopy => (lang === 'bg' ? BG : EN);
