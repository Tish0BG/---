/**
 * Domain model of the app.
 *
 * Coordinate system for every annotation: "page space" — PDF points at
 * viewport scale 1, origin top-left, y growing downwards (the same space the
 * pdf.js viewport uses at scale = 1). This makes annotations independent of
 * zoom level, device pixel ratio and canvas size; rendering multiplies by the
 * current scale, export converts to PDF user space via viewport helpers.
 *
 * A document is either an imported PDF or a whiteboard. Both expose the same
 * "pages of a given size" surface (see services/pageSource.ts), which is why
 * drawing, autosave, undo, thumbnails and export are shared verbatim.
 */

export type ISODate = number; // epoch ms

/* ------------------------------------------------------------------ library */

export interface Folder {
  id: string;
  name: string;
  /** null = root level */
  parentId: string | null;
  color?: string | null;
  /** subject the whole folder belongs to */
  subjectId?: string | null;
  /** in the bin since; null = live */
  deletedAt?: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** manual ordering inside the parent */
  order: number;
}

export type StudyStatus = 'not_started' | 'in_progress' | 'completed' | 'review';

/**
 * What backs a document.
 *
 * `pdf` and `board` are pages you draw on; `note` is a written document with
 * no pages at all — a rich-text body that lives in the record itself. They
 * share the library, the subjects, the bin and the links because from the
 * reader's side they are all "something I keep and open".
 */
export type DocKind = 'pdf' | 'board' | 'note';

/**
 * A written document.
 *
 * The body is HTML, produced by the editor's own toolbar rather than by
 * pasting arbitrary markup, and it is stored on the document record so it
 * syncs with everything else without a second machinery for text.
 */
export interface NoteDoc {
  html: string;
  /** the same content as plain text, for search, previews and the word count */
  text: string;
  words: number;
}

/* --------------------------------------------------------------- whiteboard */

export type PaperTemplate =
  | 'blank'
  | 'lined'
  | 'lined-wide'
  | 'grid'
  | 'grid-large'
  | 'dots'
  | 'graph'
  | 'music'
  | 'cornell';

/** Paged = a stack of sheets; scroll = one sheet that grows downwards. */
export type BoardFlow = 'paged' | 'scroll';

export interface BoardPage {
  /** overrides the board default for this sheet only */
  template?: PaperTemplate;
  /** size in PDF points (72 per inch) */
  w: number;
  h: number;
}

export interface BoardConfig {
  flow: BoardFlow;
  /** default paper for pages that do not override it */
  template: PaperTemplate;
  /** paper tint, null = white */
  paper: string | null;
  pages: BoardPage[];
}

export interface DocumentMeta {
  id: string;
  name: string;
  kind: DocKind;
  folderId: string | null;
  pageCount: number;
  /** byte size of the original PDF (0 for boards) */
  size: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  openedAt: ISODate | null;
  /** resume state */
  lastPage: number;
  zoom: number;
  fitMode: FitMode;
  scrollRatio: number;
  /** study tracking */
  status: StudyStatus;
  /** highest page the user has reached, drives automatic progress */
  maxPageVisited: number;
  /** 0..1, null = derive from maxPageVisited */
  manualProgress: number | null;
  annotationCount: number;
  /** cached first-page thumbnail (small JPEG/PNG data URL) */
  cover?: string | null;
  /** present only when kind === 'board' */
  board?: BoardConfig | null;
  /** present only when kind === 'note' */
  note?: NoteDoc | null;
  /**
   * Other documents this one is tied to, in either direction.
   *
   * Kept on both records rather than in a join table: a link is a property of
   * the pair, and two records that each know about the other survive one of
   * them being restored from an older device without the connection vanishing.
   */
  links?: string[];
  /** subject this material belongs to */
  subjectId?: string | null;
  /** pinned to the top of the library */
  starred?: boolean;
  /** in the bin since; null = live */
  deletedAt?: ISODate | null;
  order: number;
}

export interface StoredFile {
  docId: string;
  data: ArrayBuffer;
  mime: string;
}

/* ------------------------------------------------------------- annotations */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

