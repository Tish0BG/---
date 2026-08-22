import type { Lang } from '@/brand';

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
  showcase: {
    title: string;
    lead: string;
    blocks: { eyebrow: string; title: string; body: string; bullets: string[]; icon: string }[];
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
    eyebrow: 'Plan · Study · Focus · Track · Improve',
    lead: 'Plauvia keeps your textbooks, tasks, flashcards and study time in one place — so the work you plan is the work that actually gets done.',
    primary: 'Get started',
    secondary: 'See how it works',
    trust: ['Works offline', 'No ads, no tracking', 'An account is optional'],
  },
  metrics: [
    { value: '11', label: 'screens, one product' },
    { value: '0', label: 'ads or trackers' },
    { value: '100%', label: 'works offline' },
    { value: '2', label: 'languages' },
  ],
  pillars: [
    {
      key: 'plan',
      title: 'Plan',
      body: 'Tasks, homework and exams with real deadlines, next to the week you actually have.',
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
      body: 'Hours per subject, progress per book, and how your cards are holding up.',
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
        title: 'Name your subjects',
        body: 'Everything — materials, tasks, cards, hours — hangs off a subject, so every screen can be narrowed to just maths.',
        icon: 'layers',
      },
      {
        title: 'Put the week in',
        body: 'Deadlines, exams and your timetable. The dashboard turns it into what is burning today.',
        icon: 'calendar',
      },
      {
        title: 'Work with the timer on',
        body: 'A focus session logs itself against the subject and the book that was open. That log is what every statistic is made of.',
        icon: 'timer',
      },
      {
        title: 'Watch it add up',
        body: 'Goals move on their own, streaks build, levels and achievements follow the hours — not the app opening.',
        icon: 'trophy',
      },
    ],
  },
  showcase: {
    title: 'One workspace, from the plan to the page',
    lead: 'Every part of it reads the same records, so nothing has to be kept in sync by hand.',
    blocks: [
      {
        eyebrow: 'Dashboard & calendar',
        title: 'What matters today, before you decide anything',
        body: 'Timetable, deadlines and finished sessions in one timeline. Drag a task onto another day and it is rescheduled.',
        bullets: ['Month, week and day views', 'Overdue work is never quietly hidden', 'Exam countdowns with real readiness'],
        icon: 'dashboard',
      },
      {
        eyebrow: 'Focus & goals',
        title: 'Hours that become progress by themselves',
        body: 'Start a session and the whole screen becomes the session. When it ends, the minutes are already banked against your goals.',
        bullets: ['Pomodoro, school hour or a deep block', 'Goals measured in minutes, tasks, cards or chapters', 'Streaks, levels and achievements from real work'],
        icon: 'timer',
      },
      {
        eyebrow: 'Textbooks & flashcards',
        title: 'Solve on the page, cut the problem into a card',
        body: 'Open a PDF or start on blank paper. Frame anything on the page and it becomes a flashcard with spaced repetition behind it.',
        bullets: ['Pressure-sensitive ink, palm rejection, shape snapping', 'Ruler, protractor, set square and compass', 'Calculator and periodic table docked beside the page'],
        icon: 'book',
      },
    ],
  },
  featuresTitle: 'Built for the way studying actually goes',
  features: [
    {
      title: 'Textbooks and boards, one surface',
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
      title: 'Everything hangs off the subject',
      body: 'Materials, cards, tasks, grades and hours all carry a subject, so "how much maths did I do" is one glance.',
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
        body: 'Everything is written to your browser first and works with no account at all. Sync is something you switch on, not something you are signed up for.',
        icon: 'shield',
      },
      {
        title: 'No ads, no tracking',
        body: 'Nothing is measured, sold or sent anywhere you did not ask it to go.',
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
    title: 'Start with the next thing you have to study.',
    body: 'It takes a minute, and nothing has to be organised first.',
    button: 'Create your account',
    note: 'Free to start · no card · works offline',
  },
  footer: { rights: 'All rights reserved.', madeFor: 'Made for people who study.' },
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
    eyebrow: 'Планирай · Учи · Фокус · Следи · Подобри',
    lead: 'Plauvia държи учебниците, задачите, картите и учебното време на едно място — така че планираното наистина да се случва.',
    primary: 'Започни',
    secondary: 'Виж как работи',
    trust: ['Работи офлайн', 'Без реклами и проследяване', 'Профилът е по избор'],
  },
  metrics: [
    { value: '11', label: 'екрана, един продукт' },
    { value: '0', label: 'реклами и тракери' },
    { value: '100%', label: 'работи офлайн' },
    { value: '2', label: 'езика' },
  ],
  pillars: [
    {
      key: 'plan',
      title: 'Планирай',
      body: 'Задачи, домашни и контролни с истински срокове, до седмицата, с която реално разполагаш.',
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
      body: 'Часове по предмет, напредък по учебник и как се държат картите ти.',
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
        title: 'Назови предметите си',
        body: 'Всичко — материали, задачи, карти, часове — виси на предмет, затова всеки екран се свива до „само математика“.',
        icon: 'layers',
      },
      {
        title: 'Сложи седмицата вътре',
        body: 'Срокове, изпити и програма. Таблото превръща това в „какво гори днес“.',
        icon: 'calendar',
      },
      {
        title: 'Учи с включен таймер',
        body: 'Фокус сесията се записва сама към предмета и учебника, който е бил отворен. Този запис е материалът на цялата статистика.',
        icon: 'timer',
      },
      {
        title: 'Гледай как се трупа',
        body: 'Целите се движат сами, сериите растат, нивата и постиженията следват часовете — не отварянето на приложението.',
        icon: 'trophy',
      },
    ],
  },
  showcase: {
    title: 'Едно работно място — от плана до страницата',
    lead: 'Всяка част чете едни и същи записи, така че нищо не се поддържа синхронно на ръка.',
    blocks: [
      {
        eyebrow: 'Табло и календар',
        title: 'Кое е важното днес, преди да решиш каквото и да е',
        body: 'Програма, срокове и завършени сесии в една линия на времето. Влачиш задача върху друг ден и тя е пренасрочена.',
        bullets: ['Месец, седмица и ден', 'Просроченото никога не се крие тихо', 'Обратно броене до изпита с реална готовност'],
        icon: 'dashboard',
      },
      {
        eyebrow: 'Фокус и цели',
        title: 'Часове, които сами стават напредък',
        body: 'Пускаш сесия и целият екран става сесията. Щом свърши, минутите вече са отчетени към целите ти.',
        bullets: ['Помодоро, учебен час или дълъг блок', 'Цели в минути, задачи, карти или глави', 'Серии, нива и постижения от истинска работа'],
        icon: 'timer',
      },
      {
        eyebrow: 'Учебници и карти',
        title: 'Решаваш върху страницата, изрязваш задачата в карта',
        body: 'Отваряш PDF или започваш на празна хартия. Очертаваш каквото и да е и то става флашкарта с интервално повторение зад нея.',
        bullets: ['Мастило според натиска, защита от длан, изправяне на фигури', 'Линийка, транспортир, триъгълник и пергел', 'Калкулатор и периодична таблица до самата страница'],
        icon: 'book',
      },
    ],
  },
  featuresTitle: 'Направено за начина, по който ученето наистина върви',
  features: [
    {
      title: 'Учебници и дъски — една повърхност',
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
      title: 'Всичко виси на предмета',
      body: 'Материали, карти, задачи, оценки и часове носят предмет — затова „колко математика учих“ е един поглед.',
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
        body: 'Всичко се записва първо в браузъра ти и работи напълно без профил. Синхронизацията е нещо, което включваш, а не нещо, в което те записват.',
        icon: 'shield',
      },
      {
        title: 'Без реклами и проследяване',
        body: 'Нищо не се мери, не се продава и не тръгва натам, накъдето не си го пратил.',
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
    title: 'Започни със следващото, което трябва да научиш.',
    body: 'Отнема минута и нищо не е нужно да е подредено предварително.',
    button: 'Създай профил',
    note: 'Безплатно за начало · без карта · работи офлайн',
  },
  footer: { rights: 'Всички права запазени.', madeFor: 'Направено за хора, които учат.' },
};

export const landingCopy = (lang: Lang): LandingCopy => (lang === 'bg' ? BG : EN);
