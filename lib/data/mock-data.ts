import { Academy, Dancer, HistoryLog, ClassInfo, User } from '@/types';

export const USER: User = {
  name: "DancingQueen",
  level: "VIP Member",
  tickets: 3,
  savedAcademies: [1, 2],
  savedDancers: [101, 103]
};

export const BANNERS = [
  { id: 1, title: "NEW CLASS OPEN", subtitle: "JustJerk Academy 15th Anniv.", color: "from-purple-600 to-blue-600" },
  { id: 2, title: "DANCER OF THE MONTH", subtitle: "Learn Hip-hop with Bada Lee", color: "from-pink-600 to-orange-600" },
  { id: 3, title: "ONLY FOR BEGINNERS", subtitle: "Start your first step with 1M", color: "from-green-600 to-teal-600" },
];

export const ACADEMIES: Academy[] = [
  { 
    id: 1, name: "JustJerk Academy", branch: "Hapjeong", 
    tags: ["Hip-hop", "Choreography"], dist: "1.2km", rating: 4.9, 
    price: 35000, badges: ["주차가능", "촬영가능"],
    img: "bg-neutral-800" 
  },
  { 
    id: 2, name: "1MILLION Dance", branch: "Seongsu", 
    tags: ["K-POP", "Jazz"], dist: "3.5km", rating: 4.8, 
    price: 40000, badges: ["탈의실", "라운지"],
    img: "bg-neutral-800" 
  },
  { 
    id: 3, name: "YGX Academy", branch: "Hongdae", 
    tags: ["K-POP", "Street"], dist: "0.8km", rating: 4.7, 
    price: 30000, badges: ["촬영가능"],
    img: "bg-neutral-800" 
  },
];

export const DANCERS: Dancer[] = [
  { id: 101, name: "BADA LEE", crew: "BEBE", genre: "CHOREO", followers: "2.1M", img: "bg-pink-600" },
  { id: 102, name: "J HO", crew: "JustJerk", genre: "HIPHOP", followers: "890K", img: "bg-blue-600" },
  { id: 103, name: "LIA KIM", crew: "1MILLION", genre: "POPPING", followers: "1.5M", img: "bg-purple-600" },
  { id: 104, name: "REDY", crew: "HolyBang", genre: "GIRLISH", followers: "560K", img: "bg-red-500" },
  { id: 105, name: "VATA", crew: "WeDemBoyz", genre: "CHOREO", followers: "1.2M", img: "bg-green-600" },
  { id: 106, name: "MINJI", crew: "Team A", genre: "K-POP", followers: "120K", img: "bg-yellow-500" },
];

export const HISTORY_LOGS: HistoryLog[] = [
  { id: 1, date: "2025.12.28", class: "K-POP Beginner", instructor: "MINJI", studio: "JustJerk", status: "ATTENDED" },
  { id: 2, date: "2025.12.20", class: "Hip-hop Basic", instructor: "J HO", studio: "JustJerk", status: "ATTENDED" },
  { id: 3, date: "2025.12.15", class: "Choreography", instructor: "BADA LEE", studio: "JustJerk", status: "ABSENT" },
];

export const TIME_SLOTS = ["18:00", "19:30", "21:00"];
export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const GRID_SCHEDULE: Record<string, ClassInfo[]> = {
  "MON": [
    { id: 101, instructor: "MINJI", genre: "K-POP", level: "Beginner", status: "AVAILABLE", song: "NewJeans - ETA" },
    { id: 102, instructor: "J HO", genre: "HIPHOP", level: "Master", status: "ALMOST_FULL", song: "Kendrick - DNA" },
    { id: 103, instructor: "BADA", genre: "CHOREO", level: "Master", status: "FULL", song: "Original" }
  ],
  "TUE": [
    { id: 201, instructor: "REDY", genre: "GIRLISH", level: "All Level", status: "AVAILABLE", song: "Beyonce - Heated" },
    { id: 202, instructor: "HOWL", genre: "HIPHOP", level: "Beginner", status: "AVAILABLE", song: "Chris Brown - Iffy" },
    { id: 203, instructor: "ROOT", genre: "KRUMP", level: "Master", status: "AVAILABLE", song: "Heavy Bass" }
  ],
  "WED": [
    { id: 301, instructor: "LI A", genre: "POPPING", level: "Beginner", status: "AVAILABLE", song: "Bruno Mars - 24K" },
    { id: 302, instructor: "YOUNG J", genre: "CHOREO", level: "Master", status: "FULL", song: "JustJerk Anthem" },
    { id: 303, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" }
  ],
  "THU": [
     { id: 401, instructor: "YELL", genre: "GAMBLER", level: "All Level", status: "AVAILABLE", song: "B-Boy Mix" },
     { id: 402, instructor: "MINJI", genre: "K-POP", level: "Beginner", status: "ALMOST_FULL", song: "IVE - Baddie" },
     { id: 403, instructor: "J HO", genre: "HIPHOP", level: "Master", status: "FULL", song: "Kendrick - Humble" }
  ],
  "FRI": [
     { id: 501, instructor: "BEBE", genre: "K-POP", level: "All Level", status: "AVAILABLE", song: "Smoke" },
     { id: 502, instructor: "BADA", genre: "CHOREO", level: "Master", status: "FULL", song: "Kai - Rover" },
     { id: 503, instructor: "PARTY", genre: "FREESTYLE", level: "All Level", status: "AVAILABLE", song: "DJ Set" }
  ],
  "SAT": [
     { id: 601, instructor: "WORKSHOP", genre: "SPECIAL", level: "Open", status: "AVAILABLE", song: "Special Guest" },
     { id: 602, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 603, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" }
  ],
  "SUN": [
     { id: 701, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 702, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" },
     { id: 703, instructor: "-", genre: "-", level: "-", status: "NONE", song: "-" }
  ]
};

