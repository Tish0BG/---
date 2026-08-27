import { LEGAL, legalValue } from '@/legal';
import type { Lang } from '@/brand';

/**
 * The words on the public pages, both languages side by side.
 *
 * Kept apart from the markup for the same reason the landing copy is: two
 * translations only stay equivalent if they can be read next to each other.
 * Everything here describes what the product actually does today — there is no
 * paragraph about courses, lessons or certificates, because Plauvia has none.
 */

export interface P {
  bg: string;
  en: string;
}
export interface Section {
  h: P;
  /** paragraphs */
  p?: P[];
  /** a bulleted list under the paragraphs */
  ul?: P[];
}

export const t = (v: P, lang: Lang): string => v[lang];

/* ------------------------------------------------------------------ about */

export const ABOUT_LEAD: P = {
  bg: 'Plauvia е работно място за деня ти: планът, напомнянията, документите, картите и часовете на едно място, вместо в пет приложения, които не се познават помежду си.',
  en: 'Plauvia is a workspace for your day: the plan, the reminders, the documents, the cards and the hours in one place, instead of five apps that have never heard of each other.',
};

export const ABOUT: Section[] = [
  {
    h: { bg: 'Защо съществува', en: 'Why it exists' },
    p: [
      {
        bg: 'Повечето хора не се провалят в плановете си, защото не могат да ги изпълнят. Провалят се, защото планът живее в един тефтер, напомнянията са в телефона, а никой от тях не знае колко часа наистина са изкарани. Plauvia събира точно тези неща и ги кара да четат едни и същи записи.',
        en: 'Most people do not struggle because they cannot do the work. They struggle because the plan lives in one notebook, the reminders live in a phone, and neither of them knows how many hours were actually put in. Plauvia puts those things together and makes them read the same records.',
      },
      {
        bg: 'Затова никое число в приложението не се въвежда на ръка. Нивата, сериите и готовността за изпит се пресмятат наново от записите, които вече съществуват — фокус сесии, завършени задачи, прегледани карти. Число, което не може да се проследи до нещо направено, е украса.',
        en: 'That is why no number in the app is typed in by hand. Levels, streaks and exam readiness are recomputed from records that already exist — focus sessions, completed tasks, card reviews. A number that cannot be traced back to something done is decoration.',
      },
    ],
  },
  {
    h: { bg: 'За кого е', en: 'Who it is for' },
    p: [
      {
        bg: 'За всеки, който води деня си сам: с работа, с домакинство, с тренировки, с проекти отстрани. За ученици и студенти, които работят с учебници в PDF и искат да решават направо върху страницата. За всеки, който подготвя изпит или голям срок и има нужда да види къде отиват часовете. Приложението е на български и на английски и работи еднакво на лаптоп, таблет и телефон.',
        en: 'For anyone running their own day — a job, a household, training, a project on the side. For school and university students who work from PDF textbooks and want to solve straight on the page. For anyone facing an exam or a deadline who needs to see where the hours go. The app is in Bulgarian and English and works the same on a laptop, a tablet and a phone.',
      },
    ],
  },
  {
    h: { bg: 'Как е направено', en: 'How it is built' },
    p: [
      {
        bg: 'Първо на устройството. Всичко се записва в браузъра ти преди каквото и да е друго, така че приложението се отваря и работи без мрежа. Профилът е по избор и добавя само едно нещо: същата библиотека на второ устройство.',
        en: 'Device first. Everything is written to your browser before anything else, so the app opens and works with no network. An account is optional and adds exactly one thing: the same library on a second device.',
      },
      {
        bg: 'Няма реклами, няма рекламни мрежи и няма проследяване между сайтове. Вътре в приложението няма никаква аналитика: какво отваряш, какво пишеш и колко учиш не се мери от никого. Публичните страници — тази, началната, въпросите — броят посещения без бисквитки, за да се знае дали някой стига дотук. Това не е обещание за бъдещето, а описание на кода, който се изпълнява в момента.',
        en: 'There are no ads, no ad networks and no cross-site tracking. Inside the app there is no analytics at all: what you open, what you write and how long you study is measured by nobody. The public pages — this one, the home page, the questions — count visits without cookies, so that it is known whether anyone gets this far. That is not a promise about the future; it is a description of the code that runs today.',
      },
    ],
  },
];

/* -------------------------------------------------------------------- faq */