interface AnnotationBase {
  id: string;
  docId: string;
  /** 1-based page number */
  page: number;
  color: string;
  /** 0..1 */
  opacity: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface StrokeAnnotation extends AnnotationBase {
  type: 'pen' | 'highlighter';
  /** nib width in page units */
  size: number;
  /** flat [x, y, pressure, x, y, pressure, ...] in page space */
  points: number[];
}

export interface ShapeAnnotation extends AnnotationBase {
  type: 'line' | 'rect' | 'ellipse' | 'arrow';
  size: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** fill colour for rect/ellipse, null = outline only */
  fill?: string | null;
}

export type FontFamily = 'sans' | 'serif' | 'mono';

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number;
  y: number;
  /** wrapping width in page units */
  w: number;
  h: number;
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  /** key into the `assets` store */
  assetId: string;
}

export type ProblemStatus = 'unsolved' | 'solved' | 'incorrect' | 'review';

/** A rectangle marking a task/problem on the page, with a solving status. */
export interface RegionAnnotation extends AnnotationBase {
  type: 'region';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  status: ProblemStatus;
}

export type Annotation =
  | StrokeAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | ImageAnnotation
  | RegionAnnotation;

export interface Asset {
  id: string;
  docId: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface Bookmark {
  id: string;
  docId: string;
  page: number;
  label: string;
  createdAt: ISODate;
  /** set on every write; the cloud merges two devices by recency */
  updatedAt?: ISODate;
}

/* ------------------------------------------------------------- flashcards */

export type CardKind = 'basic' | 'occlusion';

/**
 * One review item. Scheduling follows SM-2: every answer either resets the
 * card (again) or multiplies its interval by the current ease factor.
 */
export interface FlashCard {
  id: string;
  kind: CardKind;
  /** document the card was cut from, null for hand-written cards */
  docId: string | null;
  /** page it came from, for "jump to source" */
  page: number | null;
  deck: string;
  subjectId?: string | null;
  front: string;
  back: string;
  /** assets store keys for clipped images */
  frontAsset?: string | null;
  backAsset?: string | null;
  /** occlusion cards: every mask of the group, and the one this card hides */
  masks?: Rect[];
  maskIndex?: number;
  /** shared by all cards cut from one image */
  groupId?: string | null;

  /* SM-2 state */
  due: ISODate;
  /** days */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  suspended: boolean;
  lastReviewedAt: ISODate | null;

