/**
 * Noticing `v1` — the Persian surface.
 *
 * Authored as a declared draft (`reviewStatus: "draft"`), same convention as
 * `feelings-needs/v1/surface.fa.ts`: structurally complete rather than
 * absent, so a Persian-reading user gets Persian chrome around a known,
 * flagged state rather than a silent fallback (build plan §3 — a locale with
 * no surface throws; it does not fall back).
 *
 * // PHASE 2: like `surface.en.ts`, every string here is placeholder — a
 * rough, unreviewed rendering of the English placeholder, not authored
 * Persian copy. Both surfaces get replaced together in phase 2.
 */

import type {
  CapacityCopySurface,
  CatchCopySurface,
  CatchLexiconSurface,
  FrameSurface,
  GraduationSurface,
  LoopCopySurface,
  NoticingSurface,
  PaletteEntrySurface,
} from "../types";

const PLACES_FA: PaletteEntrySurface[] = [
  { id: "home", label: "خانه" },
  { id: "commute", label: "مسیر رفت‌وآمد" },
  { id: "work", label: "محل کار" },
  { id: "shop_or_street", label: "مغازه یا خیابان" },
  { id: "someones_house", label: "خانهٔ کسی دیگر" },
];

const CUES_FA: PaletteEntrySurface[] = [
  { id: "face", label: "چهره‌اش" },
  { id: "went_quiet", label: "اینکه ساکت شده بود" },
  { id: "stayed_late", label: "اینکه دیر وقت هنوز آنجا بود" },
  { id: "how_i_stood", label: "طرز ایستادنش" },
  { id: "said_in_passing", label: "چیزی که گذرا گفت" },
  { id: "kept_checking_the_time", label: "اینکه مدام ساعت را نگاه می‌کرد" },
];

const NEEDS_FA: PaletteEntrySurface[] = [
  { id: "rest", label: "استراحت" },
  { id: "connection", label: "ارتباط" },
  { id: "safety", label: "امنیت" },
  { id: "space", label: "فضا" },
  { id: "ease", label: "آرامش" },
  { id: "to_be_seen", label: "دیده‌شدن" },
  { id: "understanding", label: "درک شدن" },
  { id: "support", label: "حمایت" },
  { id: "respect", label: "احترام" },
  { id: "autonomy", label: "استقلال" },
  { id: "warmth", label: "گرما" },
  { id: "food", label: "غذا" },
  { id: "a_seat", label: "یک جای نشستن" },
  { id: "a_hand", label: "یک دست کمک" },
  { id: "to_know_whats_going_on", label: "دانستن اینکه چه خبر است" },
  { id: "to_know_its_not_just_them", label: "دانستن اینکه تنها او نیست" },
  { id: "direction", label: "راهنمایی" },
  { id: "to_be_left_alone", label: "تنها گذاشته‌شدن" },
  { id: "nothing_right_now", label: "فعلاً هیچ‌چیز از کسی" },
  { id: "privacy", label: "حریم خصوصی" },
];

const FRAME_FA: FrameSurface = {
  intro: {
    title: "پیش از تمرین روزانه — یک چیز برای امتحان",
    body: "[پیش‌نویس] یک گرم‌کنندهٔ کوتاه.",
    begin: "شروع",
  },
  beatOne: {
    moment: {
      prompt: "زمانی را به یاد بیاور که کسی بدون خواستنت کمکت کرد. چه اتفاقی افتاد؟",
      reroutePrompt: "چیزی به ذهنت نمی‌رسد؟",
      rerouteLabel: "زمانی که آرزو می‌کردی کسی این کار را می‌کرد",
    },
    unsaidNeed: {
      prompt: "به چه چیزی نیاز داشتی که به زبان نیاوردی؟",
      otherLabel: "چیز دیگری — بنویس",
    },
    visibleCues: {
      prompt: "او نمی‌توانست آن را بشنود. پس واقعاً چه چیزی می‌توانست ببیند؟",
      otherLabel: "چیز دیگری — بنویس",
    },
    turn: {
      line: "[پیش‌نویس] او بدون اینکه چیزی بگویی، از یکی به دیگری رسید.",
    },
    reverse: {
      prompt: "دیروز — حال کسی که کنارش نشسته بودی چطور بود؟",
      knowLabel: "می‌دانم",
      noIdeaLabel: "هیچ ایده‌ای ندارم",
      noIdeaResponse: "[پیش‌نویس] طبیعی است. هنوز نگاه نمی‌کردی.",
    },
  },
  beatTwo: {
    prompt: "اگر امروز به کسی کمک کوچکی پیشنهاد می‌دادی، چقدر خوشحال می‌شد؟",
    options: [
      { id: "not_very", label: "نه‌چندان" },
      { id: "somewhat", label: "تا حدی" },
      { id: "very", label: "خیلی" },
    ],
    correction: {
      line: "[پیش‌نویس] آدم‌ها این را دست‌کم می‌گیرند.",
      body: "[پیش‌نویس] کمک‌کننده‌ها زحمت را بیشتر و خوشحالی طرف مقابل را کمتر از واقعیت تصور می‌کنند.",
    },
  },
};

