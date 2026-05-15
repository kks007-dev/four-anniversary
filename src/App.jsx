import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const START_HOUR       = 8;
const START_MIN        = 0;
const INTERVAL_MINUTES = 60;
const YOUR_NAME        = "Krish";

// ─── SECURITY ────────────────────────────────────────────────────────────────
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}
function normalizeAnswer(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "'")
    .replace(/[^A-Z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One or more accepted spellings → hash list for checkAnswer */
const accept = (...variants) => {
  const seen = new Set();
  const hashes = [];
  for (const v of variants) {
    const n = normalizeAnswer(v);
    if (!n) continue;
    for (const form of [n, n.replace(/\s/g, "")]) {
      if (!form) continue;
      const h = djb2(form);
      if (!seen.has(h)) {
        seen.add(h);
        hashes.push(h);
      }
    }
  }
  return hashes;
};

const checkAnswer = (input, expected) => {
  const hashes = Array.isArray(expected) ? expected : [expected];
  const n = normalizeAnswer(input);
  if (!n || !hashes.length) return false;
  return [n, n.replace(/\s/g, "")].some(form => hashes.includes(djb2(form)));
};
const encodeState = obj => { try { return btoa(JSON.stringify(obj)); } catch { return ""; } };
const decodeState = str => { try { return JSON.parse(atob(str)); } catch { return {}; } };
const STORE_KEY = "_us_v5";
const loadState = () => { try { return decodeState(localStorage.getItem(STORE_KEY) || ""); } catch { return {}; } };
const saveState = s => { try { localStorage.setItem(STORE_KEY, encodeState(s)); } catch {} };

const DIFFICULTIES = ["easy", "medium", "hard"];
const scoreKey = (gid, diff) => `${gid}_${diff}`;
const normalizeScores = (scores) => {
  if (!scores) return {};
  const out = { ...scores };
  for (const [k, v] of Object.entries(scores)) {
    if (!/^\d+$/.test(k)) continue;
    const hasSuffix = DIFFICULTIES.some(d => out[scoreKey(k, d)] !== undefined);
    if (hasSuffix) {
      delete out[k];
    } else {
      out[scoreKey(k, "easy")] = v;
      delete out[k];
    }
  }
  return out;
};
const isDifficultyScored = (scores, gid, diff) => (scores || {})[scoreKey(gid, diff)] !== undefined;
const gameProgress = (scores, gid) => {
  const s = scores || {};
  const done = DIFFICULTIES.filter(d => s[scoreKey(gid, d)] !== undefined).length;
  return { done, total: DIFFICULTIES.length };
};
const isGameFullyComplete = (scores, gid) => gameProgress(scores, gid).done === DIFFICULTIES.length;
const gameTotalPts = (scores, gid) =>
  DIFFICULTIES.reduce((sum, d) => sum + ((scores || {})[scoreKey(gid, d)] || 0), 0);

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── TIME ────────────────────────────────────────────────────────────────────
function getUnlockDate(idx) {
  const tot = START_HOUR * 60 + START_MIN + idx * INTERVAL_MINUTES;
  const d = new Date(); d.setHours(Math.floor(tot/60)%24, tot%60, 0, 0); return d;
}
const isUnlocked = idx => new Date() >= getUnlockDate(idx);

// Secret test mode, not linked in the UI for players. See README / dev note for URL.
const DEV_QUERY_VALUES = new Set(["krish", "1", "true", "test"]);

function readDevFromUrl() {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  const v = (q.get("dev") || "").trim().toLowerCase();
  if (DEV_QUERY_VALUES.has(v)) return true;
  if (window.location.hash === "#dev") return true;
  return sessionStorage.getItem("_us_dev") === "1";
}

function activateDevMode() {
  sessionStorage.setItem("_us_dev", "1");
  sessionStorage.setItem("_pin_ok", "1");
}

function deactivateDevMode() {
  sessionStorage.removeItem("_us_dev");
}
function fmtTime(date) {
  let h=date.getHours(), m=date.getMinutes(), ap=h>=12?"PM":"AM"; h=h%12||12;
  return `${h}:${m.toString().padStart(2,"0")} ${ap}`;
}
function timeRemaining(idx) {
  const diff = getUnlockDate(idx) - new Date(); if(diff<=0) return null;
  return { h:Math.floor(diff/3600000), m:Math.floor((diff%3600000)/60000), s:Math.floor((diff%60000)/1000) };
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg:"#0d0917", bgCard:"#150b28", bgDeep:"#09060f", border:"#2a1c47",
  primary:"#c084fc", primaryDim:"#7c3aed", accent:"#f0abfc", accentSoft:"#e879f9",
  rose:"#fb7185", mint:"#6ee7b7", gold:"#fde68a",
  text:"#ede9fe", textSub:"#a78bfa", textMuted:"#6d5fa0", textDim:"#3a2660",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Quicksand:wght@400;500;600;700&family=Pacifico&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:${T.bg};color:${T.text};font-family:'Quicksand',sans-serif;-webkit-tap-highlight-color:transparent;}
  input,button{font-family:'Quicksand',sans-serif;}
  input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
  .ns{user-select:none;-webkit-user-select:none;}

  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes popIn{0%{opacity:0;transform:scale(0.82);}70%{transform:scale(1.06);}100%{opacity:1;transform:scale(1);}}
  @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
  @keyframes heartbeat{0%,100%{transform:scale(1);}14%{transform:scale(1.2);}28%{transform:scale(1);}42%{transform:scale(1.1);}70%{transform:scale(1);}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-16px);}to{opacity:1;transform:translateX(0);}}
  @keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-7px);}75%{transform:translateX(7px);}}
  @keyframes unlockPop{0%{transform:scale(0.9);}70%{transform:scale(1.03);}100%{transform:scale(1);}}
  @keyframes tileReveal{0%{transform:scaleY(1);}50%{transform:scaleY(0);}100%{transform:scaleY(1);}}
  @keyframes groupReveal{0%{opacity:0;transform:scaleY(0.7);}100%{opacity:1;transform:scaleY(1);}}
  @keyframes oneAway{0%,100%{transform:translateX(0);}20%{transform:translateX(-4px);}40%{transform:translateX(4px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}
  @keyframes ticker{0%,100%{opacity:1;}50%{opacity:0.45;}}
  @keyframes pulse{0%,100%{opacity:0.35;transform:scale(1);}50%{opacity:1;transform:scale(1.12);}}

  .card-hover{transition:transform 0.18s,box-shadow 0.18s;}
  .card-hover:hover{transform:translateY(-2px);}
  .card-hover:active{transform:scale(0.97);}
  .btn-press:active{transform:scale(0.91);}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:${T.bgDeep};}
  ::-webkit-scrollbar-thumb{background:${T.primaryDim};border-radius:4px;}
  .glow-text{
    background:linear-gradient(135deg,${T.accent} 0%,${T.primary} 45%,${T.accentSoft} 100%);
    background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
    background-clip:text;animation:shimmer 3.5s linear infinite;
  }
`;

// ─── GAME DATA ────────────────────────────────────────────────────────────────
// RULE: zero overlapping facts across all 15 games. Each memory lives in exactly one game.
// Wordle: stores PLAINTEXT word, only ever in memory (useRef), never in localStorage.
// Typed-answer games use accept(...) so spacing/caps/punctuation don't matter.

const GAMES = [
  // 1. WORDLE 8am
  // Topic: the exact word from their story. Each difficulty = different word, zero overlap.
  {
    id:1, type:"wordle", emoji:"📐", title:"Word of Us",
    unlockLabel:"8:00 AM",
    teaser:"Guess the 5-letter word. It means something.",
    howToPlay:[
      "Type a 5-letter guess and press Enter.",
      "🟩 Green = right letter, right spot.",
      "🟨 Yellow = right letter, wrong spot.",
      "⬜ Gray = letter not in the word.",
      "The hint connects to your story, use it!",
    ],
    data:{
      easy:  { word:"LAUGH", len:5, hint:'What you two do most together 😂' },
      medium:{ word:"PROOF", len:5, hint:'The geometry thing that tortured you both 📐' },
      hard:  { word:"DANCE", len:5, hint:'What brought you onto the same team 💃' },
    },
  },
  // 2. CONNECTIONS 9am
  // Topic: four clean, non-overlapping groups, each item unique across all groups
  {
    id:2, type:"connections", emoji:"🔗", title:"Our Connections",
    unlockLabel:"9:00 AM",
    teaser:"Sort 16 words into 4 groups. No overlaps, trust your gut.",
    howToPlay:[
      "Pick 4 items you think belong in the same group.",
      "Tap Submit. If correct, the group is revealed with its color.",
      "💜 = one away! You have exactly one wrong, swap one out.",
      "4 mistakes and it's over. Think carefully before submitting.",
      "The groups all connect to our story 🥹",
    ],
    data:{
      easy:{
        groups:[
          { name:"Places we went together 📍", color:"#f472b6",
            items:["Cancun","Rice campus","Kroger lot","UH fair"] },
          { name:"Words from the confession 💜", color:"#818cf8",
            items:["Blushy","Crushy","Mhmm","Gosh"] },
          { name:"Cancun, laughs & moments 🌴", color:"#f59e0b",
            items:["A ninja","Beach","Grand Palace","Pool"] },
          { name:"Naacho shows 💃", color:"#10b981",
            items:["Miller","Dil Se Naach","Urban Nutcracker","Discovery Green"] },
        ],
      },
      medium:{
        groups:[
          { name:"How they first started talking 💬", color:"#f472b6",
            items:["Discord","Geometry","Proofs","Conditionals"] },
          { name:"Cancun bucket list 🌴", color:"#818cf8",
            items:["First kiss","Beach walk","Waterpark","Slow dancing"] },
          { name:"Senior year 2024 💜", color:"#f59e0b",
            items:["Love lock","Moon proposal","Hasini's proposal","UH fair"] },
          { name:"People in their story 👯", color:"#10b981",
            items:["Ria","Hasini","His mom","His team"] },
        ],
      },
      hard:{
        groups:[
          { name:"Jan 18, 2022: the first convo 📐", color:"#f472b6",
            items:["Step 11","Two column","Flow proofs","10:02 PM"] },
          { name:"Mar 19, 2022: the confession 💜", color:"#818cf8",
            items:["Answer is yes","Close yesterday","Fine day","Blushing now"] },
          { name:"Oct 2-5, 2025: Austin visit 🌮", color:"#f59e0b",
            items:["UT garba","Velvet Taco","Putt putt","Air hockey"] },
          { name:"Freshman year together 💜", color:"#10b981",
            items:["Jhalak weekend","Bowlero night","DDN Legends","Penn Dhamaka"] },
        ],
      },
    },
  },
  // 3. TRIVIA (How Well Do You Know Us) 10am
  // Topic: your story together, dates, places, us things. Krish career facts live in game 14 only if needed.
  {
    id:3, type:"trivia", emoji:"💑", title:"How Well Do You Know Us?",
    unlockLabel:"10:00 AM",
    teaser:"Our story. Shared memories. Real ones.",
    howToPlay:[
      "Tap one of four answers, no typing on this one.",
      "Green = correct ✅   Red = wrong ❌",
      "Next question loads automatically after your pick.",
      "More points for harder difficulties.",
    ],
    data:{
      easy:[
        { q:"How did you two first start talking?",
          options:["Instagram DM","Discord, geometry","In person at school","Game Pigeon"], a:1 },
        { q:"What dance team did you both join?",
          options:["Raas","Fusion","Naacho","Bhangra"], a:2 },
        { q:"Where was your first trip together?",
          options:["Cancun","Beaumont","Austin","Galveston"], a:0 },
        { q:"What day was the confession?",
          options:["Feb 14, 2022","Mar 19, 2022","Jun 19, 2022","Jan 18, 2022"], a:1 },
        { q:"What was your prom color?",
          options:["Purple","Green","Blue","Gold"], a:1 },
      ],
      medium:[
        { q:"When was prom?",
          options:["April 5, 2024","April 5, 2025","May 15, 2025","March 19, 2025"], a:1 },
        { q:"What was your Sept 24, 2024 Hoco color?",
          options:["Green","Purple","Blue","Gold"], a:1 },
        { q:"When did he get you the love lock?",
          options:["July 2024","Aug 23, 2024","Sept 20, 2024","Nov 8, 2024"], a:1 },
        { q:"What was his hoco proposal theme?",
          options:["Stars","Moon","Sunset","Garden"], a:1 },
        { q:"First movie on the bucket list, what did you watch?",
          options:["Encanto","Minions","Turning Red","Luca"], a:1 },
      ],
      hard:[
        { q:"When was his moon-themed hoco proposal?",
          options:["Sept 20, 2024","Sept 21, 2024","Sept 24, 2024","Oct 28, 2023"], a:1 },
        { q:"Summer 2024: Fort Bend Transit ran between…",
          options:["Rice & downtown","UH Sugarland & Methodist","TAMU & Austin","Home & school"], a:1 },
        { q:"Senior year, where did you drive to hang out and talk?",
          options:["The mall","The parking lot near Kroger","Behind school","A gas station"], a:1 },
        { q:"Nov 8, 2024: where did you meet up?",
          options:["Rice","A UH fair","Miller Outdoor Theatre","The Kroger lot"], a:1 },
        { q:"His favorite photo background at Miller Outdoor Theatre?",
          options:["Sunset","Starry sky","Fireworks","Stage lights"], a:1 },
      ],
    },
  },
  // 4. EMOJI DECODER 11am
  // Topic: specific moments/places from their story. No overlap with other games.
  {
    id:4, type:"emoji", emoji:"🤩", title:"Emoji Decoder",
    unlockLabel:"11:00 AM",
    teaser:"Each emoji combo = one memory. Decode it.",
    howToPlay:[
      "Look at the emoji sequence and figure out the memory it represents.",
      "Type your answer and press Enter or Go.",
      "The hint gives you a nudge if you're stuck.",
      "Type your best guess, caps, spacing, and punctuation don't matter.",
    ],
    data:{
      easy:[
        { emojis:"🌴🏖️💋", answerHashes:accept("CANCUN"),      hint:"Their first trip together" },
        { emojis:"🚌🎭🔥", answerHashes:accept("BEAUMONT"),     hint:"A Naacho show, and that bus ride back" },
        { emojis:"🎡🌳☀️", answerHashes:accept("CARNIVAL"),     hint:"Elementary school volunteering, kinda" },
      ],
      medium:[
        { emojis:"🔒💕✨",   answerHashes:accept("LOVE LOCK", "LOVELOCK"), hint:"Aug 23, 2024: he got you one" },
        { emojis:"🌙💍🌃",   answerHashes:accept("MOON THEMED", "MOON", "MOON THEME"), hint:"Sept 21, 2024: his hoco proposal" },
        { emojis:"🚌📝🏥",   answerHashes:accept("FORT BEND TRANSIT", "FORT BEND"), hint:"Summer, bus from UH Sugarland to Methodist" },
      ],
      hard:[
        { emojis:"🅿️🛒🌙",     answerHashes:accept("KROGER PARKING LOT", "KROGER", "KROGER LOT"), hint:"Senior year, where you'd drive to talk" },
        { emojis:"💜🍚📸",     answerHashes:accept("VELVET TACO", "VELVET"), hint:"Oct visit, that Austin taco spot" },
        { emojis:"🎭⭐🌌",     answerHashes:accept("MILLER OUTDOOR THEATRE", "MILLER OUTDOOR", "MILLER"), hint:"Pre-grad show, your favorite starry pic" },
      ],
    },
  },
  // 5. MEMORY MATCH 12pm
  // Topic: pairs of icons from their story, purely visual, no textual info overlap
  {
    id:5, type:"memory", emoji:"🃏", title:"Memory Match",
    unlockLabel:"12:00 PM",
    teaser:"Flip cards. Find matching pairs. Fewest moves wins.",
    howToPlay:[
      "Tap a card to flip it over.",
      "Tap a second card to try to match it.",
      "If they match, they stay face up 💜",
      "If not, they flip back, remember where they were!",
      "Match all pairs to finish. Fewer moves = more points.",
    ],
    data:{
      easy:  { pairs:["📐","💃","🌴","💌","🤖","🎭"], size:3 },
      medium:{ pairs:["📐","💃","🌴","💌","🤖","🎭","🎄","🎡"], size:4 },
      hard:  { pairs:["📐","💃","🌴","💌","🤖","🎭","🎄","🎡","📝","🥹"], size:4 },
    },
  },
  // 6. FILL THE LYRICS 1pm
  // Topic: songs + their actual flirty exchange from Feb 21 2022. Zero overlap with other games.
  {
    id:6, type:"lyrics", emoji:"🎵", title:"Fill the Lyrics",
    unlockLabel:"1:00 PM",
    teaser:"Songs we love + one famous Nidhi & Krish original.",
    howToPlay:[
      "Fill in the missing word for each line.",
      "The blanks connect to real songs, or real things he said.",
      "Type your answer in the box below each lyric.",
      "Caps and extra spaces are fine, if it's the right word, it counts.",
      "Submit all at once when you're done.",
      "Each correct answer = points 🎵",
    ],
    data:{
      easy:[
        { line:"Can't help falling in ___ with you",   answerHashes:accept("LOVE"),   song:"Elvis" },
        { line:"I've loved you for a thousand ___",     answerHashes:accept("YEARS"),  song:"Christina Perri" },
        { line:"All of me loves all of ___",            answerHashes:accept("YOU"),    song:"John Legend" },
      ],
      medium:[
        { line:"We found love in a ___ place",          answerHashes:accept("HOPELESS"), song:"Rihanna" },
        { line:"Tum hi ho, ab mera kya ___",             answerHashes:accept("HOGA"),     song:"Aashiqui 2" },
        { line:"Channa mereya, ___ mereya",              answerHashes:accept("CHANNA"),   song:"ADHM" },
      ],
      hard:[
        { line:"If I'm from your imagination then you must be something my mind could never ___",
                                                         answerHashes:accept("IMAGINE"),  song:"Krish, Feb 21 2022 😭" },
        { line:"Ik vaari aa, ___ mujhse milne aa",       answerHashes:accept("ROZ"),      song:"Raabta" },
        { line:"Little did they know, how ___ they'd become",
                                                         answerHashes:accept("SPECIAL"),  song:"Nidhi's poem 🥹" },
      ],
    },
  },
  // 7. SPELLING BEE 2pm
  // Topic: pure word game, no story overlap
  {
    id:7, type:"spellingbee", emoji:"🐝", title:"Spelling Bee",
    unlockLabel:"2:00 PM",
    teaser:"Make words. Center letter always required. Find the pangram.",
    howToPlay:[
      "Every word must include the CENTER letter (highlighted).",
      "Words must be at least 3 letters long.",
      "The 🌟 bonus word is the sweetest find on the hive, grab it for a big burst of points!",
      "Tap letters to build your word, then press Enter.",
      "Find all words to complete the game.",
    ],
    data:{
      easy:{   center:"L", outer:["O","V","E","Y","U","A"], words:["LOVE","VALE","OVAL","VOLE","LAVA","LOVEY"], pangram:"LOVEY" },
      medium:{ center:"E", outer:["S","H","A","R","T","L"], words:["HEART","EARTH","HASTE","SHARE","HEARS","LATER","HALTER","SLATHER"], pangram:"SLATHER" },
      hard:{   center:"A", outer:["M","N","O","R","C","H"], words:["ANCHOR","MANOR","ARCH","ROACH","MARCH","NORM","MACRON","MONARCH"], pangram:"MONARCH" },
    },
  },
  // 8. ANAGRAM 3pm
  // Topic: meaningful words from their story, different words from all other games
  {
    id:8, type:"anagram", emoji:"🔀", title:"Unscramble Us",
    unlockLabel:"3:00 PM",
    teaser:"Every scrambled word means something to us.",
    howToPlay:[
      "The letters shown spell a real word, just scrambled.",
      "Each word connects to your story in some way.",
      "Type your answer and press Enter or →",
      "Caps and spacing don't matter, same word = correct.",
      "One wrong won't end it, you get all 3 puzzles.",
    ],
    data:{
      easy:[
        { scrambled:"OAANCH",       answerHashes:accept("NAACHO"),      clue:"Your dance team" },
        { scrambled:"NUCANC",        answerHashes:accept("CANCUN"),      clue:"First trip ever 🌴" },
        { scrambled:"FEOCNOSSNI",    answerHashes:accept("CONFESSION"),  clue:"Mar 19, 2022 💜" },
      ],
      medium:[
        { scrambled:"NOOM",          answerHashes:accept("MOON"),         clue:"His hoco proposal theme 🌙" },
        { scrambled:"KCOLC",         answerHashes:accept("LOCK"),         clue:"Aug 23, 2024: love ___" },
        { scrambled:"TSITDOHEM",     answerHashes:accept("METHODIST"),     clue:"Fort Bend Transit stop (with UH Sugarland)" },
      ],
      hard:[
        { scrambled:"BEINDSRUCELI",  answerHashes:accept("INDESCRIBABLE"), clue:"What she called him" },
        { scrambled:"HTEYBIYDALKRU", answerHashes:accept("BLUSHYKRISHY"),  clue:"The phrase she used on Mar 19 😭" },
        { scrambled:"RGEBOMETY",     answerHashes:accept("GEOMETRY"),      clue:"How it all started" },
      ],
    },
  },
  // 9. TIMELINE 4pm
  // Topic: real events in order, distinct from all other games
  {
    id:9, type:"timeline", emoji:"📅", title:"Our Timeline",
    unlockLabel:"4:00 PM",
    teaser:"Drag our story into the right order.",
    howToPlay:[
      "The events are shown in RANDOM order.",
      "Use the ↑↓ arrows to move each event up or down.",
      "Put them in chronological order, earliest at top.",
      "Press 'Lock In' when you're confident.",
      "Each correct position = points. You lived it, you know this.",
    ],
    data:{
      easy:{ events:[
        { text:"First Discord convo 📐" },
        { text:"First time seeing him IRL 🤖" },
        { text:"Confession 💜" },
        { text:"Made it official 🎀" },
        { text:"Cancun 🌴" },
      ]},
      medium:{ events:[
        { text:"Summer 2024: Fort Bend Transit mornings 🚌" },
        { text:"Aug 23, 2024: Love lock 🔒" },
        { text:"Sept 20, 2024: Hasini's hoco proposal" },
        { text:"Sept 21, 2024: Moon hoco proposal 🌙" },
        { text:"Sept 24, 2024: Hoco at Rice (purple) 💜" },
        { text:"Nov 8, 2024: UH fair" },
        { text:"Miller Outdoor Theatre 🌟" },
        { text:"April 5, 2025: Prom (green) 💚" },
      ]},
      hard:{ events:[
        { text:"Jan 18 2022: Discord convo" },
        { text:"Mar 19 2022: confession" },
        { text:"Made it official" },
        { text:"Cancun 🌴" },
        { text:"Urban Nutcracker" },
        { text:"Oct 28 2023: Hoco night" },
        { text:"Late June-July 2024: Fort Bend Transit bus mornings" },
        { text:"Aug 23, 2024: Love lock" },
        { text:"Sept 20, 2024: Hasini's hoco proposal" },
        { text:"Sept 21, 2024: Moon hoco proposal" },
        { text:"Sept 24 2024: Hoco at Rice (purple)" },
        { text:"Nov 8, 2024: UH fair" },
        { text:"Miller Outdoor Theatre 2025" },
        { text:"April 5, 2025: Prom (green) 💚" },
        { text:"Sept 20-21 2025: 24 hrs + ramen & bowling" },
        { text:"Oct 2-5, UT garba & Velvet Taco" },
        { text:"Oct 18-19, A&M garba" },
        { text:"Oct 30-Nov 2, Halloweekend 🎃" },
        { text:"Feb 13-16, Valentine's & Jhalak" },
        { text:"Spring break, pizookie & Bowlero" },
        { text:"April 16-18, Austin & DDN Legends" },
        { text:"Penn Dhamaka wins DDN 🏆" },
      ]},
    },
  },
  // 10. WORD SEARCH 5pm
  // Topic: adjectives/words Nidhi used to describe Krish, only place they appear
  {
    id:10, type:"wordsearch", emoji:"🔍", title:"Find What I Love",
    unlockLabel:"5:00 PM",
    teaser:"Hidden in the grid: every word that means you.",
    howToPlay:[
      "Words are hidden horizontally or vertically.",
      "Click and drag across letters to select a word.",
      "Hidden words are little love-notes between you two 💜",
      "Find all words to complete the game.",
      "On mobile: tap start letter, drag to end letter.",
    ],
    data:{
      easy:  { words:["KIND","REAL","WARM","NIDHI"],         gridSize:9  },
      medium:{ words:["GARBA","PURPLE","MOON","LOCK","FAIR"],  gridSize:11 },
      hard:  { words:["JHALAK","KROGER","MICKEY","NORTH","PENN","METHODIST"], gridSize:13 },
    },
  },
  // 11. PINPOINT (LinkedIn-style) 6pm
  // Topic: what connects these four memories, our story categories
  {
    id:11, type:"pinpoint", emoji:"📌", title:"What Links Us?",
    unlockLabel:"6:00 PM",
    teaser:"Like LinkedIn Pinpoint, what connects these clues?",
    howToPlay:[
      "Four clue tiles appear, they all share one link.",
      "Pick what connects them (our memory, place, or chapter).",
      "Green = you got the link! Red = not quite.",
      "Tap an answer, no typing needed.",
    ],
    data:{
      easy:[
        { clues:["Cancun","Beach","Pool","First kiss"], options:["Cancun trip 🌴","Naacho season","Prom night","Discord era"], answer:0 },
        { clues:["Miller","Dil Se Naach","Urban Nutcracker","Discovery Green"], options:["Naacho shows 💃","Cancun","Senior prom","Garba weekend"], answer:0 },
        { clues:["Discord","Geometry","Proofs","Conditionals"], options:["How we started talking 📐","Cancun","Love lock","UH fair"], answer:0 },
      ],
      medium:[
        { clues:["Love lock","Moon proposal","Hasini's proposal","UH fair"], options:["Senior year 2024 💜","Freshman year visits","Cancun","Naacho only"], answer:0 },
        { clues:["Velvet Taco","UT garba","Putt putt","Air hockey"], options:["Oct 2025 Austin visit 🌮","Spring break","Prom weekend","Miller show"], answer:0 },
        { clues:["Ramen Tatsuya","Bowling","24 hours","Air hockey"], options:["Sept 20-21, 2025 visit 💜","Halloweekend","Hoco week","Valentine's & Jhalak"], answer:0 },
        { clues:["Kroger lot","Rice campus","UH fair","Methodist"], options:["Places we'd meet up 📍","Naacho shows","Cancun only","College classes"], answer:0 },
      ],
      hard:[
        { clues:["Mickey & Minnie","North Italia","Kim Possible","Halloweekend"], options:["Halloweekend 2025 🎃","Jhalak weekend","DDN Legends trip","Fort Bend summer"], answer:0 },
        { clues:["Jhalak","Texas Dhoom","Soco","Valentine's"], options:["Feb 13-16 weekend 💜","Prom April 5","Cancun","Garba only"], answer:0 },
        { clues:["Pizookie","Bowlero","Jupiter's","Spring break"], options:["Spring break dates 🍕","Oct visit","Miller show","Love lock week"], answer:0 },
        { clues:["DDN Legends","Penn Dhamaka","Austin","April 16-18"], options:["April Austin trip 🏆","Hoco at Rice","UH fair","Moon proposal"], answer:0 },
        { clues:["Starry photo","Miller","Pre-grad","Outdoor theatre"], options:["Miller Outdoor Theatre 🌟","Prom","Cancun","Discord"], answer:0 },
      ],
    },
  },
  // 12. TWO TRUTHS & A LIE 7pm
  {
    id:12, type:"twotruths", emoji:"🎯", title:"Spot the Lie",
    unlockLabel:"7:00 PM",
    teaser:"Two truths, one lie, about us.",
    howToPlay:[
      "You get three statements about a memory.",
      "Two are true. One is the lie.",
      "Tap the statement you think is false.",
      "Green = you caught it. Red = that one was actually true.",
    ],
    data:{
      easy:[
        { topic:"The love lock, Aug 23, 2024",
          statements:[
            "Krish got you a love lock that day.",
            "You put the lock on a bridge together.",
            "This happened before senior year started.",
          ], lie:1 },
        { topic:"Cancun",
          statements:[
            "Your first kiss was on that trip.",
            "The ninja joke was a dad joke about Cancun.",
            "The Grand Palace was the only place you went.",
          ], lie:2 },
      ],
      medium:[
        { topic:"Naacho season",
          statements:[
            "Miller Outdoor Theatre was one of your shows.",
            "Dil Se Naach and Urban Nutcracker were on your list.",
            "Discovery Green was where you only practiced, never performed.",
          ], lie:2 },
        { topic:"Sept 20-21, 2025 visit",
          statements:[
            "You had ramen at Ramen Tatsuya.",
            "The visit was only a few hours, no overnight stay.",
            "You played air hockey together.",
          ], lie:1 },
        { topic:"Senior year 2024",
          statements:[
            "The moon-themed hoco proposal was Sept 21, 2024.",
            "Hasini's proposal was the day before yours.",
            "Nov 8, 2024 you met at Rice campus.",
          ], lie:2 },
      ],
      hard:[
        { topic:"Prom & spring 2025",
          statements:[
            "Prom was April 5, 2025: green theme.",
            "College visits happened before prom.",
            "Spring break dates included Pizookie and Bowlero.",
          ], lie:1 },
        { topic:"Halloweekend 2025",
          statements:[
            "You dressed as Mickey & Minnie.",
            "Kim Possible was one of your couples costumes.",
            "North Italia was your Valentine's dinner that year.",
          ], lie:2 },
        { topic:"April 2025 Austin",
          statements:[
            "DDN Legends was part of that trip.",
            "Penn Dhamaka won DDN Legends that weekend.",
            "You went to Velvet Taco on this April trip.",
          ], lie:2 },
      ],
    },
  },
  // 13. SUDOKU 8pm
  // Topic: pure logic puzzle, no story content, just a break
  {
    id:13, type:"sudoku", emoji:"🔢", title:"Love Logic",
    unlockLabel:"8:00 PM",
    teaser:"Plain 4×4 sudoku, no story clues, just a breather.",
    howToPlay:[
      "Fill every empty cell with a number from 1 to 4.",
      "Each number must appear exactly once in each row.",
      "Each number must appear exactly once in each column.",
      "Each number must appear exactly once in each 2×2 box.",
      "The pre-filled numbers are fixed, build around them.",
    ],
    data:{
      easy:  { puzzle:[[1,0,0,4],[0,4,1,0],[0,1,4,0],[4,0,0,1]], solution:[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]] },
      medium:{ puzzle:[[0,2,0,4],[4,0,0,0],[0,0,0,3],[3,0,4,0]], solution:[[1,2,3,4],[4,3,2,1],[2,4,1,3],[3,1,4,2]] },
      hard:  { puzzle:[[0,0,3,0],[0,3,0,0],[0,0,4,0],[0,4,0,0]], solution:[[2,4,3,1],[1,3,2,4],[3,1,4,2],[4,2,1,3]] },
    },
  },
  // 14. DEEP CUTS TRIVIA 9pm
  // Topic: exact quotes, exact details, fine-grain facts, zero overlap with game 3
  {
    id:14, type:"trivia", emoji:"🫦", title:"Deep Cuts Trivia",
    unlockLabel:"9:00 PM",
    teaser:"Verbatim quotes. Exact details. You were there.",
    howToPlay:[
      "These are the hard ones, exact quotes and tiny details.",
      "Tap one of four answers, no typing on this one.",
      "Read every option carefully before picking.",
      "Green = right ✅  Red = wrong ❌",
      "Next question loads automatically.",
      "You lived this. You know it.",
    ],
    data:{
      easy:[
        { q:"What date was Krish's hoco proposal?",
          options:["Sept 20, 2024","Sept 21, 2024","Sept 24, 2024","Oct 28, 2023"], a:1 },
        { q:"What was the theme of his hoco proposal?",
          options:["Stars","Moon","Sunset","Garden"], a:1 },
        { q:"When did he get you the love lock?",
          options:["July 4, 2024","Aug 23, 2024","Sept 20, 2024","Nov 8, 2024"], a:1 },
        { q:"What date was Hasini's hoco proposal?",
          options:["Sept 19, 2024","Sept 20, 2024","Sept 21, 2024","Sept 24, 2024"], a:1 },
        { q:"Nov 8, 2024: where did you meet up?",
          options:["Rice campus","A UH fair","The Kroger lot","Miller Outdoor Theatre"], a:1 },
      ],
      medium:[
        { q:"Summer 2024: Fort Bend Transit ran between…",
          options:["Rice & downtown","UH Sugarland & Methodist","TAMU & Austin","Home & school"], a:1 },
        { q:"That summer, what did he wake up early to do with you?",
          options:["Garba practice","Ride/write the Fort Bend Transit bus","SAT prep","Naacho rehearsal"], a:1 },
        { q:"Sept 24, 2024 Hoco, what was your color?",
          options:["Green","Blue","Purple","Gold"], a:2 },
        { q:"Oct 2-5 visit, which taco spot did you hit?",
          options:["Torchy's","Velvet Taco","Tacodeli","Chuy's"], a:1 },
        { q:"Putt putt that trip, which was NOT one of the themed holes?",
          options:["Goat","Candy","Toilet","Dragon"], a:3 },
        { q:"Halloweekend, one of your couple costumes was…",
          options:["Barbie & Ken","Mickey & Minnie","Shrek & Fiona","Mario & Luigi"], a:1 },
        { q:"Valentine's weekend, what comp did Texas Dhoom perform at?",
          options:["Raas Rave","Jhalak","Garba on the Green","Fusion Fiesta"], a:1 },
        { q:"Spring break date Mar 14, where did you go?",
          options:["Topgolf","Bowlero + Jupiter's","Main Event","Dave & Buster's"], a:1 },
        { q:"Senior year, where did you two drive to hang out and talk?",
          options:["The mall parking lot","The parking lot near Kroger","Behind the school","A random gas station"], a:1 },
      ],
      hard:[
        { q:"Sept 20-21, 2025 visit, how long were you together?",
          options:["12 hours","24 hours","48 hours","One full weekend"], a:1 },
        { q:"That same visit, which ramen spot?",
          options:["Ichiran","Tatsuya","Junbi","Kemuri"], a:1 },
        { q:"Cuddle movie night Sept 20, 2025: what did you watch?",
          options:["DDLJ","Saiyaara","Barfi","3 Idiots"], a:1 },
        { q:"April Austin trip, who won DDN Legends?",
          options:["Texas Raas","Penn Dhamaka","GT Ramz","BU Bhangra"], a:1 },
        { q:"Miller Outdoor Theatre 2025: what made his favorite photo special?",
          options:["Sunset over water","Starry background","Fireworks finale","Rainbow stage lights"], a:1 },
      ],
    },
  },
  // 15. FINAL 10pm
  {
    id:15, type:"final", emoji:"💜", title:"The Final Unlock",
    unlockLabel:"10:00 PM",
    teaser:"The last one. This one isn't a game.",
    data:{},
  },
];

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Btn = ({ children, onClick, disabled, variant="primary", full, style:sx={} }) => {
  const v = {
    primary:{ background:`linear-gradient(135deg,${T.primaryDim},${T.primary})`, color:"#fff", boxShadow:`0 4px 20px ${T.primaryDim}55` },
    soft:   { background:`${T.primaryDim}22`, color:T.primary, border:`1.5px solid ${T.primaryDim}55` },
    ghost:  { background:"transparent", color:T.textSub, border:`1.5px solid ${T.border}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} className="btn-press ns"
      style={{ border:"none", borderRadius:14, fontFamily:"'Quicksand',sans-serif", fontWeight:700,
        fontSize:15, cursor:disabled?"not-allowed":"pointer", padding:"11px 22px",
        transition:"all 0.18s ease", display:"inline-flex", alignItems:"center",
        justifyContent:"center", gap:6, opacity:disabled?0.4:1,
        width:full?"100%":"auto", ...v[variant], ...sx }}>
      {children}
    </button>
  );
};