  createdAt: ISODate;
  updatedAt: ISODate;
}

export type CardGrade = 'again' | 'hard' | 'good' | 'easy';

/**
 * A deck, which used to be nothing but a string repeated on every card.
 *
 * It became a record the day decks needed a colour of their own: a box of
 * thirty dividers that are all the same grey is a box you read by squinting at
 * names. The name is still the key — cards reference a deck by it — so this is
 * a thin record and deliberately so.
 */
export interface Deck {
  name: string;
  /** hex, from the same palette the subjects use */
  color: string;
  createdAt: ISODate;
}

/* ------------------------------------------------------------ focus timer */

export type TimerMode = 'work' | 'break' | 'long';

/** @deprecated v2 shape, migrated into PlannerItem on upgrade. */
export interface StudyTask {
  id: string;
  text: string;
  done: boolean;
  pomodoros: number;
  docId: string | null;
  createdAt: ISODate;
  order: number;
}

export interface FocusSession {
  id: string;
  updatedAt?: ISODate;
  /** local day key YYYY-MM-DD, indexed for the statistics screens */
  day: string;
  startedAt: ISODate;
  minutes: number;
  docId: string | null;
  taskId: string | null;
  subjectId?: string | null;
}

export interface TimerSettings {
  work: number;
  break: number;
  long: number;
  /** focus sessions before a long break */
  cycles: number;
  /** daily goal in minutes */
  goal: number;
  autoStart: boolean;
  sound: boolean;
  notify: boolean;
  /**
   * Whether pressing play takes over the whole screen.
   *
   * Off by default, and it stays off unless somebody turns it on: a timer
   * that swallows the window the moment it is touched is a timer people stop
   * touching. Full screen is a button on the focus screen instead.
   */
  fullscreenOnStart: boolean;
}

/* ------------------------------------------------------------------- tools */

export type ToolId =
  | 'select'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'image'
  | 'region'
  | 'snip';

export type EraserMode = 'stroke' | 'partial';

export interface ToolSettings {
  color: string;
  size: number;
  opacity: number;
}

export type FitMode = 'none' | 'width' | 'page';

/* ---------------------------------------------------------------- settings */

/**
 * The accents a person may choose. A closed list, because every one of them is
 * measured against the text that sits on it — an arbitrary colour picker hands
 * out combinations nobody checked.
 */
export type Accent = 'brand' | 'cyan' | 'green' | 'amber' | 'rose' | 'violet';

/** Follow the operating system, or override it in one direction. */
export type MotionPreference = 'system' | 'reduced' | 'full';

/* ------------------------------------------------------------- dashboard */

/**
 * How wide a dashboard panel sits on the twelve-column grid.
 *
 * Four sizes rather than free resizing: a grid that can be dragged to any
 * width is a grid that ends up misaligned, and none of the panels here have
 * anything useful to do with 7/12 of a screen.
 */
export type WidgetSize = 'quarter' | 'third' | 'half' | 'full';

export interface DashboardPanel {
  /** id from the widget registry */
  id: string;
  size: WidgetSize;
  /** kept in the list rather than removed, so re-adding restores the size */
  hidden?: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  accent: Accent;
  /** scales the whole type ramp at once, 1 = the designed size */
  typeScale: number;
  motion: MotionPreference;
  highContrast: boolean;
  /** dim/invert the PDF itself in dark mode */
  pdfDarkMode: 'off' | 'dim' | 'invert';
  /** ignore finger input while a drawing tool is active (palm rejection) */
  stylusOnly: boolean;
  /** snap hand-drawn shapes to perfect ones */
  shapeRecognition: boolean;
  eraserMode: EraserMode;
  eraserSize: number;
  showThumbnails: boolean;
  pressureSensitivity: boolean;
  toolPresets: Record<string, ToolSettings>;
  /** defaults applied to newly created text annotations */
  textFont: FontFamily;
  textAlign: 'left' | 'center' | 'right';
  textBold: boolean;
  textItalic: boolean;
  lastTool: ToolId;
  lastDocId: string | null;
  /** defaults for newly created boards */
  boardTemplate: PaperTemplate;
  boardFlow: BoardFlow;
  timer: TimerSettings;
  /** floating timer widget: visible and where it sits (viewport fractions) */
  timerVisible: boolean;
  timerPos: { x: number; y: number };
  /** library layout */
  driveView: 'grid' | 'list';
  driveSort: 'recent' | 'name' | 'progress' | 'size';
  /** highest and lowest mark on the grading scale */
  gradeScale: { min: number; max: number; pass: number };
  /**
   * How the navigation rail behaves.
   *
   * Three states rather than a boolean, because "collapsed" was answering two
   * different questions at once: it decided both the width *and* whether the
   * rail opened under the pointer. Somebody who wants icons only and somebody
   * who wants icons that unfold on hover were being given the same setting.
   */
  railMode: RailMode;
  /**
   * How many minutes a day is allowed to hold, for the plan's capacity bar.
   *
   * One number for every day rather than one per date: a person's working day
   * is a habit, not a calendar entry, and a per-day override is a setting
   * nobody would ever go back and correct.
   */
  dayCapacity: number;
  /** the panels on the dashboard, in the order they are drawn */
  dashboard: DashboardPanel[];
  /** desktop notifications for reminders and for what is still open today */
  reminders: ReminderSettings;
}

/**
 * When the app is allowed to speak.
 *
 * Everything here is off until somebody turns it on, and the browser's own
 * permission prompt is asked for at that moment rather than on first load —
 * a notification permission dialog on arrival is how an app gets denied.
 */
export interface ReminderSettings {
  /** master switch; false means nothing is ever delivered */
  enabled: boolean;
  /** minutes before a reminder's own time to fire it, 0 = exactly then */
  lead: number;
  /** a nudge about entries still open today */
  digest: boolean;
  /** when that nudge arrives, "18:00" */
  digestAt: string;
  /** deadlines with an hour on them also announce themselves */
  dueTimes: boolean;
}

/** `hover` keeps the narrow footprint and unfolds a floating panel under the pointer. */
export type RailMode = 'expanded' | 'collapsed' | 'hover';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/* ------------------------------------------------------------------ profile */

/**
 * The person using the app: the greeting, the accent, the school details.
 *
 * It is filled in from the account on first sign-in and edited in settings
 * afterwards — never through a wizard standing between registering and using
 * the thing.
 */
export interface Profile {
  /** what the app calls you. A first name, not a legal one. */
  name: string;
  /** optional, and asked for nowhere except settings */
  lastName: string;
  /**
   * The handle, lower-cased and unique. Nothing public points at it yet — it
   * exists so that when something does, the name a person chose today is
   * still theirs.
   */
  username: string;
  /** single emoji shown as the avatar when there is no photo */
  avatar: string;
  /**
   * A photo, as a square WebP data URL of about 20 KB.
   *
   * Inline rather than a file in the bucket on purpose: the profile record
   * already syncs between devices, so a face carried inside it arrives with
   * the name instead of needing a second round trip and a signed URL. The
   * ceiling is 256 px, which is four times the largest place it is ever
   * drawn. Empty means fall back — to the emoji, then to the initial.
   */
  photo: string;
  /** accent tint picked at setup */
  color: string;
  school: string;
  grade: string;
  /** a line about yourself; unused until profiles are shown to anyone else */
  bio: string;
  createdAt: ISODate;
  /** last edit, so the cloud can merge two devices by recency */
  updatedAt: ISODate;
}

/* ------------------------------------------------------- learning profile */

export type LearningLevel = 'unsure' | 'beginner' | 'basic' | 'intermediate' | 'advanced';

export type LearningGoal =
  | 'foundations'
  | 'exam'
  | 'grades'
  | 'university'
  | 'new-subject'
  | 'curiosity'
  | 'skills';

export type LearningStyle = 'short' | 'deep' | 'practice' | 'examples' | 'visual' | 'problems' | 'mixed';

/**
 * What the person said they are here to do.
 *
 * Kept apart from `Profile` because it answers a different question and has a
 * different lifetime: a name is who you are, this is what you are working on
 * this term, and it is expected to change.
 */
export interface LearningProfile {
  /** free-text interests, matching subject names where they exist */
  interests: string[];
  level: LearningLevel;
  goals: LearningGoal[];
  styles: LearningStyle[];
  /** minutes the person said a normal sitting is; 0 means "it depends" */
  sessionMinutes: number;
  updatedAt: ISODate;
}

/* ------------------------------------------------------ privacy settings */

export type Visibility = 'private' | 'public';

/**
 * Who may see what, once there is anyone to see it.
 *
 * Every default is the closed one. Nothing in the product publishes a profile
 * today; these exist so that the day something does, it starts from "nobody"
 * rather than from a migration that has to guess what people would have
 * wanted.
 */
export interface PrivacySettings {
  profile: Visibility;
  displayName: Visibility;
  interests: Visibility;
  achievements: Visibility;
  progress: Visibility;
  updatedAt: ISODate;
}

/* ----------------------------------------------------------------- subjects */

/**
 * The organising axis of the whole app: materials, cards, tasks, grades,
 * timetable slots and study sessions all hang off a subject, which is what
 * lets every screen be filtered down to "just maths".
 */
export interface Subject {
  id: string;
  updatedAt?: ISODate;
  name: string;
  /** hex, drives the colour of everything tagged with this subject */
  color: string;
  icon: string;
  teacher: string;
  archived: boolean;
  order: number;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ planner */

/**
 * What an entry is.
 *
 * The three built-in ids are spelled out because the rest of the app has
 * opinions about them — an exam gets a countdown, homework gets a subject by
 * default. Everything else is a string id pointing at an `ItemType` the person
 * made themselves, which is what stops the planner from being only for
 * schoolwork: a rehearsal, a shift, a deadline at work are all just types.
 */
export const BUILTIN_KINDS = ['task', 'homework', 'exam'] as const;
export type BuiltinKind = (typeof BUILTIN_KINDS)[number];
export type PlannerKind = BuiltinKind | (string & {});

/**
 * A kind of entry, built-in or invented.
 *
 * Types are deliberately thin — a name, an icon, a colour — because the
 * moment a type carries behaviour it stops being something a person can
 * safely make up on a Tuesday afternoon.
 */
export interface ItemType {
  id: string;
  name: string;
  /** the English name, only ever set on the three built-ins */
  nameEn?: string;
  icon: string;
  /** hex; null means "wear the subject's colour" */
  color: string | null;
  /** the three that ship with the app and cannot be deleted */
  builtin?: boolean;
  /** hidden from the pickers without losing the entries already using it */
  archived?: boolean;
  order: number;
  updatedAt: ISODate;
}

/**
 * One entry in the planner. Homework, exams and anything a person invents are
 * the same record with a different `kind`, not separate machinery — the timer,
 * the dashboard, the calendar and the subject page all read one list.
 */
export interface PlannerItem {
  id: string;
  kind: PlannerKind;
  title: string;
  notes: string;
  subjectId: string | null;
  /** material this relates to, for one-click "open and start" */
  docId: string | null;
  /** epoch ms, null = someday */
  due: ISODate | null;
  /**
   * Time of day, `"14:30"`, or null for "some time that day".
   *
   * A deadline with an hour on it belongs in the calendar's time grid beside
   * the lessons; one without belongs in the all-day strip. Storing the hour
   * apart from `due` keeps every existing "is it due today" test working.
   */
  time?: string | null;
  /** minutes the entry is expected to take; 0 = unknown */
  duration?: number;
  done: boolean;
  completedAt: ISODate | null;
  /** 0 normal, 1 important, 2 urgent */
  priority: 0 | 1 | 2;
  /** completed focus sessions spent on this item */
  pomodoros: number;
  /**
   * How the entry gets finished.
   *
   * Not every job is a twenty-five-minute block. Watering the plants is a
   * tick, packing is a list of small ticks, drinking water is a counter, and
   * only some of it is worth a timer — so the entry says which of the four it
   * is and the row draws itself accordingly. `undefined` reads as `check`,
   * which is what every entry written before this field was a task.
   */
  method?: TaskMethod;
  /** the small ticks inside one entry; only used when method === 'checklist' */
  steps?: TaskStep[];
  /** how far a counted entry has got; only used when method === 'count' */
  count?: number;
  /** counter target, or the number of focus blocks a timed entry is worth */
  target?: number;
  /**
   * When to be told about it, epoch ms. Independent of `due`: a deadline is
   * when something must be finished, a reminder is when you want the app to
   * tap you on the shoulder.
   */
  remindAt?: ISODate | null;
  /** the last reminder actually delivered, so it fires once and not per tick */
  remindedAt?: ISODate | null;
  /** how the entry comes back after it is ticked */
  repeat?: RepeatRule;
  order: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/**
 * The four ways an entry can be worked.
 *
 * `check` is a plain to-do, `checklist` breaks one entry into steps, `count`
 * is for anything measured in repetitions, and `timer` is the focus block the
 * app started life with. The timer is one option among four rather than the
 * only road through the list.
 */
export type TaskMethod = 'check' | 'checklist' | 'count' | 'timer';

export interface TaskStep {
  id: string;
  title: string;
  done: boolean;
  /**
   * Minutes this step is expected to take; 0 or unset = unknown.
   *
   * Only *planned* time, never actual. A focus session is tagged with a
   * `PlannerItem.id` and step ids are not addressable, so there is no honest
   * way to say how long one step really took — and a zero in that column
   * would read as "no time spent" rather than "not known".
   */
  duration?: number;
}

/** How often a ticked entry returns. `weekdays` is Monday to Friday. */
export type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

/* ------------------------------------------------------------ achievements */

export type AchievementTier = 'bronze' | 'silver' | 'gold';

/**
 * Progress and level are *derived* from the records — minutes studied, tasks
 * completed, cards reviewed — and never stored as a running total. A counter
 * that is written on every event is a counter that eventually disagrees with
 * the thing it counts; a derived one cannot.
 *
 * What is stored is only the moment each achievement was first reached, so
 * "unlocked just now" can be shown exactly once.
 */
export interface GameState {
  /** achievement id → when it was first earned */
  unlocked: Record<string, ISODate>;
  /** highest level already celebrated */
  seenLevel: number;
  updatedAt: ISODate;
}

/* ------------------------------------------------------------------- grades */

export interface Grade {
  id: string;
  updatedAt?: ISODate;
  subjectId: string;
  label: string;
  /** on the scale configured in settings (Bulgarian 2–6 by default) */
  value: number;
  /** 1 = ordinary mark, 2 = test, 3 = exam — used for the weighted average */
  weight: number;
  date: ISODate;
  note: string;
}

/* ---------------------------------------------------------------- timetable */

export interface ClassSlot {
  id: string;
  updatedAt?: ISODate;
  subjectId: string;
  /** 0 = Sunday, matching Date.getDay() */
  day: number;
  /** "08:30" */
  start: string;
  end: string;
  room: string;
}

/* ------------------------------------------------------------------- cloud */

/**
 * Everything that travels to the cloud is a flat record with an `updatedAt`,
 * so merging two devices is "the newer write wins" and needs no server logic.
 * `kind` is the local store the record came from.
 */
export type SyncKind =
  | 'folders'
  | 'documents'
  | 'annotations'
  | 'bookmarks'
  | 'cards'
  | 'subjects'
  | 'planner'
  | 'grades'
  | 'schedule'
  | 'sessions'
  | 'meta';

/** A locally deleted record, kept until the deletion has reached the cloud. */
export interface Tombstone {
  /** `${kind}:${id}` */
  key: string;
  kind: SyncKind;
  id: string;
  /** true for a document: the server also drops everything hanging off it */
  cascade?: boolean;
  deletedAt: ISODate;
}

export type SyncPhase = 'idle' | 'checking' | 'pulling' | 'pushing' | 'files' | 'done' | 'error';

export interface SyncState {
  phase: SyncPhase;
  /** human sentence for the UI */
  label: string;
  /** 0..1, null when the step has no measurable progress */
  progress: number | null;
  lastSyncAt: ISODate | null;
  error: string | null;
  /** the run finished, but something was worked around rather than done */
  warning?: string | null;
  /** how many records went each way in the last run */
  pulled: number;
  pushed: number;
}

/* -------------------------------------------------------------- utilities */

/** A tool that can be opened next to the page while solving. */
export type UtilityId =
  | 'calculator'
  | 'periodic'
  | 'ptable'
  | 'converter'
  | 'formulas'
  | 'graph'
  | 'notes'
  | 'triangle';

/** Where a utility window sits: floating, or clipped to one edge. */
export type DockSide = 'float' | 'left' | 'right' | 'top' | 'bottom';

export interface UtilityWindow {
  /** instance id, so the same tool can be opened twice */
  wid: string;
  id: UtilityId;
  dock: DockSide;
  /** floating position in viewport px */
  x: number;
  y: number;
  w: number;
  h: number;
  /** share of the viewer taken when docked, 0.15..0.6 */
  split: number;
  minimized: boolean;
  z: number;
}

/* ------------------------------------------------- geometry instruments */

export type InstrumentId = 'ruler' | 'protractor' | 'setsquare' | 'compass';

/** Overlay grid drawn over the page to help with angles and proportions. */
export type GridOverlay = 'off' | 'square' | 'dots' | 'iso' | 'polar';

export interface InstrumentState {
  /** centre of the instrument in viewport px */
  x: number;
  y: number;
  /** degrees, clockwise */
  angle: number;
  /** length (ruler) or radius (protractor / set square) in px */
  size: number;
  /** true while it is on the page */
  on: boolean;
  /** ink snaps to the instrument's edge while it is active */
  snap: boolean;
  /** set square shape: 45-45-90 or 30-60-90 */
  variant?: 45 | 30;
}
