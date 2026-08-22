/**
 * Inline icon set (Lucide-style 24×24 stroke icons).
 * Bundling the handful we need keeps the app dependency-free and offline.
 */
const I: Record<string, string> = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  panelLeft: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronsLeft: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  folder:
    '<path d="M4 20h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.6a2 2 0 0 1-1.6-.8L9.6 4.8A2 2 0 0 0 8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/>',
  folderPlus:
    '<path d="M4 20h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.6a2 2 0 0 1-1.6-.8L9.6 4.8A2 2 0 0 0 8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><path d="M12 11v6M9 14h6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  highlighter:
    '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser:
    '<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"/><path d="M22 21H7M5 11l8 8"/>',
  line: '<path d="M5 19 19 5"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  arrow: '<path d="M5 19 18 6M9 6h9v9"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  cursor: '<path d="m4 3 7 17 2.4-6.6L20 11Z"/>',
  hand: '<path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11M15 10.5V5a1.5 1.5 0 0 0-3 0v5.5M12 10V6.5a1.5 1.5 0 0 0-3 0V13"/><path d="M9 12.5 7.6 10a1.5 1.5 0 0 0-2.6 1.5L8 18a6 6 0 0 0 5.2 3h1.3a6 6 0 0 0 6-6v-4"/>',
  region: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 12h6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15.5-6.4L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15.5-6.4L21 13"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M21 21l-4.3-4.3"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-4.3-4.3"/>',
  fitWidth: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 9-3 3 3 3M16 9l3 3-3 3"/>',
  fitPage: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 8 3-3 3 3M9 16l3 3 3-3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 9.5l6.1-.9Z"/>',
  bookmark: '<path d="M19 21l-7-4.5L5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 17V5M7 9l5-5 5 5M4 21h16"/>',
  sliders: '<path d="M4 21v-6M4 11V3M12 21v-9M12 8V3M20 21v-4M20 13V3M1 15h6M9 8h6M17 17h6"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 7 19Z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 21v-8h6v8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  alert: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  palette: '<path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5a2 2 0 0 0-1.4 3.4c.3.3.4.7.4 1.1a1.5 1.5 0 0 1-1.5 1.5Z"/><circle cx="7.5" cy="12" r="1.1"/><circle cx="9.5" cy="8" r="1.1"/><circle cx="14.5" cy="7.5" r="1.1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',

  /* whiteboard, pages */
  board: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4M7 9h10M7 13h6"/>',
  scroll: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  pageAdd: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>',
  pageCopy: '<rect x="8" y="3" width="12" height="15" rx="2"/><path d="M16 21H6a2 2 0 0 1-2-2V7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  rows: '<path d="M3 7h18M3 12h18M3 17h18"/>',
  scissors: '<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M20 4 8.6 16.2M20 20 8.6 7.8"/>',

  /* timer */
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="4.5" width="3.6" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="4.5" width="3.6" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  skip: '<path d="M6 5.5v13l9-6.5-9-6.5z" fill="currentColor" stroke="none"/><rect x="16.5" y="5.5" width="2" height="13" rx="1" fill="currentColor" stroke="none"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  volume: '<path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  listTodo: '<path d="M4 7l2 2 3-3M4 17l2 2 3-3M12 8h8M12 18h8"/>',
  barChart: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  flame: '<path d="M12 3c3 3.5 1.5 5.5 3.5 7.5C17 12 18 13.5 18 15.5A6 6 0 0 1 6 15.5c0-3 2-5 3.5-7 .8 1.1 1.7 1.4 2.5 1 .5-2.5-.8-4.5 0-6.5Z"/>',

  /* flashcards */
  cards: '<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M7.5 3.5h11a2 2 0 0 1 2 2v11"/><path d="M7 12h5M7 16h3"/>',
  brain: '<path d="M12 5a3 3 0 0 0-6 .5A2.7 2.7 0 0 0 4 8a2.8 2.8 0 0 0 1 2.2A3 3 0 0 0 6.5 16 3 3 0 0 0 12 18Z"/><path d="M12 5a3 3 0 0 1 6 .5A2.7 2.7 0 0 1 20 8a2.8 2.8 0 0 1-1 2.2A3 3 0 0 1 17.5 16 3 3 0 0 1 12 18Z"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a18 18 0 0 1-3 3.7M6.6 6.8A17.7 17.7 0 0 0 2 12s3.6 6 10 6a9.8 9.8 0 0 0 4-.8"/><path d="m3 3 18 18"/>',

  /* backup */
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5"/><path d="M10 13h4"/>',
  grip: '<circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/>',

  /* workspace shell */
  dashboard: '<rect x="3" y="3" width="8" height="9" rx="1.6"/><rect x="13" y="3" width="8" height="5" rx="1.6"/><rect x="13" y="10" width="8" height="11" rx="1.6"/><rect x="3" y="14" width="8" height="7" rx="1.6"/>',
  drive: '<path d="M4 20h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.6a2 2 0 0 1-1.6-.8L9.6 4.8A2 2 0 0 0 8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><path d="M9 13h7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  calendarCheck: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4m-7.5 8.5 2 2 4-4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5A1.5 1.5 0 0 0 3 7.5C3 9.4 4.6 11 6.5 11H7M17 6h2.5A1.5 1.5 0 0 1 21 7.5C21 9.4 19.4 11 17.5 11H17"/><path d="M12 14v3M9 20h6M10 17h4"/>',
  chevronsRight: '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
  starFill: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 9.5l6.1-.9Z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6l.1.6h5.2l.1-.6c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z"/>',
  sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M18 15.5 18.9 18l2.5.9-2.5.9L18 22l-.9-2.2-2.5-.9 2.5-.9Z"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10.1Z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',

  /* subject glyphs */
  sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
  flask: '<path d="M9 3h6M10 3v6L4.6 18.4A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.6L14 9V3"/><path d="M7.5 15h9"/>',
  atom: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9.5" ry="4" /><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)"/>',
  leaf: '<path d="M4 20c0-9 6-15 16-15 0 10-6 16-15 16"/><path d="M4 20c3-6 7-9 12-11"/>',
  music: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M9 17.5V6l11-2v11.5"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  /* utilities */
  calculator:
    '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><rect x="7" y="5.5" width="10" height="3.5" rx="1"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
  scale: '<path d="M12 3v18M7 21h10"/><path d="M12 6 5 8m7-2 7 2"/><path d="M2 14a3 3 0 0 0 6 0L5 8Z"/><path d="M16 14a3 3 0 0 0 6 0l-3-6Z"/>',
  chartLine: '<path d="M4 4v16h16"/><path d="m7 15 3.5-4.5 3 2.5L20 6"/>',
  triangle: '<path d="M12 4 21 20H3Z"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  protractor: '<path d="M3 17a9 9 0 0 1 18 0Z"/><path d="M3 17h18"/><path d="M12 17V9M7.5 17l1.6-3.9M16.5 17l-1.6-3.9"/>',
  setsquare: '<path d="M4 4v16h16Z"/><path d="M4 9h3M4 14h3M9 20v-3M14 20v-3"/>',
  compass: '<circle cx="12" cy="4.5" r="1.8"/><path d="M11 6.2 5 20M13 6.2 19 20"/><path d="M8.6 14a6 6 0 0 0 6.8 0"/>',
  gridAngle: '<path d="M3 21V3M3 21h18"/><path d="M3 21 18 6M3 21l9-13M3 21l14-6"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 21H10l-.7-4.3"/><path d="M3 21 12 12"/><path d="m9 6-3 3-4-4 3-3 4 4Z"/>',
  dockLeft: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/><path d="M6 9h1M6 12h1"/>',
  dockRight: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/><path d="M17 9h1M17 12h1"/>',
  dockTop: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
  dockBottom: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18"/>',
  float: '<rect x="3" y="5" width="12" height="10" rx="2"/><rect x="9" y="9" width="12" height="10" rx="2"/>',
  minimize: '<path d="M5 12h14"/>',
  maximize: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  pin: '<path d="M15 3 21 9l-3.5 1.2-4 4L12 21l-3-3-6 3 3-6-3-3 6.8-1.5 4-4Z"/>',
  backspace: '<path d="M20 5H9l-6 7 6 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><path d="m17 9-5 6M12 9l5 6"/>',
  equals: '<path d="M5 9h14M5 15h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4.5l3 1.5"/>',
  angle: '<path d="M4 20h16"/><path d="M4 20 16 4"/><path d="M9 20a7 7 0 0 0-1.2-4"/>',
  magnet: '<path d="M6 3H3v8a9 9 0 0 0 18 0V3h-3v8a6 6 0 0 1-12 0Z"/><path d="M3 8h3M18 8h3"/>',
  shield: '<path d="M12 2.5 20 6v6c0 4.6-3.2 8.6-8 9.5-4.8-.9-8-4.9-8-9.5V6Z"/><path d="m9 12 2 2 4-4"/>',
  wifiOff: '<path d="m3 3 18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.5-2.3M19 12.9a10 10 0 0 0-6.5-2.8"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-9.5-3.7"/><path d="M12 20h.01"/>',
  logIn: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
  stethoscope: '<path d="M4 3v6a5 5 0 0 0 10 0V3"/><path d="M4 3h2M12 3h2"/><path d="M9 14v2a5 5 0 0 0 10 0v-1.5"/><circle cx="19" cy="11" r="2.2"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flag: '<path d="M4 22V4h9l1 2h6v10h-7l-1-2H4"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 9.5 6 2h12l-2.5 7.5"/><path d="m12 12 .9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.2l2.1-.3Z"/>',
  notebook: '<path d="M4 4a2 2 0 0 1 2-2h13v20H6a2 2 0 0 1-2-2Z"/><path d="M8 2v20M12 7h4M12 11h4"/>',
  gauge: '<path d="M12 14 15.5 9"/><path d="M3.5 18a9 9 0 1 1 17 0"/><circle cx="12" cy="14" r="1.4"/>',
  graduation: '<path d="M2 8.5 12 4l10 4.5-10 4.5Z"/><path d="M6 10.7V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.3"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7L11.5 6"/><path d="M14 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7L12.5 18"/>',
  key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 8.5-8.5M15.5 7.5 18 10M13 10l2.5 2.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  moreVertical: '<circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/>',
  hourglass: '<path d="M7 3h10M7 21h10"/><path d="M17 3v3.5c0 2-3 3.7-3 5.5s3 3.5 3 5.5V21M7 3v3.5c0 2 3 3.7 3 5.5s-3 3.5-3 5.5V21"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 6-2 6s4.5-.5 6-2a3 3 0 0 0-4-4Z"/><path d="M14.5 12.5 11 9l3-4a8 8 0 0 1 7-4 8 8 0 0 1-4 7Z"/><path d="M11 9 7 10l-2 3 3 3 3-2 1-4"/>',
  bellRing: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10.5 19a1.8 1.8 0 0 0 3 0"/><path d="M2.5 6.5A6 6 0 0 1 5 2M21.5 6.5A6 6 0 0 0 19 2"/>',
  chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3.6" height="7" rx="1"/><rect x="10.2" y="6" width="3.6" height="12" rx="1"/><rect x="15.4" y="14" width="3.6" height="4" rx="1"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9Z"/><path d="M15 3.6A9 9 0 0 1 20.4 9H15Z"/>',
  moveRight: '<path d="M4 12h16m-5-5 5 5-5 5"/>',
  sortDesc: '<path d="M4 6h10M4 12h7M4 18h4"/><path d="M17 5v13m0 0 3-3m-3 3-3-3"/>',
  waves: '<path d="M2 8c2 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 14c2 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 20c2 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="14" width="4.5" height="7" rx="2"/><rect x="17" y="14" width="4.5" height="7" rx="2"/>',
  coffee: '<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 2v3M11 2v3"/>',
  gridDots: '<path d="M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01"/>',
  gridIso: '<path d="M3 8h18M3 16h18M8 3l8 18M16 3 8 21"/>',
  gridSquare: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
};

export type IconName = keyof typeof I;

interface Props {
  name: IconName | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.75, fill = false, style }: Props) {
  const body = I[name] ?? I.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
