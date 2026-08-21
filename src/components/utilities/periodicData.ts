/**
 * The periodic table, in the app rather than in another tab.
 *
 * Stored as tuples instead of objects: 118 rows of named fields would be four
 * times the bytes for exactly the same information, and this file ships with
 * every load so it can work with the plane in flight mode.
 *
 * Fields: atomic number, symbol, Bulgarian name, atomic mass, category,
 * group, period, electronegativity (Pauling), melting point (K), boiling
 * point (K), electron configuration.
 */

export type ElementCategory =
  | 'alkali'
  | 'alkaline'
  | 'transition'
  | 'postTransition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble'
  | 'lanthanide'
  | 'actinide';

export type ElementTuple = [
  number, string, string, number, ElementCategory, number, number,
  number | null, number | null, number | null, string,
];

export interface ChemElement {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  category: ElementCategory;
  group: number;
  period: number;
  electronegativity: number | null;
  melt: number | null;
  boil: number | null;
  config: string;
}

const RAW: ElementTuple[] = [
  [1,'H','Водород',1.008,'nonmetal',1,1,2.2,13.99,20.27,'1s1'],
  [2,'He','Хелий',4.0026,'noble',18,1,null,0.95,4.22,'1s2'],
  [3,'Li','Литий',6.94,'alkali',1,2,0.98,453.65,1603,'[He] 2s1'],
  [4,'Be','Берилий',9.0122,'alkaline',2,2,1.57,1560,2742,'[He] 2s2'],
  [5,'B','Бор',10.81,'metalloid',13,2,2.04,2349,4200,'[He] 2s2 2p1'],
  [6,'C','Въглерод',12.011,'nonmetal',14,2,2.55,3823,4300,'[He] 2s2 2p2'],
  [7,'N','Азот',14.007,'nonmetal',15,2,3.04,63.15,77.36,'[He] 2s2 2p3'],
  [8,'O','Кислород',15.999,'nonmetal',16,2,3.44,54.36,90.2,'[He] 2s2 2p4'],
  [9,'F','Флуор',18.998,'halogen',17,2,3.98,53.53,85.03,'[He] 2s2 2p5'],
  [10,'Ne','Неон',20.18,'noble',18,2,null,24.56,27.07,'[He] 2s2 2p6'],
  [11,'Na','Натрий',22.99,'alkali',1,3,0.93,370.87,1156,'[Ne] 3s1'],
  [12,'Mg','Магнезий',24.305,'alkaline',2,3,1.31,923,1363,'[Ne] 3s2'],
  [13,'Al','Алуминий',26.982,'postTransition',13,3,1.61,933.47,2792,'[Ne] 3s2 3p1'],
  [14,'Si','Силиций',28.085,'metalloid',14,3,1.9,1687,3538,'[Ne] 3s2 3p2'],
  [15,'P','Фосфор',30.974,'nonmetal',15,3,2.19,317.3,553.65,'[Ne] 3s2 3p3'],
  [16,'S','Сяра',32.06,'nonmetal',16,3,2.58,388.36,717.87,'[Ne] 3s2 3p4'],
  [17,'Cl','Хлор',35.45,'halogen',17,3,3.16,171.65,239.11,'[Ne] 3s2 3p5'],
  [18,'Ar','Аргон',39.948,'noble',18,3,null,83.8,87.3,'[Ne] 3s2 3p6'],
  [19,'K','Калий',39.098,'alkali',1,4,0.82,336.53,1032,'[Ar] 4s1'],
  [20,'Ca','Калций',40.078,'alkaline',2,4,1.0,1115,1757,'[Ar] 4s2'],
  [21,'Sc','Скандий',44.956,'transition',3,4,1.36,1814,3109,'[Ar] 3d1 4s2'],
  [22,'Ti','Титан',47.867,'transition',4,4,1.54,1941,3560,'[Ar] 3d2 4s2'],
  [23,'V','Ванадий',50.942,'transition',5,4,1.63,2183,3680,'[Ar] 3d3 4s2'],
  [24,'Cr','Хром',51.996,'transition',6,4,1.66,2180,2944,'[Ar] 3d5 4s1'],
  [25,'Mn','Манган',54.938,'transition',7,4,1.55,1519,2334,'[Ar] 3d5 4s2'],
  [26,'Fe','Желязо',55.845,'transition',8,4,1.83,1811,3134,'[Ar] 3d6 4s2'],
  [27,'Co','Кобалт',58.933,'transition',9,4,1.88,1768,3200,'[Ar] 3d7 4s2'],
  [28,'Ni','Никел',58.693,'transition',10,4,1.91,1728,3186,'[Ar] 3d8 4s2'],
  [29,'Cu','Мед',63.546,'transition',11,4,1.9,1357.77,2835,'[Ar] 3d10 4s1'],
  [30,'Zn','Цинк',65.38,'transition',12,4,1.65,692.88,1180,'[Ar] 3d10 4s2'],
  [31,'Ga','Галий',69.723,'postTransition',13,4,1.81,302.91,2477,'[Ar] 3d10 4s2 4p1'],
  [32,'Ge','Германий',72.63,'metalloid',14,4,2.01,1211.4,3106,'[Ar] 3d10 4s2 4p2'],
  [33,'As','Арсен',74.922,'metalloid',15,4,2.18,1090,887,'[Ar] 3d10 4s2 4p3'],
  [34,'Se','Селен',78.971,'nonmetal',16,4,2.55,494,958,'[Ar] 3d10 4s2 4p4'],
  [35,'Br','Бром',79.904,'halogen',17,4,2.96,265.8,332,'[Ar] 3d10 4s2 4p5'],
  [36,'Kr','Криптон',83.798,'noble',18,4,3.0,115.79,119.93,'[Ar] 3d10 4s2 4p6'],
  [37,'Rb','Рубидий',85.468,'alkali',1,5,0.82,312.46,961,'[Kr] 5s1'],
  [38,'Sr','Стронций',87.62,'alkaline',2,5,0.95,1050,1655,'[Kr] 5s2'],
  [39,'Y','Итрий',88.906,'transition',3,5,1.22,1799,3609,'[Kr] 4d1 5s2'],
  [40,'Zr','Цирконий',91.224,'transition',4,5,1.33,2128,4682,'[Kr] 4d2 5s2'],
  [41,'Nb','Ниобий',92.906,'transition',5,5,1.6,2750,5017,'[Kr] 4d4 5s1'],
  [42,'Mo','Молибден',95.95,'transition',6,5,2.16,2896,4912,'[Kr] 4d5 5s1'],
  [43,'Tc','Технеций',98,'transition',7,5,1.9,2430,4538,'[Kr] 4d5 5s2'],
  [44,'Ru','Рутений',101.07,'transition',8,5,2.2,2607,4423,'[Kr] 4d7 5s1'],
  [45,'Rh','Родий',102.91,'transition',9,5,2.28,2237,3968,'[Kr] 4d8 5s1'],
  [46,'Pd','Паладий',106.42,'transition',10,5,2.2,1828.05,3236,'[Kr] 4d10'],
  [47,'Ag','Сребро',107.87,'transition',11,5,1.93,1234.93,2435,'[Kr] 4d10 5s1'],
  [48,'Cd','Кадмий',112.41,'transition',12,5,1.69,594.22,1040,'[Kr] 4d10 5s2'],
  [49,'In','Индий',114.82,'postTransition',13,5,1.78,429.75,2345,'[Kr] 4d10 5s2 5p1'],
  [50,'Sn','Калай',118.71,'postTransition',14,5,1.96,505.08,2875,'[Kr] 4d10 5s2 5p2'],
  [51,'Sb','Антимон',121.76,'metalloid',15,5,2.05,903.78,1860,'[Kr] 4d10 5s2 5p3'],
  [52,'Te','Телур',127.6,'metalloid',16,5,2.1,722.66,1261,'[Kr] 4d10 5s2 5p4'],
  [53,'I','Йод',126.9,'halogen',17,5,2.66,386.85,457.4,'[Kr] 4d10 5s2 5p5'],
  [54,'Xe','Ксенон',131.29,'noble',18,5,2.6,161.4,165.03,'[Kr] 4d10 5s2 5p6'],
  [55,'Cs','Цезий',132.91,'alkali',1,6,0.79,301.59,944,'[Xe] 6s1'],
  [56,'Ba','Барий',137.33,'alkaline',2,6,0.89,1000,2170,'[Xe] 6s2'],
  [57,'La','Лантан',138.91,'lanthanide',3,6,1.1,1193,3737,'[Xe] 5d1 6s2'],
  [58,'Ce','Церий',140.12,'lanthanide',4,6,1.12,1068,3716,'[Xe] 4f1 5d1 6s2'],
  [59,'Pr','Празеодим',140.91,'lanthanide',5,6,1.13,1208,3793,'[Xe] 4f3 6s2'],
  [60,'Nd','Неодим',144.24,'lanthanide',6,6,1.14,1297,3347,'[Xe] 4f4 6s2'],
  [61,'Pm','Прометий',145,'lanthanide',7,6,1.13,1315,3273,'[Xe] 4f5 6s2'],
  [62,'Sm','Самарий',150.36,'lanthanide',8,6,1.17,1345,2067,'[Xe] 4f6 6s2'],
  [63,'Eu','Европий',151.96,'lanthanide',9,6,1.2,1099,1802,'[Xe] 4f7 6s2'],
  [64,'Gd','Гадолиний',157.25,'lanthanide',10,6,1.2,1585,3546,'[Xe] 4f7 5d1 6s2'],
  [65,'Tb','Тербий',158.93,'lanthanide',11,6,1.2,1629,3503,'[Xe] 4f9 6s2'],
  [66,'Dy','Диспрозий',162.5,'lanthanide',12,6,1.22,1680,2840,'[Xe] 4f10 6s2'],
  [67,'Ho','Холмий',164.93,'lanthanide',13,6,1.23,1734,2993,'[Xe] 4f11 6s2'],
  [68,'Er','Ербий',167.26,'lanthanide',14,6,1.24,1802,3141,'[Xe] 4f12 6s2'],
  [69,'Tm','Тулий',168.93,'lanthanide',15,6,1.25,1818,2223,'[Xe] 4f13 6s2'],
  [70,'Yb','Итербий',173.05,'lanthanide',16,6,1.1,1097,1469,'[Xe] 4f14 6s2'],
  [71,'Lu','Лутеций',174.97,'lanthanide',17,6,1.27,1925,3675,'[Xe] 4f14 5d1 6s2'],
  [72,'Hf','Хафний',178.49,'transition',4,6,1.3,2506,4876,'[Xe] 4f14 5d2 6s2'],
  [73,'Ta','Тантал',180.95,'transition',5,6,1.5,3290,5731,'[Xe] 4f14 5d3 6s2'],
  [74,'W','Волфрам',183.84,'transition',6,6,2.36,3695,5828,'[Xe] 4f14 5d4 6s2'],
  [75,'Re','Рений',186.21,'transition',7,6,1.9,3459,5869,'[Xe] 4f14 5d5 6s2'],
  [76,'Os','Осмий',190.23,'transition',8,6,2.2,3306,5285,'[Xe] 4f14 5d6 6s2'],
  [77,'Ir','Иридий',192.22,'transition',9,6,2.2,2719,4701,'[Xe] 4f14 5d7 6s2'],
  [78,'Pt','Платина',195.08,'transition',10,6,2.28,2041.4,4098,'[Xe] 4f14 5d9 6s1'],
  [79,'Au','Злато',196.97,'transition',11,6,2.54,1337.33,3129,'[Xe] 4f14 5d10 6s1'],
  [80,'Hg','Живак',200.59,'transition',12,6,2.0,234.32,629.88,'[Xe] 4f14 5d10 6s2'],
  [81,'Tl','Талий',204.38,'postTransition',13,6,1.62,577,1746,'[Xe] 4f14 5d10 6s2 6p1'],
  [82,'Pb','Олово',207.2,'postTransition',14,6,2.33,600.61,2022,'[Xe] 4f14 5d10 6s2 6p2'],
  [83,'Bi','Бисмут',208.98,'postTransition',15,6,2.02,544.7,1837,'[Xe] 4f14 5d10 6s2 6p3'],
  [84,'Po','Полоний',209,'postTransition',16,6,2.0,527,1235,'[Xe] 4f14 5d10 6s2 6p4'],
  [85,'At','Астат',210,'metalloid',17,6,2.2,575,610,'[Xe] 4f14 5d10 6s2 6p5'],
  [86,'Rn','Радон',222,'noble',18,6,2.2,202,211.3,'[Xe] 4f14 5d10 6s2 6p6'],
  [87,'Fr','Франций',223,'alkali',1,7,0.7,300,950,'[Rn] 7s1'],
  [88,'Ra','Радий',226,'alkaline',2,7,0.9,973,2010,'[Rn] 7s2'],
  [89,'Ac','Актиний',227,'actinide',3,7,1.1,1323,3471,'[Rn] 6d1 7s2'],
  [90,'Th','Торий',232.04,'actinide',4,7,1.3,2115,5061,'[Rn] 6d2 7s2'],
  [91,'Pa','Протактиний',231.04,'actinide',5,7,1.5,1841,4300,'[Rn] 5f2 6d1 7s2'],
  [92,'U','Уран',238.03,'actinide',6,7,1.38,1405.3,4404,'[Rn] 5f3 6d1 7s2'],
  [93,'Np','Нептуний',237,'actinide',7,7,1.36,917,4273,'[Rn] 5f4 6d1 7s2'],
  [94,'Pu','Плутоний',244,'actinide',8,7,1.28,912.5,3501,'[Rn] 5f6 7s2'],
  [95,'Am','Америций',243,'actinide',9,7,1.3,1449,2880,'[Rn] 5f7 7s2'],
  [96,'Cm','Кюрий',247,'actinide',10,7,1.3,1613,3383,'[Rn] 5f7 6d1 7s2'],
  [97,'Bk','Берклий',247,'actinide',11,7,1.3,1259,2900,'[Rn] 5f9 7s2'],
  [98,'Cf','Калифорний',251,'actinide',12,7,1.3,1173,1743,'[Rn] 5f10 7s2'],
  [99,'Es','Айнщайний',252,'actinide',13,7,1.3,1133,1269,'[Rn] 5f11 7s2'],
  [100,'Fm','Фермий',257,'actinide',14,7,1.3,1800,null,'[Rn] 5f12 7s2'],
  [101,'Md','Менделеевий',258,'actinide',15,7,1.3,1100,null,'[Rn] 5f13 7s2'],
  [102,'No','Нобелий',259,'actinide',16,7,1.3,1100,null,'[Rn] 5f14 7s2'],
  [103,'Lr','Лоуренсий',266,'actinide',17,7,1.3,1900,null,'[Rn] 5f14 7s2 7p1'],
  [104,'Rf','Ръдърфордий',267,'transition',4,7,null,2400,5800,'[Rn] 5f14 6d2 7s2'],
  [105,'Db','Дубний',268,'transition',5,7,null,null,null,'[Rn] 5f14 6d3 7s2'],
  [106,'Sg','Сиборгий',269,'transition',6,7,null,null,null,'[Rn] 5f14 6d4 7s2'],
  [107,'Bh','Бории',270,'transition',7,7,null,null,null,'[Rn] 5f14 6d5 7s2'],
  [108,'Hs','Хасий',269,'transition',8,7,null,null,null,'[Rn] 5f14 6d6 7s2'],
  [109,'Mt','Майтнерий',278,'transition',9,7,null,null,null,'[Rn] 5f14 6d7 7s2'],
  [110,'Ds','Дармщатий',281,'transition',10,7,null,null,null,'[Rn] 5f14 6d9 7s1'],
  [111,'Rg','Рьонтгений',282,'transition',11,7,null,null,null,'[Rn] 5f14 6d10 7s1'],
  [112,'Cn','Коперниций',285,'transition',12,7,null,283,340,'[Rn] 5f14 6d10 7s2'],
  [113,'Nh','Нихоний',286,'postTransition',13,7,null,700,1430,'[Rn] 5f14 6d10 7s2 7p1'],
  [114,'Fl','Флеровий',289,'postTransition',14,7,null,340,420,'[Rn] 5f14 6d10 7s2 7p2'],
  [115,'Mc','Московий',290,'postTransition',15,7,null,700,1400,'[Rn] 5f14 6d10 7s2 7p3'],
  [116,'Lv','Ливърморий',293,'postTransition',16,7,null,709,1085,'[Rn] 5f14 6d10 7s2 7p4'],
  [117,'Ts','Тенесин',294,'halogen',17,7,null,723,883,'[Rn] 5f14 6d10 7s2 7p5'],
  [118,'Og','Оганесон',294,'noble',18,7,null,325,450,'[Rn] 5f14 6d10 7s2 7p6'],
];