const LOOP_FA: LoopCopySurface = {
  placePrompt: "امروز کجا بودی؟",
  placeOtherLabel: "جای دیگری — بنویس",
  personPrompt: "چه کسی آنجا بود؟",
  personThirdPartyWarning: "داری دربارهٔ کس دیگری می‌نویسی. طوری بنویس که انگار او می‌تواند بخواندش.",
  observationPrompt: "واقعاً چه چیزی دیدی یا شنیدی؟",
  needPrompt: "اگر این به چیزی که برایش مهم است اشاره دارد — چه چیزی؟",
  needOtherLabel: "چیز دیگری — بنویس",
  needNotSure: "مطمئن نیستم — اشکالی ندارد",
  smallThingPrompt: "چیز کوچکی هست که بخواهی پیشنهاد بدهی یا بپرسی؟",
  smallThingSkip: "رد شو — توجه‌کردن کافی است",
  capacityPrompt: "چه چیزی داشتی که این را ممکن کرد؟",
  capacityOtherLabel: "چیز دیگری — بنویس",
  close: "دیده شد.",
  addAnotherAsk: "امروز کس دیگری را هم دیدی؟",
  addAnotherCapped: "[پیش‌نویس] برای امروز جای خوبی برای توقف است.",
  finish: "فعلاً همین",
  recapHeading: "آنچه امروز متوجه شدی",
  recapNotRelated: "[پیش‌نویس] هرکدام از این‌ها مستقل از دیگری‌اند.",
};

const CATCHES_FA: CatchLexiconSurface[] = [
  {
    type: "read",
    triggers: ["بی‌ادب", "سخت‌گیر", "تنبل"],
    line: "[پیش‌نویس] این برداشت توست. واقعاً چه دیدی؟",
    hints: [],
  },
  {
    type: "strategy",
    triggers: ["یک سواری", "پول", "یک شغل"],
    line: "[پیش‌نویس] این یک راه برای رفع آن است. زیرش چیست؟",
    hints: ["rest", "support", "safety"],
  },
  {
    type: "protective",
    triggers: ["باید", "لازم است", "وظیفه‌ام است"],
    line: "[پیش‌نویس] پیش از اینکه این به یک برنامه تبدیل شود، ارزش نگاه‌کردن دارد.",
    hints: [],
    routeTo: "reflect",
  },
];

const CATCH_COPY_FA: CatchCopySurface = {
  dismiss: "الان نه",
  note: "[پیش‌نویس] فقط بازتاب حرف‌های خودت.",
};

const CAPACITY_FA: CapacityCopySurface = {
  prompt: "چه چیزی داشتی که این را ممکن کرد؟",
  chips: {
    head: [
      { id: "a_free_minute", label: "یک دقیقهٔ آزاد" },
      { id: "knew_what_to_say", label: "می‌دانستم چه بگویم" },
    ],
    hands: [
      { id: "free_hands", label: "دست‌های آزاد" },
      { id: "was_already_going_that_way", label: "همان مسیر را می‌رفتم" },
    ],
    heart: [
      { id: "felt_steady", label: "حس ثباتی داشتم" },
      { id: "wanted_to", label: "می‌خواستم" },
    ],
  },
  otherLabel: "چیز دیگری — بنویس",
};

const GRADUATION_FA: GraduationSurface = {
  line: "این اواخر خودت داری توجه می‌کنی.",
  body: "[پیش‌نویس] کل ماجرا همین است.",
  close: "ادامه بده",
};

export const SURFACE_FA: NoticingSurface = {
  reviewStatus: "draft",
  places: PLACES_FA,
  cues: CUES_FA,
  needs: NEEDS_FA,
  frame: FRAME_FA,
  loop: LOOP_FA,
  catches: CATCHES_FA,
  catchCopy: CATCH_COPY_FA,
  capacity: CAPACITY_FA,
  graduation: GRADUATION_FA,
  thirdPartyWarning: "داری دربارهٔ کس دیگری می‌نویسی. طوری بنویس که انگار او می‌تواند بخواندش.",
};
