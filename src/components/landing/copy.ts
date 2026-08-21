import type { Lang } from '@/brand';

/**
 * Every word on the public page, in both languages.
 *
 * Kept apart from the markup so the two versions can be read side by side —
 * that is the only way translations stay equivalent instead of drifting into
 * two different pitches for the same product.
 */
export interface LandingCopy {
  nav: { signIn: string; start: string };
  hero: { eyebrow: string; lead: string; primary: string; secondary: string };
  pillars: { key: string; title: string; body: string; icon: string }[];
  featuresTitle: string;
  features: { title: string; body: string; icon: string }[];
  trust: { title: string; items: { title: string; body: string; icon: string }[] };
  cta: { title: string; body: string; button: string };
  footer: { rights: string; madeFor: string };
}

const EN: LandingCopy = {
  nav: { signIn: 'Sign in', start: 'Get started' },
  hero: {
    eyebrow: 'Plan · Study · Focus · Track · Improve',
    lead: 'Plauvia keeps your textbooks, notes, flashcards and study time in one place — so the work you plan is the work that actually gets done.',
    primary: 'Get started',
    secondary: 'See what it does',
  },
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
      icon: 'barChart',
    },
    {
      key: 'improve',
      title: 'Improve',
      body: 'Spaced repetition turns one good week into a term you can rely on.',
      icon: 'brain',
    },
  ],
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
        title: 'Your own database',
        body: 'Sync runs through a database you own. Nobody else has a key to it — not even us.',
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
  cta: {
    title: 'Start with the next thing you have to study.',
    body: 'It takes a minute, and nothing has to be organised first.',
    button: 'Create your account',
  },
  footer: { rights: 'All rights reserved.', madeFor: 'Made for people who study.' },
};

const BG: LandingCopy = {
  nav: { signIn: 'Влез', start: 'Започни' },
  hero: {
    eyebrow: 'Планирай · Учи · Фокус · Следи · Подобри',
    lead: 'Plauvia държи учебниците, записките, картите и учебното време на едно място — така че планираното наистина да се случва.',
    primary: 'Започни',
    secondary: 'Виж какво прави',
  },
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
      icon: 'barChart',
    },
    {
      key: 'improve',
      title: 'Подобри',
      body: 'Интервалното повторение превръща една добра седмица в срок, на който можеш да разчиташ.',
      icon: 'brain',
    },
  ],
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
        title: 'Твоя собствена база',
        body: 'Синхронизацията минава през база, която е твоя. Никой друг няма ключ за нея — включително ние.',
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
  cta: {
    title: 'Започни със следващото, което трябва да научиш.',
    body: 'Отнема минута и нищо не е нужно да е подредено предварително.',
    button: 'Създай профил',
  },
  footer: { rights: 'Всички права запазени.', madeFor: 'Направено за хора, които учат.' },
};

export const landingCopy = (lang: Lang): LandingCopy => (lang === 'bg' ? BG : EN);
