import { L, type Msg } from './index';

/**
 * The words that repeat across screens. Everything else is written inline,
 * next to the markup it belongs to.
 */
export const S = {
  /* navigation */
  dashboard: L('Табло', 'Dashboard'),
  tasks: L('Задачи', 'Tasks'),
  calendar: L('Календар', 'Calendar'),
  goals: L('Цели', 'Goals'),
  exams: L('Изпити', 'Exams'),
  library: L('Библиотека', 'Library'),
  cards: L('Флашкарти', 'Flashcards'),
  focus: L('Фокус', 'Focus'),
  stats: L('Статистика', 'Statistics'),
  subjects: L('Предмети', 'Subjects'),
  achievements: L('Постижения', 'Achievements'),
  settings: L('Настройки', 'Settings'),
  profile: L('Профил', 'Profile'),
  notifications: L('Известия', 'Notifications'),
  search: L('Търсене', 'Search'),

  /* verbs */
  add: L('Добави', 'Add'),
  create: L('Създай', 'Create'),
  save: L('Запази', 'Save'),
  cancel: L('Отказ', 'Cancel'),
  delete: L('Изтрий', 'Delete'),
  edit: L('Редактирай', 'Edit'),
  open: L('Отвори', 'Open'),
  close: L('Затвори', 'Close'),
  done: L('Готово', 'Done'),
  start: L('Старт', 'Start'),
  pause: L('Пауза', 'Pause'),
  resume: L('Продължи', 'Resume'),
  finish: L('Приключи', 'Finish'),
  retry: L('Опитай пак', 'Try again'),
  back: L('Назад', 'Back'),
  next: L('Напред', 'Next'),
  skip: L('Пропусни', 'Skip'),
  all: L('Всички', 'All'),
  today: L('Днес', 'Today'),
  week: L('Седмица', 'Week'),
  month: L('Месец', 'Month'),
  day: L('Ден', 'Day'),

  /* nouns used as labels */
  subject: L('Предмет', 'Subject'),
  task: L('Задача', 'Task'),
  homework: L('Домашно', 'Homework'),
  exam: L('Изпит', 'Exam'),
  goal: L('Цел', 'Goal'),
  note: L('Бележка', 'Note'),
  event: L('Събитие', 'Event'),
  deadline: L('Краен срок', 'Deadline'),
  priority: L('Приоритет', 'Priority'),
  progress: L('Напредък', 'Progress'),
  streak: L('Серия', 'Streak'),
  level: L('Ниво', 'Level'),
  minutes: L('минути', 'minutes'),
  noSubject: L('Без предмет', 'No subject'),
} satisfies Record<string, Msg>;

/** Priority names, shared by tasks, the calendar and the command palette. */
export const PRIORITY: Record<0 | 1 | 2, Msg> = {
  0: L('Нормален', 'Normal'),
  1: L('Важен', 'Important'),
  2: L('Спешен', 'Urgent'),
};