const SInput = ({ value, onChange, onKeyDown, placeholder, style:sx={} }) => (
  <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
    autoComplete="off" autoCorrect="off" spellCheck={false}
    style={{ background:`${T.primaryDim}18`, border:`2px solid ${T.border}`, borderRadius:12,
      color:T.text, padding:"11px 16px", fontSize:15, outline:"none",
      fontFamily:"'Quicksand',sans-serif", fontWeight:600, transition:"border 0.2s", ...sx }}
    onFocus={e=>e.target.style.borderColor=T.primary}
    onBlur={e=>e.target.style.borderColor=T.border} />
);

const Banner = ({ won, message }) => (
  <div style={{ marginTop:16, padding:"16px 20px", borderRadius:16, textAlign:"center",
    background:won?`${T.mint}18`:`${T.textDim}22`, border:`1.5px solid ${won?T.mint:T.border}`,
    animation:"popIn 0.4s ease", boxShadow:won?`0 0 22px ${T.mint}30`:"none" }}>
    <p style={{ color:won?T.mint:T.textSub, fontWeight:800, fontSize:17, margin:0 }}>
      {won?`🎉 ${message||"You got it!"}`:(message||"Almost! 💜")}
    </p>
  </div>
);

function WinCelebration({ pts, onContinue }) {
  return (
    <div style={{ textAlign:"center", padding:"28px 12px", animation:"popIn 0.5s ease" }}>
      <div style={{ fontSize:64, marginBottom:12, animation:"heartbeat 1.5s ease-in-out infinite" }}>🎉</div>
      <p style={{ color:T.mint, fontSize:22, fontWeight:900, margin:"0 0 6px" }}>You got it!</p>
      <p style={{ color:T.textSub, fontSize:14, marginBottom:8 }}>Nice work, you earned</p>
      <p style={{ color:T.primary, fontSize:36, fontWeight:900, fontFamily:"'Nunito',sans-serif",
        margin:"8px 0 28px" }}>+{pts} pts</p>
      <Btn onClick={onContinue} full>Continue 💜</Btn>
    </div>
  );
}