export const FAQ: { q: P; a: P }[] = [
  {
    q: { bg: 'Какво представлява Plauvia?', en: 'What is Plauvia?' },
    a: {
      bg: 'Работно място за деня: планираш днес и дългия път на един екран, слагаш напомняния, отваряш документ или празна дъска, пишеш направо върху страницата, изрязваш нещо и то става флашкарта, пускаш фокус сесия. Часовете, които запишеш, стават статистиката и нивата.',
      en: 'A workspace for the day: plan today and the long haul on one screen, set reminders, open a document or a blank board, write straight on the page, cut something out and it becomes a flashcard, run a focus session. The hours you log become the statistics and the levels.',
    },
  },
  {
    q: { bg: 'Работи ли без интернет?', en: 'Does it work without internet?' },
    a: {
      bg: 'Да. Всичко се записва първо на устройството ти и приложението се отваря напълно без мрежа. Влизането в профил добавя само синхронизация между устройства.',
      en: 'Yes. Everything is written to your device first and the app opens with no network at all. Signing in only adds sync between devices.',
    },
  },
  {
    q: { bg: 'Трябва ли ми профил?', en: 'Do I need an account?' },
    a: {
      bg: 'Не. Можеш да продължиш без профил и всичко работи — данните просто остават на това устройство. Профил ти трябва само ако искаш същата библиотека и на телефона си.',
      en: 'No. You can continue without one and everything works — the data simply stays on that device. An account is only needed if you want the same library on your phone as well.',
    },
  },
  {
    q: { bg: 'Безплатно ли е?', en: 'Is Plauvia free?' },
    a: {
      bg: 'Да, приложението е безплатно за ползване и не иска карта. Ако някога се появи платен план, съществуващите функции няма да бъдат заключени с обратна сила.',
      en: 'Yes, the app is free to use and asks for no card. If a paid plan ever appears, existing features will not be locked behind it retroactively.',
    },
  },
  {
    q: { bg: 'Къде стоят данните ми?', en: 'Where is my data kept?' },
    a: {
      bg: 'В браузъра на устройството ти. Ако влезеш в профил, копие се пази и в базата, която захранва plauvia.com — всеки ред е обвързан с твоя профил и правилата за достъп на ниво ред не позволяват на друг профил да го прочете. Подробностите са в Политиката за поверителност.',
      en: "In your device's browser. If you sign in, a copy is also kept in the database behind plauvia.com — every row is tied to your account, and row-level security stops another account from reading it. The details are in the Privacy Policy.",
    },
  },
  {
    q: { bg: 'Мога ли да следя напредъка си?', en: 'Can I track my progress?' },
    a: {
      bg: 'Да. Часове по предмет, напредък по учебник, точност на картите, серии, нива и готовност за изпит — всичко пресметнато от записите, а не въведено на ръка.',
      en: 'Yes. Hours per subject, progress per book, card accuracy, streaks, levels and exam readiness — all computed from the records rather than typed in.',
    },
  },
  {
    q: { bg: 'Работи ли на телефон?', en: 'Can I use Plauvia on mobile?' },
    a: {
      bg: 'Да. Интерфейсът е направен и за малък екран, а приложението може да се инсталира от браузъра като отделна икона на началния екран.',
      en: 'Yes. The interface is built for a small screen too, and the app can be installed from the browser as its own icon on the home screen.',
    },
  },
  {
    q: { bg: 'Трябва ли ми писалка?', en: 'Do I need a stylus?' },
    a: {
      bg: 'Не. Мишка или пръст върши работа навсякъде; писалката просто прави писането по-приятно, а защитата от длан е там, ако имаш такава.',
      en: 'No. A mouse or a finger works for everything; a stylus only makes the writing part nicer, and palm rejection is there when you have one.',
    },
  },
  {
    q: { bg: 'Как си сменям паролата?', en: 'How do I reset my password?' },
    a: {
      bg: 'От екрана за вход избери „Забравена парола“ и ще получиш писмо с еднократна връзка. Ако вече си влязъл, паролата се сменя от Настройки → Профил.',
      en: 'On the sign-in screen choose "Forgot password" and you will get an e-mail with a single-use link. If you are already signed in, the password is changed from Settings → Account.',
    },
  },
  {
    q: { bg: 'Как изтривам профила си?', en: 'How do I delete my account?' },
    a: {
      bg: 'От Настройки → Профил → Изтрий профила. Профилът и всичко, което е качено с него, се изтриват веднага. Данните на устройството ти остават непокътнати, освен ако не ги изтриеш отделно.',
      en: 'From Settings → Account → Delete account. The account and everything uploaded with it are deleted immediately. The data on your device is left untouched unless you delete it separately.',
    },
  },
  {
    q: { bg: 'Мога ли да си изнеса всичко?', en: 'Can I export everything?' },
    a: {
      bg: 'Да. Учебниците с бележките излизат като PDF, а цялата библиотека — книги, карти, задачи и история — като един архивен файл от Настройки → Резервно копие.',
      en: 'Yes. Annotated textbooks export as PDFs, and the whole library — books, cards, tasks and history — exports as a single backup file from Settings → Backup.',
    },
  },
];

/* ---------------------------------------------------------------- contact */

export const CONTACT_LEAD: P = {
  bg: 'Един човек чете тази поща. Пиши на български или на английски — и в двата случая ще получиш отговор от човек, не от система за тикети.',
  en: 'One person reads this mail. Write in Bulgarian or English — either way the reply comes from a person, not a ticketing system.',
};

export const CONTACT_ROWS: { label: P; note: P; value: string }[] = [
  {
    label: { bg: 'Въпроси и проблеми', en: 'Questions and problems' },
    note: {
      bg: 'Нещо не работи, нещо липсва или нещо е объркващо.',
      en: 'Something is broken, something is missing, or something is confusing.',
    },
    value: legalValue(LEGAL.contactEmail),
  },
  {
    label: { bg: 'Данни и поверителност', en: 'Data and privacy' },
    note: {
      bg: 'Копие на данните ти, изтриване, възражение срещу обработка.',
      en: 'A copy of your data, deletion, objecting to processing.',
    },
    value: legalValue(LEGAL.privacyEmail),
  },
  {
    label: { bg: 'Сигурност', en: 'Security' },
    note: {
      bg: 'Ако си намерил уязвимост, пиши тук преди да я разгласяваш.',
      en: 'If you have found a vulnerability, write here before disclosing it.',
    },
    value: legalValue(LEGAL.securityEmail),
  },
];
