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

/** What backs the pages of a document. */
export type DocKind = 'pdf' | 'board';

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

export type AnnotationType =
  | 'pen'
  | 'highlighter'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'image'
  | 'region';

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

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
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
  /** collapse the navigation rail to icons only */
  railCollapsed: boolean;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/* ------------------------------------------------------------------ profile */

/**
 * The person using this browser. There is no account and no server: a profile
 * is simply what makes the app feel like yours — the greeting, the goal, the
 * colours. Every browser holds exactly one.
 */
export interface Profile {
  name: string;
  /** single emoji shown as the avatar */
  avatar: string;
  /** accent tint picked at setup */
  color: string;
  school: string;
  grade: string;
  createdAt: ISODate;
  /** last edit, so the cloud can merge two devices by recency */
  updatedAt: ISODate;
  /** false until the welcome flow is finished */
  onboarded: boolean;
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

export type PlannerKind = 'task' | 'homework' | 'exam';

/**
 * One entry in the planner. Homework and exams are tasks with a due date and
 * a different weight in the UI, not separate machinery — the timer, the
 * dashboard and the subject page all read the same list.
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
  done: boolean;
  completedAt: ISODate | null;
  /** 0 normal, 1 important, 2 urgent */
  priority: 0 | 1 | 2;
  /** completed focus sessions spent on this item */
  pomodoros: number;
  order: number;
  createdAt: ISODate;
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

/** One binary (a PDF or an image) waiting to be uploaded or downloaded. */
export interface BlobRef {
  /** `file:<docId>` or `asset:<assetId>` */
  key: string;
  docId: string;
  size: number;
  mime: string;
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