function CompletedSummary({ pts, onContinue }) {
  return (
    <div style={{ textAlign:"center", padding:"28px 12px", animation:"popIn 0.5s ease" }}>
      <div style={{ fontSize:52, marginBottom:12, animation:"float 3s ease-in-out infinite" }}>✅</div>
      <p style={{ color:T.mint, fontSize:18, fontWeight:800, margin:"0 0 6px" }}>Already completed!</p>
      <p style={{ color:T.textSub, fontSize:14, marginBottom:12 }}>You nailed this level.</p>
      {pts !== undefined && (
        <p style={{ color:T.primary, fontSize:28, fontWeight:900, fontFamily:"'Nunito',sans-serif",
          margin:"0 0 24px" }}>+{pts} pts</p>
      )}
      <Btn onClick={onContinue} variant="soft" full>Back to difficulties</Btn>
    </div>
  );
}

// How To Play modal
function HowToPlayModal({ steps, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(9,6,15,0.85)", zIndex:100,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      animation:"fadeIn 0.2s ease" }}
      onClick={onClose}>
      <div style={{ background:T.bgCard, border:`1.5px solid ${T.primaryDim}`, borderRadius:22,
        padding:"28px 24px", maxWidth:380, width:"100%", animation:"popIn 0.3s ease" }}
        onClick={e=>e.stopPropagation()}>
        <p style={{ color:T.accent, fontWeight:800, fontSize:18, marginBottom:18, textAlign:"center" }}>
          📖 How to Play
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {steps.map((step,i)=>(
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <span style={{ background:`linear-gradient(135deg,${T.primaryDim},${T.primary})`,
                color:"#fff", borderRadius:"50%", width:24, height:24, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:800 }}>{i+1}</span>
              <p style={{ color:T.textSub, fontSize:14, lineHeight:1.6, margin:0 }}>{step}</p>
            </div>
          ))}
        </div>
        <Btn onClick={onClose} full>Got it, let's play!</Btn>
      </div>
    </div>
  );
}

const Particles = () => {
  const [ps] = useState(()=>Array.from({length:16},(_,i)=>({
    l:Math.random()*100, t:10+Math.random()*80, sz:2+Math.random()*3.5,
    delay:Math.random()*9, dur:5+Math.random()*7,
    color:[T.primary,T.accent,T.rose,T.accentSoft][i%4],
    op:0.05+Math.random()*0.14,
  })));
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
      {ps.map((p,i)=><div key={i} style={{ position:"absolute", left:`${p.l}%`, top:`${p.t}%`,
        width:p.sz, height:p.sz, borderRadius:"50%", background:p.color, opacity:p.op,
        animation:`float ${p.dur}s ${p.delay}s ease-in-out infinite` }}/>)}
    </div>
  );
};