export const ELEMENTS: ChemElement[] = RAW.map((r) => ({
  z: r[0],
  symbol: r[1],
  name: r[2],
  mass: r[3],
  category: r[4],
  group: r[5],
  period: r[6],
  electronegativity: r[7],
  melt: r[8],
  boil: r[9],
  config: r[10],
}));

export const CATEGORY_LABEL: Record<ElementCategory, string> = {
  alkali: 'Алкални метали',
  alkaline: 'Алкалоземни метали',
  transition: 'Преходни метали',
  postTransition: 'Следпреходни метали',
  metalloid: 'Металоиди',
  nonmetal: 'Неметали',
  halogen: 'Халогени',
  noble: 'Благородни газове',
  lanthanide: 'Лантаноиди',
  actinide: 'Актиноиди',
};

/** Hues that stay legible on both a white and a near-black background. */
export const CATEGORY_COLOR: Record<ElementCategory, string> = {
  alkali: '#f97316',
  alkaline: '#eab308',
  transition: '#38bdf8',
  postTransition: '#22d3ee',
  metalloid: '#34d399',
  nonmetal: '#4ade80',
  halogen: '#a3e635',
  noble: '#c084fc',
  lanthanide: '#f472b6',
  actinide: '#fb7185',
};

/** Room temperature, 293 K — the state a student sees in the lab. */
export function stateAt(el: ChemElement, kelvin = 293.15): 'solid' | 'liquid' | 'gas' | 'unknown' {
  if (el.melt === null) return 'unknown';
  if (kelvin < el.melt) return 'solid';
  if (el.boil === null || kelvin < el.boil) return 'liquid';
  return 'gas';
}

export const STATE_LABEL: Record<string, string> = {
  solid: 'твърдо',
  liquid: 'течно',
  gas: 'газ',
  unknown: 'неизвестно',
};

/** Kelvin → Celsius, for the detail card. */
export const toCelsius = (k: number | null): string =>
  k === null ? '—' : `${Math.round((k - 273.15) * 10) / 10} °C`;

/**
 * Where a cell sits in the 18-column layout. Lanthanides and actinides get
 * their own two rows underneath, which is how every textbook prints them.
 */
export function cellPosition(el: ChemElement): { col: number; row: number } {
  if (el.category === 'lanthanide') return { col: el.z - 57 + 3, row: 9 };
  if (el.category === 'actinide') return { col: el.z - 89 + 3, row: 10 };
  return { col: el.group, row: el.period };
}

export function findElements(query: string): ChemElement[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ELEMENTS.filter(
    (e) =>
      e.symbol.toLowerCase() === q ||
      String(e.z) === q ||
      e.name.toLowerCase().startsWith(q) ||
      e.symbol.toLowerCase().startsWith(q),
  ).slice(0, 8);
}