function Countdown({ index }) {
  const [r, setR] = useState(()=>timeRemaining(index));
  useEffect(()=>{
    const t=setInterval(()=>{ const nr=timeRemaining(index); setR(nr); if(!nr) clearInterval(t); },1000);
    return ()=>clearInterval(t);
  },[index]);
  if (!r) return null;
  const {h,m,s}=r;
  return (
    <span style={{ color:T.primary, fontWeight:800, fontSize:13, fontFamily:"'Nunito',sans-serif",
      animation:"ticker 1s ease-in-out infinite" }}>
      {h>0?`${h}h `:""}{m.toString().padStart(2,"0")}m {s.toString().padStart(2,"0")}s
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── WORDLE, full green/yellow/gray logic ────────────────────────────────────
// Word stored in useRef ONLY, never in localStorage, never in window globals
function WordleGame({ data, difficulty, onScore }) {
  const cfg = data[difficulty];
  const wordRef = useRef(cfg.word.toUpperCase()); // plaintext only in memory
  const len = wordRef.current.length;
  const [guesses, setGuesses] = useState([]); // [{text, colors:[]}]
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const maxG = difficulty==="easy"?6:difficulty==="medium"?5:4;

  // Full Wordle color logic with the word in memory
  const computeColors = (guess, word) => {
    const colors = Array(len).fill("gray");
    const wordArr = word.split(""), remaining = [...wordArr];
    // First pass: greens
    for (let i=0; i<len; i++) {
      if (guess[i]===word[i]) { colors[i]="green"; remaining[i]=null; }
    }
    // Second pass: yellows
    for (let i=0; i<len; i++) {
      if (colors[i]==="green") continue;
      const ri = remaining.indexOf(guess[i]);
      if (ri!==-1) { colors[i]="yellow"; remaining[ri]=null; }
    }
    return colors;
  };

  const submit = () => {
    const g = current.toUpperCase();
    if (g.length!==len) { setShake(true); setTimeout(()=>setShake(false),400); return; }
    const word = wordRef.current;
    const colors = computeColors(g, word);
    const isCorrect = g===word;
    const ng = [...guesses, {text:g, colors}];
    setGuesses(ng); setCurrent("");
    if (isCorrect) {
      setWon(true); setDone(true);
      onScore((difficulty==="hard"?350:difficulty==="medium"?200:100)+Math.max(0,(maxG-ng.length)*30));
    } else if (ng.length>=maxG) { setDone(true); onScore(ng.length*12); }
  };

  const colorMap = {
    green:  { bg:"linear-gradient(135deg,#059669,#34d399)", border:"#34d399", glow:"0 0 14px #34d39955" },
    yellow: { bg:"linear-gradient(135deg,#92400e,#fbbf24)", border:"#fbbf24", glow:"none" },
    gray:   { bg:`${T.bgCard}`,                             border:T.border,  glow:"none" },
  };

  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:8,
        background:`${T.primaryDim}18`, borderRadius:20, padding:"6px 16px", marginBottom:18 }}>
        <span style={{ fontSize:13, color:T.primary, fontWeight:700 }}>💡 {cfg.hint}</span>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:7, alignItems:"center", marginBottom:22 }}>
        {Array.from({length:maxG}).map((_,ri)=>{
          const g = guesses[ri];
          const isCurr = ri===guesses.length && !done;
          const disp = isCurr ? current.toUpperCase().padEnd(len," ") : (g?.text||"").padEnd(len," ");
          return (
            <div key={ri} style={{ display:"flex", gap:7,
              animation:isCurr&&shake?"shake 0.35s ease":g?"popIn 0.35s ease":"none" }}>
              {Array.from({length:len}).map((_,ci)=>{
                const cm = g ? colorMap[g.colors[ci]] : null;
                const activeLetter = isCurr && disp[ci]!==" ";
                return (
                  <div key={ci} style={{
                    width:54, height:54,
                    border:`2px solid ${cm?cm.border:activeLetter?T.primary:T.border}`,
                    background:cm?cm.bg:"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:20, fontWeight:800, color:T.text, borderRadius:12,
                    transition:"all 0.28s", boxShadow:cm?cm.glow:"none",
                  }}>
                    {disp[ci]!==" "?disp[ci]:""}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Keyboard hint row */}
      {guesses.length>0 && !done && (
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:5, marginBottom:16 }}>
          {Array.from(new Set(guesses.flatMap(g=>g.text.split("")))).map(ch=>{
            const bestColor = guesses.reduce((best, g)=>{
              const idx = g.text.indexOf(ch);
              if (idx===-1) return best;
              const c = g.colors[idx];
              if (c==="green") return "green";
              if (c==="yellow" && best!=="green") return "yellow";
              if (best==="none") return "gray";
              return best;
            },"none");
            const col = bestColor==="green"?"#34d399":bestColor==="yellow"?"#fbbf24":bestColor==="gray"?T.border:T.border;
            return (
              <span key={ch} style={{ width:26, height:30, display:"flex", alignItems:"center",
                justifyContent:"center", borderRadius:6, fontSize:12, fontWeight:800,
                background:bestColor==="green"?`${T.mint}30`:bestColor==="yellow"?`${T.gold}30`:`${T.border}40`,
                color:col, border:`1px solid ${col}` }}>{ch}</span>
            );
          })}
        </div>
      )}

      {!done && (
        <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
          <SInput value={current}
            onChange={e=>setCurrent(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,len))}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder={`${len} letters`}
            style={{ width:160, textAlign:"center", textTransform:"uppercase", fontSize:18, letterSpacing:4 }}/>
          <Btn onClick={submit}>Guess ↵</Btn>
        </div>
      )}
      {done && (
        <div>
          <Banner won={won} message={won?`"${wordRef.current}" ✨`:`The word was "${wordRef.current}"`}/>
        </div>
      )}
    </div>
  );
}

// ── CONNECTIONS, with one-away detection + animated group reveal ─────────────
function ConnectionsGame({ data, difficulty, onScore }) {
  const { groups } = data[difficulty];
  const [items] = useState(()=>shuffleInPlace([...groups.flatMap(g=>g.items)]));
  const [selected, setSelected] = useState([]);
  const [solvedIdx, setSolvedIdx] = useState([]); // indices into groups, all 4 required to score
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(null); // null | "oneaway" | "wrong"
  const [wrongAnim, setWrongAnim] = useState(false);
  const scoredRef = useRef(false);

  const solvedGroups = solvedIdx.map(i=>groups[i]);
  const solvedItems = new Set(solvedGroups.flatMap(g=>g.items));
  const unsolved = items.filter(i=>!solvedItems.has(i));

  const toggle = item => {
    if (solvedItems.has(item)) return;
    setSelected(p=>p.includes(item)?p.filter(x=>x!==item):p.length<4?[...p,item]:p);
  };

  const submit = () => {
    if (selected.length!==4 || done) return;
    const gi = groups.findIndex(g=>g.items.every(i=>selected.includes(i)));
    if (gi>=0 && !solvedIdx.includes(gi)) {
      setFeedback(null);
      const ns=[...solvedIdx, gi];
      setSolvedIdx(ns);
      setSelected([]);
      if (ns.length===groups.length) {
        setDone(true);
        if (!scoredRef.current) {
          scoredRef.current=true;
          onScore(Math.max(50,400-mistakes*60));
        }
      }
    } else if (gi<0) {
      const isOneAway = groups.some(g=>selected.filter(s=>g.items.includes(s)).length===3);
      setFeedback(isOneAway?"oneaway":"wrong");
      setWrongAnim(true);
      setTimeout(()=>{ setWrongAnim(false); setFeedback(null); },900);
      setSelected([]);
      setMistakes(m=>{
        const next=m+1;
        if (next>=4) setDone(true);
        return next;
      });
    }
  };

  return (
    <div>
      {/* One-away banner */}
      {feedback==="oneaway" && (
        <div style={{ background:`${T.gold}22`, border:`1.5px solid ${T.gold}`, borderRadius:12,
          padding:"10px 14px", marginBottom:10, textAlign:"center", animation:"popIn 0.2s ease" }}>
          <p style={{ color:T.gold, fontWeight:800, fontSize:14, margin:0 }}>
            💜 One away! You have exactly one wrong, swap one out.
          </p>
        </div>
      )}

      {/* Solved groups, animated reveal */}
      {solvedGroups.map(g=>(
        <div key={g.name} style={{ background:`${g.color}22`, border:`2px solid ${g.color}70`,
          borderRadius:14, padding:"12px 14px", marginBottom:8, textAlign:"center",
          animation:"groupReveal 0.45s ease", transformOrigin:"top" }}>
          <p style={{ color:g.color, fontWeight:800, margin:"0 0 3px", fontSize:14 }}>{g.name}</p>
          <p style={{ color:T.textMuted, margin:0, fontSize:12 }}>{g.items.join("  ·  ")}</p>
        </div>
      ))}

      {/* Unsolved grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:14 }}>
        {unsolved.map(item=>{
          const isSel = selected.includes(item);
          return (
            <button key={item} onClick={()=>toggle(item)} className="ns"
              style={{ padding:"13px 8px", borderRadius:14, fontSize:13, fontWeight:700,
                fontFamily:"'Quicksand',sans-serif", cursor:"pointer", transition:"all 0.2s",
                background:isSel?`linear-gradient(135deg,${T.primaryDim},${T.primary})`:`${T.primaryDim}18`,
                color:isSel?"#fff":T.text,
                border:`2px solid ${isSel?T.primary:T.border}`,
                boxShadow:isSel?`0 4px 16px ${T.primaryDim}44`:"none",
                animation:wrongAnim&&isSel?"shake 0.35s ease":"none",
              }}>{item}</button>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:12, alignItems:"center", justifyContent:"center" }}>
        <Btn onClick={submit} disabled={selected.length!==4}>Submit</Btn>
        <span style={{ fontSize:18 }}>
          {"💜".repeat(Math.max(0,4-mistakes))}{"🖤".repeat(mistakes)}
        </span>
      </div>

      {done && solvedIdx.length===groups.length && (
        <Banner won message="All four groups found! 🎉"/>
      )}
      {done && solvedIdx.length<groups.length && (
        <Banner won={false} message="Out of guesses, try again! 💜"/>
      )}
    </div>
  );
}

// ── TRIVIA ────────────────────────────────────────────────────────────────────
function TriviaGame({ data, difficulty, onScore }) {
  const qs = data[difficulty];
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [chosen,setChosen]=useState(null);
  const [done,setDone]=useState(false);

  const pick = i => {
    if (chosen!==null) return;
    setChosen(i);
    const pts=i===qs[idx].a?(difficulty==="hard"?70:difficulty==="medium"?45:25):0, ns=score+pts;
    setTimeout(()=>{
      if (idx+1>=qs.length){setDone(true);onScore(ns);}
      else{setIdx(idx+1);setChosen(null);setScore(ns);}
    },950);
  };

  if (done) return (
    <div style={{ textAlign:"center", animation:"popIn 0.5s ease", padding:"16px 0" }}>
      <div style={{ fontSize:54, animation:"heartbeat 1.5s ease-in-out infinite", marginBottom:12 }}>🎉</div>
      <p style={{ color:T.primary, fontSize:28, fontWeight:900, fontFamily:"'Nunito',sans-serif" }}>{score} pts</p>
    </div>
  );

  const q=qs[idx];
  return (
    <div key={idx} style={{ animation:"fadeUp 0.35s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ color:T.textMuted, fontSize:12, fontWeight:700 }}>Q{idx+1}/{qs.length}</span>
        <div style={{ display:"flex", gap:4 }}>
          {qs.map((_,i)=><div key={i} style={{ width:8, height:8, borderRadius:"50%", transition:"all 0.3s",
            background:i<idx?T.primary:i===idx?T.accent:T.border }}/>)}
        </div>
      </div>
      <p style={{ color:T.text, fontSize:16, fontWeight:700, marginBottom:18, lineHeight:1.6 }}>{q.q}</p>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {q.options.map((opt,i)=>{
          let bg=`${T.primaryDim}15`, border=T.border, color=T.text, glow="none";
          if (chosen!==null){
            if (i===q.a){bg=`${T.mint}18`;border=T.mint;color=T.mint;glow=`0 0 14px ${T.mint}44`;}
            else if (i===chosen){bg=`${T.rose}18`;border=T.rose;color=T.rose;}
          }
          return (
            <button key={i} onClick={()=>pick(i)} className="ns"
              style={{ padding:"13px 16px", borderRadius:13, textAlign:"left", background:bg,
                border:`2px solid ${border}`, color, cursor:"pointer", fontSize:14, fontWeight:600,
                transition:"all 0.22s", boxShadow:glow, fontFamily:"'Quicksand',sans-serif" }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── EMOJI DECODER ─────────────────────────────────────────────────────────────
function EmojiGame({ data, difficulty, onScore }) {
  const puzzles=data[difficulty];
  const [idx,setIdx]=useState(0);
  const [input,setInput]=useState("");
  const [results,setResults]=useState([]);
  const [done,setDone]=useState(false);
  const [fb,setFb]=useState(null);

  const submit = () => {
    const ok=checkAnswer(input,puzzles[idx].answerHashes);
    setFb(ok); const nr=[...results,ok];
    setTimeout(()=>{
      setFb(null); setInput("");
      if (idx+1>=puzzles.length){setDone(true);onScore(nr.filter(Boolean).length*(difficulty==="hard"?90:difficulty==="medium"?55:35));}
      else{setIdx(idx+1);setResults(nr);}
    },800);
  };

  if (done) return <div style={{ textAlign:"center", animation:"popIn 0.5s ease" }}>
    <p style={{ fontSize:52, marginBottom:12 }}>🎊</p>
    <p style={{ color:T.primary, fontSize:26, fontWeight:900 }}>{results.filter(Boolean).length}/{puzzles.length} correct!</p>
  </div>;

  const p=puzzles[idx];
  return (
    <div key={idx} style={{ textAlign:"center", animation:"fadeUp 0.35s ease" }}>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:10 }}>Puzzle {idx+1}/{puzzles.length}</p>
      <div style={{ fontSize:62, margin:"20px 0", animation:"float 3s ease-in-out infinite" }}>{p.emojis}</div>
      <p style={{ color:T.textMuted, fontStyle:"italic", fontSize:13, marginBottom:18 }}>💡 {p.hint}</p>
      {fb!==null&&<div style={{ color:fb?T.mint:T.rose, fontWeight:800, marginBottom:10,
        animation:"popIn 0.2s ease", fontSize:16 }}>{fb?"✅ Correct!":"❌ Not quite!"}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <SInput value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="What is this?" style={{ maxWidth:220 }}/>
        <Btn onClick={submit}>Go →</Btn>
      </div>
    </div>
  );
}

// ── MEMORY MATCH ──────────────────────────────────────────────────────────────
function MemoryGame({ data, difficulty, onScore }) {
  const {pairs,size}=data[difficulty];
  const [cards]=useState(()=>{
    const deck = [...pairs, ...pairs].map((val, id) => ({ id, val, matched: false, flipped: false }));
    shuffleInPlace(deck);
    return deck;
  });
  const [grid,setGrid]=useState(cards);
  const [flipped,setFlipped]=useState([]);
  const [moves,setMoves]=useState(0);
  const [done,setDone]=useState(false);
  const lockRef=useRef(false);

  const flip=id=>{
    if (lockRef.current||flipped.length===2) return;
    const card=grid.find(c=>c.id===id);
    if (!card||card.matched||card.flipped) return;
    const nf=[...flipped,id], ng=grid.map(c=>c.id===id?{...c,flipped:true}:c);
    setGrid(ng); setFlipped(nf);
    if (nf.length===2){
      lockRef.current=true;
      const movesAfterPair = moves + 1;
      setMoves(m=>m+1);
      const [a,b]=nf.map(fid=>ng.find(c=>c.id===fid));
      setTimeout(()=>{
        lockRef.current=false;
        if (a.val===b.val){
          const matched=ng.map(c=>nf.includes(c.id)?{...c,matched:true}:c);
          setGrid(matched); setFlipped([]);
          if (matched.every(c=>c.matched)){setDone(true);onScore(Math.max(50,300-movesAfterPair*8));}
        } else{setGrid(ng.map(c=>nf.includes(c.id)?{...c,flipped:false}:c));setFlipped([]);}
      },850);
    }
  };

  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ display:"inline-flex", gap:6, alignItems:"center", background:`${T.primaryDim}18`,
        borderRadius:20, padding:"6px 14px", marginBottom:16 }}>
        <span style={{ color:T.textSub, fontSize:13, fontWeight:700 }}>Moves: {moves}</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${size},1fr)`, gap:9, maxWidth:320, margin:"0 auto" }} className="ns">
        {grid.map(card=>(
          <div key={card.id} onClick={()=>flip(card.id)} style={{
            height:68, borderRadius:16, cursor:"pointer", fontSize:28,
            background:card.matched?`linear-gradient(135deg,${T.primaryDim},${T.accent})`:card.flipped?`${T.primaryDim}40`:T.bgCard,
            border:`2px solid ${card.matched?T.accent:card.flipped?T.primary:T.border}`,
            display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.3s",
            boxShadow:card.matched?`0 0 18px ${T.primaryDim}55`:"none",
          }}>{card.flipped||card.matched?card.val:"✦"}</div>
        ))}
      </div>
      {done&&<Banner won message={`Done in ${moves} moves! 🎴`}/>}
    </div>
  );
}

// ── FILL THE LYRICS ───────────────────────────────────────────────────────────
function LyricsGame({ data, difficulty, onScore }) {
  const puzzles=data[difficulty];
  const [answers,setAnswers]=useState(Array(puzzles.length).fill(""));
  const [submitted,setSubmitted]=useState(false);
  const [results,setResults]=useState([]);

  const [finalPts,setFinalPts]=useState(null);
  const submit=()=>{
    const res=puzzles.map((p,i)=>checkAnswer(answers[i],p.answerHashes));
    setResults(res); setSubmitted(true);
    setFinalPts(res.filter(Boolean).length*(difficulty==="hard"?90:difficulty==="medium"?55:35));
  };

  return (
    <div>
      {puzzles.map((p,i)=>{
        const ok=submitted&&results[i], bad=submitted&&!results[i];
        const [pre,post]=p.line.split("___");
        return (
          <div key={i} style={{ marginBottom:16, padding:16, background:`${T.primaryDim}12`,
            borderRadius:16, border:`1.5px solid ${ok?T.mint:bad?T.rose:T.border}`, transition:"border 0.3s" }}>
            <p style={{ color:T.textMuted, fontSize:11, marginBottom:8, fontWeight:700 }}>🎵 {p.song}</p>
            <p style={{ color:T.textSub, fontSize:14, lineHeight:2, fontStyle:"italic" }}>
              {pre}
              <span style={{ display:"inline-block", minWidth:80,
                borderBottom:`2px solid ${ok?T.mint:bad?T.rose:T.primary}`,
                color:ok?T.mint:bad?T.rose:T.primary, fontWeight:800, textAlign:"center",
                padding:"0 6px", fontStyle:"normal" }}>
                {submitted?(ok?answers[i]:"✗"):(answers[i]||"___")}
              </span>
              {post}
            </p>
            {!submitted&&<SInput value={answers[i]} onChange={e=>{const a=[...answers];a[i]=e.target.value;setAnswers(a);}}
              placeholder="fill in…" style={{ marginTop:10, fontSize:14, width:"100%" }}/>}
          </div>
        );
      })}
      {!submitted&&<Btn onClick={submit} full>Submit All 🎵</Btn>}
      {submitted&&finalPts!==null&&(
        <Btn onClick={()=>onScore(finalPts)} full style={{ marginTop:16 }}>Continue 💜</Btn>
      )}
    </div>
  );
}

// ── SPELLING BEE ──────────────────────────────────────────────────────────────
function SpellingBeeGame({ data, difficulty, onScore }) {
  const {center,outer,words,pangram}=data[difficulty];
  const [input,setInput]=useState("");
  const [found,setFound]=useState([]);
  const [msg,setMsg]=useState("");
  const [msgOk,setMsgOk]=useState(true);
  const [finalPts,setFinalPts]=useState(null);

  const flash=(m,ok=true)=>{setMsg(m);setMsgOk(ok);setTimeout(()=>setMsg(""),1300);};
  const submit=()=>{
    const w=input.toUpperCase();
    if (w.length<3){flash("Too short!",false);setInput("");return;}
    if (!w.includes(center)){flash(`Must use "${center}"`,false);setInput("");return;}
    if (found.includes(w)){flash("Already found!",false);setInput("");return;}
    if (words.map(x=>x.toUpperCase()).includes(w)){
      const nf=[...found,w]; setFound(nf);
      flash(w===pangram.toUpperCase()?"🌟 PANGRAM! You found it!":"✨ Nice one!");
      if (nf.length>=words.length) setFinalPts(nf.length*(difficulty==="hard"?50:difficulty==="medium"?30:18));
    } else{flash("Not valid",false);}
    setInput("");
  };

  return (
    <div style={{ textAlign:"center" }}>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:14 }}>
        Use the center letter in every word. Find all {words.length}. 🌟 = pangram bonus.
      </p>
      <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:9, margin:"16px 0" }} className="ns">
        {[center,...outer].map(l=>(
          <button key={l} onClick={()=>setInput(i=>i+l)} style={{
            width:50, height:50, borderRadius:"50%", fontWeight:900, fontSize:18, cursor:"pointer",
            border:"none", fontFamily:"'Quicksand',sans-serif", transition:"all 0.18s",
            background:l===center?`linear-gradient(135deg,${T.primaryDim},${T.accent})`:`${T.primaryDim}28`,
            color:l===center?"#fff":T.primary,
            boxShadow:l===center?`0 4px 20px ${T.primaryDim}55`:"none",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ background:`${T.primaryDim}18`, border:`2px solid ${T.border}`, borderRadius:14,
        padding:14, marginBottom:10, minHeight:52 }}>
        <span style={{ color:T.primary, fontSize:22, letterSpacing:6, fontWeight:800 }}>{input||"…"}</span>
      </div>
      <div style={{ height:26, marginBottom:6 }}>
        {msg&&<span style={{ color:msgOk?T.mint:T.rose, fontWeight:700, animation:"fadeIn 0.2s ease" }}>{msg}</span>}
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
        <Btn onClick={()=>setInput(i=>i.slice(0,-1))} variant="ghost">⌫</Btn>
        <Btn onClick={submit}>Enter</Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
        {found.map(w=><span key={w} style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700,
          background:w===pangram.toUpperCase()?`${T.gold}22`:`${T.mint}18`,
          color:w===pangram.toUpperCase()?T.gold:T.mint,
          border:`1px solid ${w===pangram.toUpperCase()?T.gold:T.mint}60` }}>{w}</span>)}
      </div>
      {finalPts!==null&&(
        <>
          <Banner won message="You found every word! 🐝"/>
          <Btn onClick={()=>onScore(finalPts)} full style={{ marginTop:16 }}>Continue 💜</Btn>
        </>
      )}
    </div>
  );
}

// ── ANAGRAM ───────────────────────────────────────────────────────────────────
function AnagramGame({ data, difficulty, onScore }) {
  const puzzles=data[difficulty];
  const [idx,setIdx]=useState(0);
  const [input,setInput]=useState("");
  const [results,setResults]=useState([]);
  const [done,setDone]=useState(false);
  const [fb,setFb]=useState(null);

  const submit=()=>{
    const ok=checkAnswer(input,puzzles[idx].answerHashes);
    setFb(ok); const nr=[...results,ok];
    setTimeout(()=>{
      setFb(null); setInput("");
      if (idx+1>=puzzles.length){setDone(true);onScore(nr.filter(Boolean).length*90);}
      else{setIdx(idx+1);setResults(nr);}
    },750);
  };

  if (done) return <div style={{ textAlign:"center", animation:"popIn 0.5s ease" }}>
    <p style={{ fontSize:48, margin:"16px 0" }}>🔀</p>
    <p style={{ color:T.primary, fontSize:26, fontWeight:900 }}>{results.filter(Boolean).length}/{puzzles.length} correct!</p>
  </div>;

  const p=puzzles[idx];
  return (
    <div key={idx} style={{ textAlign:"center", animation:"fadeUp 0.35s ease" }}>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:6 }}>Puzzle {idx+1}/{puzzles.length}</p>
      <p style={{ color:T.textSub, fontSize:13, marginBottom:16, fontStyle:"italic" }}>🔑 {p.clue}</p>
      <div style={{ background:`${T.primaryDim}20`, borderRadius:18, padding:"26px 16px", marginBottom:20,
        border:`2px solid ${T.border}`, boxShadow:`inset 0 0 30px ${T.primaryDim}18` }} className="ns">
        <p style={{ color:T.accent, fontSize:32, fontWeight:900, letterSpacing:8, margin:0 }}>{p.scrambled}</p>
      </div>
      {fb!==null&&<div style={{ color:fb?T.mint:T.rose, fontWeight:800, marginBottom:10,
        animation:"popIn 0.2s ease", fontSize:16 }}>{fb?"✅ Correct!":"❌ Not quite!"}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <SInput value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="Unscramble it" style={{ maxWidth:210 }}/>
        <Btn onClick={submit}>→</Btn>
      </div>
    </div>
  );
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────
function TimelineGame({ data, difficulty, onScore }) {
  const {events}=data[difficulty];
  const [order,setOrder]=useState(()=>shuffleInPlace([...events]));
  const [submitted,setSubmitted]=useState(false);
  const [finalPts,setFinalPts]=useState(null);

  const move=(i,d)=>{const n=[...order],j=i+d;if(j<0||j>=n.length)return;[n[i],n[j]]=[n[j],n[i]];setOrder(n);};
  const check=()=>{
    setSubmitted(true);
    let pts=0;order.forEach((e,i)=>{if(e.text===events[i].text)pts+=Math.round(200/events.length);});
    setFinalPts(pts);
  };

  return (
    <div>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:14, textAlign:"center" }}>
        Earliest at top → most recent at bottom ⬆️⬇️
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {order.map((event,i)=>{
          const ok=submitted&&event.text===events[i].text;
          const bad=submitted&&event.text!==events[i].text;
          return (
            <div key={event.text} style={{
              display:"flex", alignItems:"center", gap:10,
              background:ok?`${T.mint}18`:bad?`${T.rose}12`:`${T.primaryDim}15`,
              border:`2px solid ${ok?T.mint:bad?T.rose:T.border}`,
              borderRadius:14, padding:"12px 14px", transition:"all 0.3s", animation:"slideIn 0.3s ease",
            }}>
              <span style={{ color:"#fff", fontSize:12, fontWeight:800, width:26, height:26, flexShrink:0,
                background:`linear-gradient(135deg,${T.primaryDim},${T.accent})`, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</span>
              <span style={{ color:T.text, flex:1, fontSize:13, fontWeight:600, lineHeight:1.4 }}>{event.text}</span>
              {!submitted&&(
                <div style={{ display:"flex", gap:5 }}>
                  {[[-1,"↑"],[1,"↓"]].map(([d,l])=>(
                    <button key={d} onClick={()=>move(i,d)} style={{ background:`${T.primaryDim}25`,
                      border:`1px solid ${T.border}`, borderRadius:8, width:30, height:30,
                      color:T.textSub, cursor:"pointer", fontSize:14, fontFamily:"'Quicksand',sans-serif",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!submitted&&<Btn onClick={check} full style={{ marginTop:16 }}>Lock In Order ✓</Btn>}
      {submitted&&<Banner won={order.every((e,i)=>e.text===events[i].text)} message="Our story, in order 💜"/>}
      {submitted&&finalPts!==null&&(
        <Btn onClick={()=>onScore(finalPts)} full style={{ marginTop:16 }}>Continue 💜</Btn>
      )}
    </div>
  );
}

// ── WORD SEARCH ───────────────────────────────────────────────────────────────
const WS_DIRS=[[0,1],[1,0],[0,-1],[-1,0]];

function wsCanPlace(g,word,r,c,dr,dc,gridSize){
  for(let k=0;k<word.length;k++){
    const nr=r+dr*k,nc=c+dc*k;
    if(nr<0||nc<0||nr>=gridSize||nc>=gridSize)return false;
    if(g[nr][nc]!==""&&g[nr][nc]!==word[k])return false;
  }
  return true;
}

function wsPlace(g,word,r,c,dr,dc){
  for(let k=0;k<word.length;k++)g[r+dr*k][c+dc*k]=word[k];
}

function buildWordSearchGrid(words,gridSize){
  const sorted=[...words].sort((a,b)=>b.length-a.length);
  for(let attempt=0;attempt<120;attempt++){
    const g=Array(gridSize).fill(null).map(()=>Array(gridSize).fill(""));
    let ok=true;
    for(const word of sorted){
      const slots=[];
      for(let r=0;r<gridSize;r++)for(let c=0;c<gridSize;c++)
        for(const [dr,dc] of WS_DIRS)
          if(wsCanPlace(g,word,r,c,dr,dc,gridSize))slots.push({r,c,dr,dc});
      if(!slots.length){ok=false;break;}
      shuffleInPlace(slots);
      wsPlace(g,word,slots[0].r,slots[0].c,slots[0].dr,slots[0].dc);
    }
    if(ok){
      for(let r=0;r<gridSize;r++)for(let c=0;c<gridSize;c++)
        if(!g[r][c])g[r][c]=String.fromCharCode(65+Math.floor(Math.random()*26));
      return g;
    }
  }
  const g=Array(gridSize).fill(null).map(()=>Array(gridSize).fill(""));
  sorted.forEach((word,i)=>{
    const r=Math.min(i,gridSize-1);
    if(r+word.length<=gridSize)wsPlace(g,word,r,0,1,0);
  });
  for(let r=0;r<gridSize;r++)for(let c=0;c<gridSize;c++)
    if(!g[r][c])g[r][c]=String.fromCharCode(65+Math.floor(Math.random()*26));
  return g;
}

function wordSearchLineCells(start,end,gridSize){
  if(!start||!end)return[];
  let dr=end.r-start.r,dc=end.c-start.c;
  if(dr===0&&dc===0)return[`${start.r},${start.c}`];
  if(dr!==0&&dc!==0){
    if(Math.abs(dr)>=Math.abs(dc))dc=0;
    else dr=0;
  }
  const stepR=dr===0?0:Math.sign(dr),stepC=dc===0?0:Math.sign(dc);
  const len=Math.max(Math.abs(dr),Math.abs(dc));
  const cells=[];
  for(let i=0;i<=len;i++){
    const r=start.r+stepR*i,c=start.c+stepC*i;
    if(r<0||c<0||r>=gridSize||c>=gridSize)break;
    cells.push(`${r},${c}`);
  }
  return cells;
}

function WordSearchGame({ data, difficulty, onScore }) {
  const {words,gridSize}=data[difficulty];
  const [grid]=useState(()=>buildWordSearchGrid(words,gridSize));
  const [hl,setHl]=useState([]);
  const [foundCells,setFoundCells]=useState(new Set());
  const [found,setFound]=useState([]);
  const selectingRef=useRef(false);
  const startRef=useRef(null);
  const scoredRef=useRef(false);

  const cellKey=(r,c)=>`${r},${c}`;
  const cellFromTarget=t=>{
    const el=t?.closest?.("[data-ws-cell]");
    if(!el)return null;
    return {r:Number(el.dataset.r),c:Number(el.dataset.c)};
  };

  const finishSelect=end=>{
    if(!selectingRef.current||!startRef.current)return;
    const cells=wordSearchLineCells(startRef.current,end,gridSize);
    selectingRef.current=false;
    startRef.current=null;
    setHl([]);
    if(cells.length<2)return;
    const str=cells.map(k=>{const[r,c]=k.split(",").map(Number);return grid[r][c];}).join("");
    const rev=str.split("").reverse().join("");
    const match=words.find(w=>w===str||w===rev);
    if(!match)return;
    setFound(prev=>{
      if(prev.includes(match))return prev;
      const nf=[...prev,match];
      setFoundCells(fc=>new Set([...fc,...cells]));
      if(nf.length===words.length&&!scoredRef.current){
        scoredRef.current=true;
        onScore(words.length*(difficulty==="hard"?70:difficulty==="medium"?45:28));
      }
      return nf;
    });
  };

  const onPointerDown=e=>{
    if(e.button!==undefined&&e.button!==0)return;
    const cell=cellFromTarget(e.target);
    if(!cell)return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    selectingRef.current=true;
    startRef.current=cell;
    setHl([cellKey(cell.r,cell.c)]);
  };

  const onPointerMove=e=>{
    if(!selectingRef.current||!startRef.current)return;
    const cell=cellFromTarget(e.target);
    if(!cell)return;
    setHl(wordSearchLineCells(startRef.current,cell,gridSize));
  };

  const onPointerUp=e=>{
    if(!selectingRef.current)return;
    const cell=cellFromTarget(e.target)||startRef.current;
    try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
    finishSelect(cell);
  };

  const onPointerCancel=()=>{
    selectingRef.current=false;
    startRef.current=null;
    setHl([]);
  };

  const cs=gridSize<=9?34:gridSize<=11?28:22;

  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
        {words.map(w=><span key={w} style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700,
          background:found.includes(w)?`${T.primary}22`:`${T.primaryDim}18`,
          color:found.includes(w)?T.primary:T.textMuted,
          border:`1px solid ${found.includes(w)?T.primary:T.border}`,
          textDecoration:found.includes(w)?"line-through":"none" }}>{w}</span>)}
      </div>
      <div
        className="ns"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ display:"inline-block", userSelect:"none", touchAction:"none", cursor:"crosshair",
          background:`${T.primaryDim}10`, borderRadius:14, padding:8 }}>
        {grid.map((row,r)=>(
          <div key={r} style={{ display:"flex" }}>
            {row.map((cell,c)=>{
              const k=cellKey(r,c),isH=hl.includes(k),isF=foundCells.has(k);
              return (
                <div
                  key={c}
                  data-ws-cell
                  data-r={r}
                  data-c={c}
                  style={{ width:cs, height:cs, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:cs<=22?9:11, fontWeight:800,
                    color:isH?"#fff":isF?T.primary:T.textMuted,
                    background:isH?`linear-gradient(135deg,${T.primaryDim},${T.accent})`:isF?`${T.primaryDim}22`:"transparent",
                    borderRadius:4, transition:"background 0.08s" }}>
                  {cell}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {found.length===words.length&&<Banner won message="Found them all! 🔍✨"/>}
    </div>
  );
}

// ── PINPOINT (LinkedIn-style, what links these clues?) ───────────────────────
function PinpointGame({ data, difficulty, onScore }) {
  const qs=data[difficulty];
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [chosen,setChosen]=useState(null);
  const [done,setDone]=useState(false);
  const [visibleClues,setVisibleClues]=useState(1);
  const q=qs[idx];

  useEffect(()=>{
    setVisibleClues(1);
    if(!q) return;
    const timers=[];
    for(let i=1;i<q.clues.length;i++) timers.push(setTimeout(()=>setVisibleClues(i+1),i*520));
    return ()=>timers.forEach(clearTimeout);
  },[idx,q?.clues?.length]);

  const pick=i=>{
    if(chosen!==null||!q) return;
    setChosen(i);
    const pts=i===q.answer?(difficulty==="hard"?70:difficulty==="medium"?45:28):0, ns=score+pts;
    setTimeout(()=>{
      if(idx+1>=qs.length){setDone(true);onScore(ns);}
      else{setIdx(idx+1);setChosen(null);setScore(ns);}
    },1050);
  };

  if(done) return <div style={{ textAlign:"center", animation:"popIn 0.5s ease" }}>
    <p style={{ fontSize:48, marginBottom:12 }}>📌</p>
    <p style={{ color:T.primary, fontSize:26, fontWeight:900 }}>{score} pts, you see the links 💜</p>
  </div>;

  if(!q) return null;

  return (
    <div key={idx} style={{ animation:"fadeUp 0.35s ease" }}>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:8, textAlign:"center" }}>
        Round {idx+1}/{qs.length} · Pinpoint
      </p>
      <div style={{ background:`${T.primaryDim}18`, borderRadius:16, padding:"18px 16px",
        marginBottom:16, border:`1.5px solid ${T.border}`, textAlign:"center" }}>
        <p style={{ color:T.textSub, fontSize:15, fontWeight:700 }}>What connects these?</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:18 }}>
        {(q.clues||[]).map((clue,i)=>(
          <div key={`${clue}-${i}`} style={{
            padding:"14px 10px", borderRadius:12, textAlign:"center", fontSize:13, fontWeight:800,
            fontFamily:"'Nunito',sans-serif",
            background:i<visibleClues?`linear-gradient(135deg,${T.primaryDim},#5b21b6)`:T.bgDeep,
            color:i<visibleClues?"#fff":T.textDim,
            border:`2px solid ${i<visibleClues?T.primary:T.border}`,
            opacity:i<visibleClues?1:0.35, transition:"all 0.35s ease",
            boxShadow:i<visibleClues?`0 4px 14px ${T.primaryDim}44`:"none",
          }}>{i<visibleClues?clue:"···"}</div>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {(q.options||[]).map((opt,i)=>{
          let bg=`${T.primaryDim}15`,border=T.border,color=T.text,glow="none";
          if(chosen!==null){
            if(i===q.answer){bg=`${T.mint}18`;border=T.mint;color=T.mint;glow=`0 0 14px ${T.mint}44`;}
            else if(i===chosen){bg=`${T.rose}18`;border=T.rose;color=T.rose;}
          }
          return <button key={i} onClick={()=>pick(i)} className="ns"
            style={{ padding:"13px 16px", borderRadius:13, textAlign:"left", background:bg,
              border:`2px solid ${border}`, color, cursor:"pointer", fontSize:14, fontWeight:600,
              transition:"all 0.22s", boxShadow:glow, fontFamily:"'Quicksand',sans-serif" }}>{opt}</button>;
        })}
      </div>
      {chosen!==null&&<p style={{ textAlign:"center", marginTop:12,
        color:chosen===q.answer?T.mint:T.rose, fontWeight:700 }}>
        {chosen===q.answer?"✅ That's the link!":`❌ The link was "${q.options[q.answer]}"`}
      </p>}
    </div>
  );
}

// ── TWO TRUTHS & A LIE ───────────────────────────────────────────────────────
function TwoTruthsGame({ data, difficulty, onScore }) {
  const rounds=data[difficulty];
  const [idx,setIdx]=useState(0);
  const [chosen,setChosen]=useState(null);
  const [results,setResults]=useState([]);
  const [done,setDone]=useState(false);

  const pick=i=>{
    if(chosen!==null)return;
    setChosen(i);
    const ok=i===rounds[idx].lie;
    const nr=[...results,ok];
    setTimeout(()=>{
      if(idx+1>=rounds.length){
        const right=nr.filter(Boolean).length;
        const pts=difficulty==="hard"?right*95:difficulty==="medium"?right*75:right*60;
        setDone(true);
        onScore(pts);
      }else{
        setIdx(idx+1);
        setChosen(null);
        setResults(nr);
      }
    },1000);
  };

  if(done){
    const right=results.filter(Boolean).length;
    return (
      <div style={{ textAlign:"center", animation:"popIn 0.5s ease", padding:"16px 0" }}>
        <p style={{ fontSize:48, marginBottom:12 }}>🎯</p>
        <p style={{ color:T.primary, fontSize:22, fontWeight:900 }}>{right}/{rounds.length} lies spotted</p>
        <p style={{ color:T.textMuted, fontSize:14, marginTop:8 }}>you know our story 💜</p>
      </div>
    );
  }

  const r=rounds[idx];
  return (
    <div key={idx} style={{ animation:"fadeUp 0.35s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ color:T.textMuted, fontSize:12, fontWeight:700 }}>Round {idx+1}/{rounds.length}</span>
        <span style={{ color:T.accent, fontSize:11, fontWeight:700, textTransform:"uppercase" }}>tap the lie</span>
      </div>
      <p style={{ color:T.text, fontSize:16, fontWeight:800, marginBottom:16, lineHeight:1.5 }}>{r.topic}</p>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {r.statements.map((line,i)=>{
          let bg=`${T.primaryDim}15`, border=T.border, color=T.text;
          if(chosen!==null){
            if(i===r.lie){ bg=`${T.mint}18`; border=T.mint; color=T.mint; }
            else if(i===chosen){ bg=`${T.rose}18`; border=T.rose; color=T.rose; }
            else { color=T.textMuted; }
          }
          return (
            <button key={i} type="button" onClick={()=>pick(i)} className="ns btn-press"
              style={{ padding:"14px 16px", borderRadius:14, textAlign:"left", background:bg,
                border:`2px solid ${border}`, color, cursor:chosen!==null?"default":"pointer",
                fontSize:14, fontWeight:600, lineHeight:1.5, transition:"all 0.22s",
                fontFamily:"'Quicksand',sans-serif" }}>
              <span style={{ color:T.textDim, fontWeight:800, marginRight:8 }}>{i+1}.</span>
              {line}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SUDOKU ────────────────────────────────────────────────────────────────────
function SudokuGame({ data, difficulty, onScore }) {
  const {puzzle,solution}=data[difficulty];
  const [grid,setGrid]=useState(puzzle.map(r=>[...r]));
  const [checked,setChecked]=useState(false);
  const [finalPts,setFinalPts]=useState(null);

  const update=(r,c,val)=>{
    if(puzzle[r][c]!==0)return;
    const v=parseInt(val)||0;if(v<0||v>4)return;
    const ng=grid.map(row=>[...row]);ng[r][c]=v;setGrid(ng);
  };
  const check=()=>{
    setChecked(true);
    let correct=0;grid.forEach((row,r)=>row.forEach((cell,c)=>{if(cell===solution[r][c])correct++;}));
    setFinalPts(Math.round((correct/16)*320));
  };

  return (
    <div style={{ textAlign:"center" }}>
      <p style={{ color:T.textMuted, fontSize:12, marginBottom:18 }}>
        Fill 1-4. Each number once per row, column & 2×2 box.
      </p>
      <div style={{ display:"inline-grid", gridTemplateColumns:"repeat(4,1fr)", gap:5,
        background:T.border, padding:5, borderRadius:14, marginBottom:18,
        boxShadow:`0 4px 28px ${T.primaryDim}30` }}>
        {grid.map((row,r)=>row.map((cell,c)=>{
          const isG=puzzle[r][c]!==0, ok=checked&&cell===solution[r][c], bad=checked&&cell!==0&&cell!==solution[r][c];
          return <input key={`${r}-${c}`} type="number" min={1} max={4} value={cell||""}
            onChange={e=>update(r,c,e.target.value)} readOnly={isG}
            style={{ width:58, height:58, textAlign:"center", fontSize:22, fontWeight:800,
              background:ok?`${T.mint}20`:bad?`${T.rose}18`:isG?`${T.primaryDim}35`:T.bgCard,
              color:ok?T.mint:bad?T.rose:isG?T.accent:T.text,
              border:`2px solid ${ok?T.mint:bad?T.rose:T.border}`, borderRadius:10, outline:"none",
              fontFamily:"'Quicksand',sans-serif", transition:"all 0.2s", cursor:isG?"default":"text",
              boxShadow:isG?`0 0 10px ${T.primaryDim}30`:"none" }}/>;
        }))}
      </div>
      <br/>
      {!checked&&<Btn onClick={check}>Check Answer ✓</Btn>}
      {checked&&<Banner won={grid.every((row,r)=>row.every((cell,c)=>cell===solution[r][c]))} message="Perfect solve! 🔢"/>}
      {checked&&finalPts!==null&&(
        <Btn onClick={()=>onScore(finalPts)} style={{ marginTop:16 }}>Continue 💜</Btn>
      )}
    </div>
  );
}

// ── FINAL UNLOCK ──────────────────────────────────────────────────────────────
// Krish's message to Nidhi, every word exactly as written, sent as outgoing iMessages
const KRISH_MESSAGES = [
  "hoi",
  "omg i writing this one on a iphone looks so different",
  "it rly has been 4 yrs lovey :)",
  "besides all the notes and gifts and presents\ni just wanna say",
  "i really loves you",
  "i really really loves you",
  "and i really really am gonna marry you\n:)",
  "you mean more than the world too me and everyday i talko to you i feel like im the luckiest there is",
  "still can't believe its been 4 yrs\nwe rly been through it all\nbut hey this last year has been fun :)",
  "senior yr and college\ngot to explore so much with u this last yr alone\nand me plan on keep on doing it",
  "mannnnnnnnnnnnnnn\nlong distance does suck\nbut i find my way to you everytime\nand i promise i will keep on doing it",
  "i not gonna let anyone come between us\ni fight for us\nall the way\nno matter the families or people or wtv else there is",
  "i love you\nand i gonna take care of you\nfor the rest of my life :)",
  "we are endgame\nme believe it",
  "sooooo\nhappy 4 years lovey :)",
  "u such a big part of my life",
  "and make me, me :)",
];

// Special styling overrides for certain messages
function getMsgStyle(msg) {
  if (msg === "i really loves you" || msg === "i really really loves you")
    return { color: "#fff", fontWeight: 700, fontSize: 16 };
  if (msg === "and i really really am gonna marry you\n:)")
    return { color: "#fff", fontWeight: 800, fontSize: 17, background: `linear-gradient(135deg,#7c3aed,#c084fc)`, boxShadow: "0 0 20px #7c3aed66" };
  if (msg === "we are endgame\nme believe it")
    return { color: "#fff", fontWeight: 800, fontSize: 16 };
  if (msg === "and make me, me :)")
    return { color: "#fff", fontWeight: 700, fontStyle: "italic" };
  return {};
}

function FinalUnlock({ totalScore }) {
  const [revealed, setRevealed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const bottomRef = useRef(null);

  // Stagger messages with a typing indicator before each one
  useEffect(() => {
    if (!revealed) return;
    if (visibleCount >= KRISH_MESSAGES.length) {
      setTimeout(() => setShowScore(true), 2800);
      return;
    }
    setTyping(true);
    // Slower pacing: longer “typing” beat for short texts, higher cap for long ones
    const len = KRISH_MESSAGES[visibleCount].length;
    const delay = Math.min(7200, Math.max(2200, len * 55));
    const t = setTimeout(() => {
      setTyping(false);
      setTimeout(() => setVisibleCount(c => c + 1), 650);
    }, delay);
    return () => clearTimeout(t);
  }, [revealed, visibleCount]);

  // Auto-scroll as messages come in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleCount, typing]);

  if (!revealed) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 72, animation: "heartbeat 2s ease-in-out infinite", marginBottom: 20 }}>🔒</div>
      <p style={{ color: T.textSub, marginBottom: 8, fontWeight: 600 }}>You made it through all 14 games.</p>
      <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 28 }}>This last one isn't a game.</p>
      <Btn onClick={() => setRevealed(true)} style={{ padding: "16px 36px", fontSize: 18 }}>Open 💜</Btn>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>

      {/* iMessage header, showing Krish sending to Nidhi */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
          background: `linear-gradient(135deg,${T.primaryDim},${T.accent})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, boxShadow: `0 4px 18px ${T.primaryDim}55`,
          animation: "heartbeat 2.5s ease-in-out infinite" }}>💜</div>
        <p style={{ color: T.textSub, fontWeight: 700, fontSize: 14, margin: 0 }}>Nidhi</p>
        <p style={{ color: T.textDim, fontSize: 11, margin: "2px 0 0" }}>iMessage · 4th anniversary</p>
      </div>

      {/* Outgoing message bubbles, right aligned, iMessage blue-ish */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {KRISH_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end", animation: "fadeUp 0.35s ease" }}>
            <div style={{
              background: `linear-gradient(135deg,${T.primaryDim},#5b21b6)`,
              borderRadius: "18px 18px 4px 18px",
              padding: "10px 14px",
              maxWidth: "82%",
              fontSize: 15,
              fontWeight: 500,
              color: "#fff",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              boxShadow: `0 2px 12px ${T.primaryDim}44`,
              ...getMsgStyle(msg),
            }}>
              {msg}
            </div>
          </div>
        ))}

        {/* Typing indicator, right side (him typing) */}
        {typing && (
          <div style={{ display: "flex", justifyContent: "flex-end", animation: "fadeIn 0.2s ease" }}>
            <div style={{ background: `linear-gradient(135deg,${T.primaryDim},#5b21b6)`,
              borderRadius: "18px 18px 4px 18px", padding: "12px 16px",
              display: "flex", gap: 5, alignItems: "center",
              boxShadow: `0 2px 12px ${T.primaryDim}44` }}>
              {[0,1,2].map(d => (
                <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.6)",
                  animation: `pulse 1.1s ${d * 0.18}s ease-in-out infinite` }}/>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Score card, appears after all messages */}
      {showScore && (
        <div style={{ background: `linear-gradient(135deg,${T.primaryDim}25,${T.accentSoft}15)`,
          borderRadius: 18, padding: 20, textAlign: "center",
          border: `1.5px solid ${T.primary}40`, animation: "fadeUp 0.7s ease", marginTop: 16 }}>
          <p style={{ color: T.textMuted, fontSize: 12, marginBottom: 6 }}>your total score today</p>
          <p className="glow-text" style={{ fontSize: 52, fontWeight: 900, margin: "4px 0",
            fontFamily: "'Nunito',sans-serif" }}>{totalScore}</p>
          <p style={{ color: T.textMuted, fontSize: 12 }}>happy 4 years 💜</p>
        </div>
      )}
    </div>
  );
}

// ── GAME ROUTER ───────────────────────────────────────────────────────────────
function GameRouter({ game, difficulty, onScore, scored, totalScore, devMode, savedScore, onBack }) {
  const [pendingPts, setPendingPts] = useState(null);
  const p={ data:game.data, difficulty, onScore:(pts)=>setPendingPts(pts) };

  if (pendingPts !== null) {
    return <WinCelebration pts={pendingPts} onContinue={()=>{ onScore(pendingPts); setPendingPts(null); }}/>;
  }
  if (scored && !devMode) {
    return <CompletedSummary pts={savedScore} onContinue={onBack}/>;
  }
  const map={
    wordle:WordleGame, connections:ConnectionsGame, trivia:TriviaGame, emoji:EmojiGame,
    memory:MemoryGame, lyrics:LyricsGame, spellingbee:SpellingBeeGame, anagram:AnagramGame,
    timeline:TimelineGame, wordsearch:WordSearchGame, pinpoint:PinpointGame,
    twotruths:TwoTruthsGame, sudoku:SudokuGame,
  };
  if (game.type==="final") return <FinalUnlock totalScore={totalScore}/>;
  const Comp=map[game.type];
  return Comp?<Comp {...p}/>:null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ─── PIN LOCK ────────────────────────────────────────────────────────────────
const CORRECT_PIN = "0515";

function DevTools({ devMode, onToggleDev, onReset, onSkipSplash, state }) {
  if (!devMode) return null;
  return (
    <div style={{ position:"fixed", bottom:12, left:12, right:12, zIndex:200,
      background:`${T.bgCard}f2`, border:`2px solid ${T.gold}`, borderRadius:14,
      padding:"12px 14px", boxShadow:`0 8px 32px ${T.primaryDim}55`, backdropFilter:"blur(8px)" }}>
      <p style={{ color:T.gold, fontWeight:800, fontSize:12, margin:"0 0 8px", textAlign:"center" }}>
        🛠 TEST MODE, only you see this
      </p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
        {!state.started && (
          <button type="button" onClick={onSkipSplash} className="btn-press"
            style={{ background:`${T.primaryDim}30`, border:`1px solid ${T.border}`, color:T.text,
              borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Quicksand',sans-serif" }}>Skip splash</button>
        )}
        <button type="button" onClick={onReset} className="btn-press"
          style={{ background:`${T.rose}22`, border:`1px solid ${T.rose}`, color:T.rose,
            borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Quicksand',sans-serif" }}>Reset progress</button>
        <button type="button" onClick={onToggleDev} className="btn-press"
          style={{ background:"transparent", border:`1px solid ${T.border}`, color:T.textMuted,
            borderRadius:8, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Quicksand',sans-serif" }}>Exit test mode</button>
      </div>
      <p style={{ color:T.textDim, fontSize:10, margin:"8px 0 0", textAlign:"center", lineHeight:1.4 }}>
        All games unlocked · scores can be replayed
      </p>
    </div>
  );
}

function PinLock({ onUnlock }) {
  const [digits, setDigits] = useState([]);
  const [shake, setShake]   = useState(false);
  const [flash, setFlash]   = useState(false); // brief green flash on correct

  const press = d => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      if (next.join("") === CORRECT_PIN) {
        setFlash(true);
        setTimeout(onUnlock, 420);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setDigits([]); }, 600);
      }
    }
  };

  const del = () => setDigits(d => d.slice(0, -1));

  const keys = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    [null,"0","del"],
  ];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%",
        background:`${T.primaryDim}18`, filter:"blur(100px)", top:-150, right:-150 }}/>
      <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%",
        background:`${T.accent}0e`, filter:"blur(90px)", bottom:-100, left:-80 }}/>

      <div style={{ position:"relative", zIndex:1, textAlign:"center", animation:"fadeUp 0.5s ease" }}>
        {/* Lock icon */}
        <div style={{ fontSize:52, marginBottom:18, animation:"heartbeat 3s ease-in-out infinite" }}>💜</div>
        <p style={{ color:T.textSub, fontWeight:700, fontSize:16, marginBottom:32 }}>Enter Passcode</p>

        {/* PIN dots */}
        <div style={{ display:"flex", gap:18, justifyContent:"center", marginBottom:40,
          animation: shake ? "shake 0.5s ease" : flash ? "none" : "none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius:"50%",
              border: `2px solid ${flash ? T.mint : T.primary}`,
              background: flash
                ? T.mint
                : i < digits.length
                  ? T.primary
                  : "transparent",
              transition: "all 0.15s ease",
              boxShadow: i < digits.length ? `0 0 10px ${T.primaryDim}88` : "none",
            }}/>
          ))}
        </div>

        {/* iPhone-style keypad */}
        <div style={{ display:"flex", flexDirection:"column", gap:14, alignItems:"center" }}>
          {keys.map((row, ri) => (
            <div key={ri} style={{ display:"flex", gap:14 }}>
              {row.map((k, ki) => {
                if (k === null) return <div key={ki} style={{ width:72, height:72 }}/>;
                const isDel = k === "del";
                return (
                  <button key={ki} onClick={() => isDel ? del() : press(k)}
                    className="btn-press"
                    style={{
                      width: 72, height: 72, borderRadius:"50%",
                      border: `1.5px solid ${T.border}`,
                      background: isDel ? "transparent" : `${T.primaryDim}20`,
                      color: isDel ? T.textMuted : T.text,
                      fontSize: isDel ? 18 : 26,
                      fontWeight: 700,
                      fontFamily: "'Nunito',sans-serif",
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}
                    onMouseEnter={e => { if (!isDel) e.currentTarget.style.background=`${T.primaryDim}45`; }}
                    onMouseLeave={e => { if (!isDel) e.currentTarget.style.background=`${T.primaryDim}20`; }}
                    onTouchStart={e => { if (!isDel) e.currentTarget.style.background=`${T.primaryDim}55`; }}
                    onTouchEnd={e => { if (!isDel) e.currentTarget.style.background=`${T.primaryDim}20`; }}
                  >
                    {isDel ? "⌫" : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [devMode, setDevMode]      = useState(()=>readDevFromUrl());
  const [unlocked, setUnlocked]    = useState(()=>sessionStorage.getItem("_pin_ok")==="1"||readDevFromUrl());
  const [state,setState]           = useState(()=>{
    const s = loadState();
    const scores = normalizeScores(s.scores);
    if (scores === s.scores) return s;
    const n = { ...s, scores };
    saveState(n);
    return n;
  });
  const [activeGame,setActiveGame] = useState(null);
  const [difficulty,setDifficulty] = useState(null);
  const [showHTP,setShowHTP]       = useState(false);
  const [,setTick]                 = useState(0);

  const gameUnlocked = useCallback(i=>devMode||isUnlocked(i),[devMode]);

  // All hooks must be called unconditionally before any early returns
  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),1000); return()=>clearInterval(t); },[]);
  useEffect(()=>{
    const prevent=e=>e.preventDefault();
    document.addEventListener("contextmenu",prevent);
    return()=>document.removeEventListener("contextmenu",prevent);
  },[]);
  useEffect(()=>{
    if (typeof window==="undefined") return;
    const q=new URLSearchParams(window.location.search);
    const v=(q.get("dev")||"").trim().toLowerCase();
    if (DEV_QUERY_VALUES.has(v)||window.location.hash==="#dev"){
      activateDevMode();
      setDevMode(true);
      setUnlocked(true);
    }
  },[]);

  const recordScore=useCallback((gid,difficulty,pts)=>{
    const key=scoreKey(gid,difficulty);
    setState(prev=>{
      const scores=normalizeScores(prev.scores||{});
      if (!devMode&&scores[key]!==undefined) return prev;
      const n={...prev,scores:{...scores,[key]:pts}};
      saveState(n); return n;
    });
  },[devMode]);

  const resetProgress=useCallback(()=>{
    localStorage.removeItem(STORE_KEY);
    setState(devMode?{started:true}:{});
    setActiveGame(null);
    setDifficulty(null);
  },[devMode]);

  const exitDevMode=useCallback(()=>{
    deactivateDevMode();
    setDevMode(false);
  },[]);

  const skipSplash=useCallback(()=>{
    const n={...state,started:true};
    saveState(n);
    setState(n);
  },[state]);

  const devBar=(
    <DevTools devMode={devMode} state={state} onReset={resetProgress}
      onSkipSplash={skipSplash} onToggleDev={exitDevMode}/>
  );

  // PIN gate, first thing she sees when she opens the link
  if (!unlocked) return (
    <PinLock onUnlock={() => {
      sessionStorage.setItem("_pin_ok","1");
      setUnlocked(true);
    }}/>
  );

  const totalScore=Object.values(normalizeScores(state.scores)).reduce((a,b)=>a+b,0);
  const openGame=(game,i)=>{ if(!gameUnlocked(i))return; setActiveGame({game,index:i}); setDifficulty(null); setShowHTP(false); };

  // ── SPLASH ────────────────────────────────────────────────────────────────
  if (!state.started) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center",
      justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%",
        background:`${T.primaryDim}18`, filter:"blur(100px)", top:-150, right:-150 }}/>
      <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%",
        background:`${T.accent}0e`, filter:"blur(90px)", bottom:-100, left:-80 }}/>
      <div style={{ maxWidth:390, padding:"40px 28px", textAlign:"center", position:"relative",
        zIndex:1, animation:"fadeUp 0.7s ease" }}>
        <div style={{ fontSize:78, animation:"heartbeat 2s ease-in-out infinite", marginBottom:16 }}>💜</div>
        <h1 style={{ fontFamily:"'Pacifico',cursive", fontSize:44, margin:"0 0 6px", lineHeight:1.2 }} className="glow-text">
          Us
        </h1>
        <p style={{ color:T.textSub, fontSize:15, lineHeight:1.9, margin:"18px 0 8px", fontWeight:600 }}>
          Happy 4 years 💜
        </p>
        <p style={{ color:T.textMuted, fontSize:13, lineHeight:1.8, margin:"0 0 30px" }}>
          15 games. All about us.<br/>
          One unlocks every hour starting at {fmtTime(getUnlockDate(0))}.<br/>
          <span style={{ color:T.textDim, fontSize:12 }}>Last one at {fmtTime(getUnlockDate(14))}.</span>
        </p>
        <button onClick={()=>{const n={...state,started:true};saveState(n);setState(n);}} className="btn-press"
          style={{ background:`linear-gradient(135deg,${T.primaryDim},${T.accent})`, color:"#fff",
            border:"none", borderRadius:22, padding:"16px 46px", fontSize:18, fontWeight:800,
            cursor:"pointer", boxShadow:`0 8px 36px ${T.primaryDim}66`, fontFamily:"'Quicksand',sans-serif" }}>
          Start the Day 🔓
        </button>
        <p style={{ color:T.textDim, fontSize:11, marginTop:20 }}>
          {fmtTime(getUnlockDate(0))} → {fmtTime(getUnlockDate(14))} · one per hour
        </p>
      </div>
      {devBar}
    </div>
  );

  // ── GAME VIEW ─────────────────────────────────────────────────────────────
  if (activeGame) {
    const {game,index}=activeGame;
    const scores=normalizeScores(state.scores);
    const prog=game.type==="final"?null:gameProgress(scores,game.id);
    const diffScored=difficulty?isDifficultyScored(scores,game.id,difficulty):false;
    const ts=Object.values(scores).reduce((a,b)=>a+b,0);

    return (
      <div style={{ minHeight:"100vh", background:T.bg, position:"relative" }}>
        <style>{CSS}</style>
        <Particles/>
        {showHTP && game.howToPlay && (
          <HowToPlayModal steps={game.howToPlay} onClose={()=>setShowHTP(false)}/>
        )}
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%",
          background:`${T.primaryDim}12`, filter:"blur(80px)", top:-100, right:-100 }}/>

        <div style={{ maxWidth:480, margin:"0 auto", padding:"0 0 80px", position:"relative", zIndex:1 }}>
          {/* Header */}
          <div style={{ padding:"22px 20px 0", display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <button onClick={()=>setActiveGame(null)} className="btn-press"
              style={{ background:`${T.primaryDim}20`, border:`1.5px solid ${T.border}`, borderRadius:13,
                color:T.textSub, padding:"10px 14px", cursor:"pointer", fontSize:18,
                fontFamily:"'Quicksand',sans-serif", transition:"all 0.2s" }}>←</button>
            <div style={{ flex:1 }}>
              <p style={{ color:T.textMuted, fontSize:11, margin:"0 0 2px", fontWeight:700,
                letterSpacing:0.5, textTransform:"uppercase" }}>
                {game.unlockLabel} · Game {index+1}/15{difficulty?" · "+difficulty:""}
              </p>
              <h2 style={{ color:T.text, margin:0, fontSize:18, fontWeight:800 }}>{game.emoji} {game.title}</h2>
            </div>
            {/* How to play button */}
            {game.howToPlay && (!diffScored||devMode) && (
              <button onClick={()=>setShowHTP(true)} className="btn-press"
                style={{ background:`${T.primaryDim}20`, border:`1.5px solid ${T.border}`, borderRadius:12,
                  color:T.textSub, padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:700,
                  fontFamily:"'Quicksand',sans-serif" }}>📖 How</button>
            )}
            {difficulty&&diffScored&&<div style={{ background:`${T.mint}20`, border:`1px solid ${T.mint}50`,
              borderRadius:10, padding:"4px 10px", color:T.mint, fontSize:13, fontWeight:800 }}>
              +{scores[scoreKey(game.id,difficulty)]}
            </div>}
            {!difficulty&&prog&&prog.done>0&&<div style={{ background:`${T.mint}20`, border:`1px solid ${T.mint}50`,
              borderRadius:10, padding:"4px 10px", color:T.mint, fontSize:13, fontWeight:800 }}>
              {prog.done}/{prog.total}{gameTotalPts(scores,game.id)>0?` · ${gameTotalPts(scores,game.id)} pts`:""}
            </div>}
          </div>

          {/* Difficulty picker */}
          {!difficulty && game.type!=="final" ? (
            <div style={{ padding:"0 20px", animation:"fadeUp 0.4s ease" }}>
              <p style={{ color:T.textSub, marginBottom:6, textAlign:"center", fontWeight:600, fontSize:15 }}>
                {prog&&prog.done>0?`Pick your next difficulty (${prog.done}/${prog.total} done)`:"Pick your difficulty ✨"}
              </p>
              <p style={{ color:T.textMuted, textAlign:"center", fontSize:13, marginBottom:20 }}>
                {game.teaser}
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {[["easy","🟢 Easy","Warm up. No stress.",100,"#6ee7b7"],
                  ["medium","🟡 Medium","You'll actually have to think.",220,T.gold],
                  ["hard","🔴 Hard","Deep cuts only.",380,T.rose]].map(([d,label,desc,maxPts,col])=>{
                  const done=isDifficultyScored(scores,game.id,d);
                  const got=scores[scoreKey(game.id,d)];
                  return (
                  <button key={d} onClick={()=>setDifficulty(d)} className="card-hover btn-press"
                    style={{ background:done?`${col}12`:`${T.primaryDim}15`, border:`2px solid ${done?col:T.border}`,
                      borderRadius:18, padding:"18px 20px", textAlign:"left",
                      cursor:"pointer", opacity:done&&!devMode?0.85:1,
                      transition:"all 0.22s", fontFamily:"'Quicksand',sans-serif" }}
                    onMouseEnter={e=>{if(done&&!devMode)return;e.currentTarget.style.borderColor=col;e.currentTarget.style.background=`${col}14`;e.currentTarget.style.boxShadow=`0 4px 18px ${col}30`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=done?col:T.border;e.currentTarget.style.background=done?`${col}12`:`${T.primaryDim}15`;e.currentTarget.style.boxShadow="none";}}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <p style={{ color:T.text, fontWeight:800, margin:0, fontSize:16 }}>{label}{done?" ✓":""}</p>
                      <span style={{ color:col, fontWeight:800, fontSize:13 }}>
                        {done?`+${got} pts`:`up to ${maxPts} pts`}
                      </span>
                    </div>
                    <p style={{ color:T.textMuted, margin:0, fontSize:13 }}>
                      {done&&!devMode?"Tap to see your score ✓":desc}
                    </p>
                  </button>
                );})}
              </div>
              {/* How to play link on difficulty page too */}
              {game.howToPlay && (
                <button onClick={()=>setShowHTP(true)}
                  style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer",
                    fontSize:13, marginTop:16, width:"100%", textAlign:"center",
                    fontFamily:"'Quicksand',sans-serif", fontWeight:600 }}>
                  📖 How to play this game
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding:"0 20px", animation:"fadeUp 0.35s ease" }}>
              <GameRouter game={game} difficulty={difficulty} scored={diffScored} devMode={devMode} totalScore={ts}
                savedScore={diffScored?scores[scoreKey(game.id,difficulty)]:undefined}
                onBack={()=>setDifficulty(null)}
                onScore={pts=>{ recordScore(game.id,difficulty,pts); setDifficulty(null); }}/>
            </div>
          )}
        </div>
        {devBar}
      </div>
    );
  }

  // ── MAIN FEED ─────────────────────────────────────────────────────────────
  const unlockedCount=devMode?GAMES.length:GAMES.filter((_,i)=>isUnlocked(i)).length;
  const feedScores=normalizeScores(state.scores);
  const completedCount=GAMES.filter(g=>g.type!=="final"&&isGameFullyComplete(feedScores,g.id)).length;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, position:"relative" }}>
      <style>{CSS}</style>
      <Particles/>
      <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%",
        background:`${T.primaryDim}12`, filter:"blur(120px)", top:-200, right:-200 }}/>
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%",
        background:`${T.accent}08`, filter:"blur(80px)", bottom:50, left:-150 }}/>

      <div style={{ maxWidth:480, margin:"0 auto", position:"relative", zIndex:1 }}>
        <div style={{ padding:"38px 24px 20px", textAlign:"center" }}>
          <div style={{ fontSize:44, animation:"heartbeat 2.5s ease-in-out infinite", marginBottom:8 }}>💜</div>
          <h1 style={{ fontFamily:"'Pacifico',cursive", fontSize:34, margin:"0 0 4px" }} className="glow-text">Us</h1>
          <p style={{ color:T.textMuted, fontSize:13, margin:"0 0 22px", fontWeight:600 }}>
            Happy 4th anniversary ✨ · one game per hour
          </p>
          {devMode&&(
            <p style={{ color:T.gold, fontSize:12, fontWeight:800, margin:"-14px 0 18px",
              background:`${T.gold}18`, border:`1px solid ${T.gold}55`, borderRadius:10, padding:"8px 12px" }}>
              🛠 Test mode, all games open
            </p>
          )}
          <div style={{ display:"flex", gap:0, background:T.bgCard, borderRadius:20,
            border:`1.5px solid ${T.border}`, overflow:"hidden", boxShadow:`0 4px 28px ${T.primaryDim}20` }}>
            {[[unlockedCount,"unlocked",T.accent],[completedCount,"done",T.mint],[totalScore,"pts",T.primary]].map(([val,label,col],i)=>(
              <div key={label} style={{ flex:1, padding:"16px 8px", textAlign:"center",
                borderRight:i<2?`1px solid ${T.border}`:"none" }}>
                <p style={{ color:col, fontWeight:900, fontSize:26, margin:"0 0 2px", fontFamily:"'Nunito',sans-serif" }}>{val}</p>
                <p style={{ color:T.textDim, fontSize:10, margin:0, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:"0 16px 44px", display:"flex", flexDirection:"column", gap:9 }}>
          {GAMES.map((game,i)=>{
            const unlocked=gameUnlocked(i);
            const isFinal=game.type==="final";
            const prog=isFinal?null:gameProgress(feedScores,game.id);
            const completed=!isFinal&&isGameFullyComplete(feedScores,game.id);
            const partial=prog&&prog.done>0&&!completed;
            const pts=isFinal?0:gameTotalPts(feedScores,game.id);
            const justUnlocked=unlocked&&(!prog||prog.done===0)&&i===unlockedCount-1;

            return (
              <div key={game.id} onClick={()=>openGame(game,i)}
                className={unlocked?"card-hover":""}
                style={{
                  background:completed?`linear-gradient(135deg,${T.primaryDim}22,${T.accent}12)`:partial?`linear-gradient(135deg,${T.primaryDim}14,${T.bgCard})`:unlocked?T.bgCard:T.bgDeep,
                  border:`2px solid ${completed?T.primaryDim:partial?`${T.mint}88`:unlocked?`${T.primaryDim}${justUnlocked?"cc":"55"}`:T.textDim+"28"}`,
                  borderRadius:18, padding:"16px 18px", cursor:unlocked?"pointer":"default",
                  display:"flex", alignItems:"center", gap:14, transition:"all 0.25s",
                  opacity:unlocked?1:0.36,
                  boxShadow:completed?`0 4px 24px ${T.primaryDim}30`:justUnlocked?`0 0 22px ${T.primaryDim}35`:"none",
                  animation:justUnlocked?"unlockPop 0.6s ease":"none",
                }}>
                <div style={{ width:54, height:54, borderRadius:15, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:24,
                  background:completed?`linear-gradient(135deg,${T.primaryDim},${T.primary})`:unlocked?`${T.primaryDim}28`:`${T.primaryDim}10`,
                  boxShadow:completed?`0 4px 18px ${T.primaryDim}55`:justUnlocked?`0 0 16px ${T.primaryDim}50`:"none" }}>
                  {completed?"✨":partial?"⭐":unlocked?game.emoji:"🔒"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <p style={{ color:completed?T.accent:unlocked?T.text:`${T.textDim}99`,
                      fontWeight:800, margin:0, fontSize:15 }}>{game.title}</p>
                    {unlocked&&!completed&&!partial&&<span style={{ background:`${T.primaryDim}30`, color:T.textSub,
                      fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10,
                      textTransform:"uppercase" }}>{game.unlockLabel}</span>}
                    {partial&&<span style={{ background:`${T.mint}28`, color:T.mint,
                      fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10 }}>{prog.done}/{prog.total}</span>}
                  </div>
                  {completed&&<p style={{ color:T.textMuted, fontSize:12, margin:0 }}>{pts} pts · all levels · {game.unlockLabel}</p>}
                  {partial&&<p style={{ color:T.textMuted, fontSize:12, margin:0 }}>{prog.done}/3 difficulties · {pts} pts so far</p>}
                  {unlocked&&!completed&&!partial&&<p style={{ color:T.textMuted, fontSize:12, margin:0,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{game.teaser}</p>}
                  {!unlocked&&(
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
                      <p style={{ color:T.textDim, fontSize:11, margin:0, fontWeight:700 }}>{game.unlockLabel}</p>
                      <Countdown index={i}/>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right", flexShrink:0, minWidth:36 }}>
                  {unlocked&&!completed&&(
                    <div style={{ width:32, height:32, borderRadius:"50%",
                      background:`linear-gradient(135deg,${T.primaryDim},${T.accent})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:`0 0 14px ${T.primaryDim}60`, fontSize:partial?11:15, color:"#fff",
                      fontWeight:partial?800:400 }}>{partial?`${prog.done}/3`:"→"}</div>
                  )}
                  {completed&&<span style={{ color:T.primary, fontSize:14, fontWeight:900 }}>+{pts}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ paddingBottom: devMode ? 100 : 44 }}/>
        {devBar}
      </div>
    </div>
  );
}
