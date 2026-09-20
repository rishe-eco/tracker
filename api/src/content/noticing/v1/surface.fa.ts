/**
 * Noticing `v1` — the Persian surface.
 *
 * Authored as a declared draft (`reviewStatus: "draft"`), same convention as
 * `feelings-needs/v1/surface.fa.ts`: structurally complete rather than
 * absent, so a Persian-reading user gets Persian chrome around a known,
 * flagged state rather than a silent fallback.
 *
 * Register follows the same house rules as Feelings & Needs' Persian surface
 * (`04-conventions.md` §7b, restated by `noticingGuardrails.unit.test.ts`'s
 * Persian block): informal تو/کن throughout, never شما/کنید; one Persian word
 * per concept — «حلقه» for the loop session, matching what the client already
 * ships in `locales/fa/common.json`; «نشست» never appears as a bare noun
 * (only as the verb, e.g. «نشسته بودی»); no Arabic look-alike letters
 * (ي ك ة ى) — Persian ی ک ه throughout. This is a first authored pass, not a
 * native-reviewed one — that review is explicitly out of scope for the
 * prototype (spec §2).
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

/** First person, matching `surface.en.ts` — see the note there on why. */
const CUES_FA: PaletteEntrySurface[] = [
  { id: "face", label: "چهره‌ام" },
  { id: "went_quiet", label: "اینکه ساکت شده بودم" },
  { id: "stayed_late", label: "اینکه دیروقت هنوز آنجا بودم" },
  { id: "how_i_stood", label: "طرز ایستادنم" },
  { id: "said_in_passing", label: "چیزی که گذرا گفتم" },
  { id: "kept_checking_the_time", label: "اینکه مدام ساعت را نگاه می‌کردم" },
];

const NEEDS_FA: PaletteEntrySurface[] = [
  { id: "rest", label: "استراحت" },
  { id: "connection", label: "ارتباط" },
  { id: "to_matter", label: "مهم بودن" },
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
  // "یاری" rather than «کمک» — the same lexical choice `surface.en.ts` makes
  // ("a hand", not "help") kept across the locale rather than lost in
  // translation.
  { id: "a_hand", label: "یک دست یاری" },
  { id: "to_know_whats_going_on", label: "دانستن اینکه چه خبر است" },
  { id: "to_know_its_not_just_them", label: "دانستن اینکه تنها او نیست" },
  { id: "direction", label: "راهنمایی" },
  { id: "to_be_left_alone", label: "تنها گذاشته‌شدن" },
  { id: "nothing_right_now", label: "فعلاً هیچ‌چیز از کسی" },
];

const FRAME_FA: FrameSurface = {
  intro: {
    title: "پیش از حلقهٔ روزانه — یک تمرین کوتاه",
    body: "یک گرم‌کردن کوتاه و یک‌باره. یک خاطره را برمی‌گردانی و از طرف دیگر نگاهش می‌کنی — از طرف کسی که تو را بدون گفتن فهمید.",
    begin: "شروع",
  },
  beatOne: {
    moment: {
      prompt: "زمانی را به یاد بیاور که کسی بدون اینکه بخواهی کمکت کرد. چه اتفاقی افتاد؟",
      helper: "یک لحظهٔ معمولی کافی است — لازم نیست بزرگ‌ترین چیزی باشد که داری.",
      reroutePrompt: "چیزی به ذهنت نمی‌رسد؟",
      rerouteLabel: "زمانی که آرزو می‌کردی کسی این کار را می‌کرد",
    },
    unsaidNeed: {
      prompt: "به چه چیزی نیاز داشتی که به زبان نیاوردی؟",
      helper: "هرچه بود — حتی اگر الان کوچک به‌نظر برسد.",
      otherLabel: "چیز دیگری — بنویس",
    },
    visibleCues: {
      prompt: "او نمی‌توانست آن را بشنود. پس واقعاً چه چیزی می‌توانست ببیند؟",
      helper: "هرکدام که به‌نظرت درست می‌آید را انتخاب کن. می‌توانی بیش از یکی را انتخاب کنی.",
      otherLabel: "چیز دیگری — بنویس",
    },
    turn: {
      line: "او بدون اینکه چیزی بگویی، از یکی به آن‌یکی رسید. تمام ماجرا همین است.",
    },
    reverse: {
      prompt: "دیروز — حال کسی که کنارش نشسته بودی چطور بود؟",
      knowLabel: "می‌دانم",
      noIdeaLabel: "هیچ ایده‌ای ندارم",
      knowResponse: "پس دیگر داشتی نگاه می‌کردی.",
      noIdeaResponse:
        "طبیعی است. این‌طور نیست که برایت مهم نباشد — فقط نگاه نمی‌کردی. نگاه‌کردن چیزی است که می‌توانی در آن بهتر شوی.",
    },
  },
  beatTwo: {
    prompt: "اگر امروز کاری کوچک برای کسی انجام می‌دادی، چقدر خوشحال می‌شد؟",
    options: [
      { id: "not_very", label: "نه‌چندان" },
      { id: "somewhat", label: "تا حدی" },
      { id: "very", label: "خیلی" },
    ],
    correction: {
      line: "بیشتر آدم‌ها این را کمتر از واقعیت حدس می‌زنند.",
      body: "کسانی که این را بررسی کرده‌اند برعکسش را می‌بینند: آدم‌ها معمولاً خوشحال‌تر از چیزی‌اند که حدس می‌زنی، از خواسته‌شدن کمتر معذب می‌شوند، و پیشنهاددادن هم برای خودِ پیشنهاددهنده حسِ بهتری دارد از آنچه فکر می‌کنی.",
    },
  },
};

const LOOP_FA: LoopCopySurface = {
  placePrompt: "امروز کجا بودی؟",
  placePromptTerse: "کجا؟",
  placeOtherLabel: "جای دیگری — بنویس",
  personPrompt: "چه کسی آنجا بود؟",
  personPromptTerse: "چه کسی؟",
  personThirdPartyWarning: "یک نفر دیگر هم در این یادداشت هست. طوری بنویس که انگار او می‌تواند بخواندش.",
  observationPrompt: "واقعاً چه چیزی دیدی یا شنیدی؟",
  observationPromptTerse: "چه دیدی؟",
  needPrompt: "اگر این به چیزی که برایش مهم است اشاره دارد — چه چیزی؟",
  needPromptTerse: "اگر جایی اشاره دارد — به چه چیزی؟",
  needOtherLabel: "چیز دیگری — بنویس",
  needNotSure: "مطمئن نیستم — اشکالی ندارد",
  smallThingPrompt: "چیز کوچکی هست که بخواهی پیشنهاد بدهی یا بپرسی؟",
  smallThingSkip: "رد شو — توجه‌کردن کافی است",
  capacityPrompt: "چه چیزی داشتی که این را ممکن کرد؟",
  capacityOtherLabel: "چیز دیگری — بنویس",
  close: "✓ دیده شد.",
  addAnotherAsk: "امروز کس دیگری را هم دیدی؟",
  addAnotherCapped: "همین برای یک حلقه کافی است — بقیه‌اش می‌ماند.",
  finish: "فعلاً همین",
  recapHeading: "آنچه امروز متوجه شدی",
  recapNotRelated: "هرکدام از این‌ها مستقل از دیگری‌اند — ربط‌دادنشان، اگر اصلاً اتفاق بیفتد، بعداً می‌آید.",
};

const CATCHES_FA: CatchLexiconSurface[] = [
  {
    type: "read",
    triggers: [
      "بی‌ادب",
      "سخت‌گیر",
      "تنبل",
      "خودخواه",
      "بی‌مسئولیت",
      "بی‌کفایت",
      "سرد",
      "مغرور",
      "آزاردهنده",
      "بی‌توجه",
    ],
    line: "'{{word}}' برداشتِ توست. واقعاً چه دیدی؟",
    hints: [],
  },
  {
    type: "strategy",
    triggers: [
      "یک سواری",
      "پول",
      "یک شغل",
      "کسی که بهش زنگ بزند",
      "وام",
      "جایی برای ماندن",
      "کسی برای حرف‌زدن",
      "پرستار بچه",
      "وکیل",
      "یک لطف",
    ],
    line: "{{word}} یک راه برای رفع آن است. زیرش چیست؟",
    hints: ["استراحت؟", "حمایت؟", "امنیت؟"],
  },
  {
    type: "protective",
    triggers: [
      "باید",
      "لازم است",
      "وظیفه‌ام است",
      "احساس گناه می‌کنم",
      "بد می‌شود اگر نکنم",
      "کمترین کاری که می‌توانم بکنم",
      "به آن‌ها مدیونم",
      "مجبورم",
      "قرار است",
    ],
    line: "'{{word}}' پیش از اینکه این به یک برنامه تبدیل شود، ارزش نگاه‌کردن دارد.",
    hints: [],
    routeTo: "reflect",
  },
];

const CATCH_COPY_FA: CatchCopySurface = {
  dismiss: "بگذار همین بماند — منظورم همین بود",
  note: "حرف‌های خودت‌اند، فقط بازتاب داده شده.",
};

const CAPACITY_FA: CapacityCopySurface = {
  prompt: "چه چیزی داشتی که این را ممکن کرد؟",
  chips: {
    head: [
      { id: "a_free_minute", label: "یک دقیقهٔ آزاد" },
      { id: "knew_what_to_say", label: "می‌دانستم چه بگویم" },
      { id: "wasnt_rushing", label: "عجله نداشتم" },
      { id: "remembered_something_useful", label: "چیز مفیدی به یادم آمد" },
      { id: "had_the_headspace", label: "ذهنم باز بود" },
      { id: "felt_clear_about_it", label: "حسِ روشنی نسبت به آن داشتم" },
    ],
    hands: [
      { id: "free_hands", label: "دست‌های آزاد" },
      { id: "was_already_heading_that_way", label: "همان مسیر را می‌رفتم" },
      { id: "had_what_was_needed", label: "آنچه لازم بود را داشتم" },
      { id: "could_spare_it", label: "می‌توانستم از آن بگذرم" },
      { id: "was_already_there", label: "همان‌جا بودم" },
      { id: "nothing_else_in_my_hands", label: "دستم به چیز دیگری بند نبود" },
    ],
    heart: [
      { id: "felt_steady", label: "حس ثباتی داشتم" },
      { id: "wanted_to", label: "می‌خواستم" },
      { id: "had_the_patience", label: "صبر داشتم" },
      { id: "wasnt_stretched_thin", label: "تحت فشار نبودم" },
      { id: "felt_warm_toward_them", label: "نسبت به او احساس گرمی داشتم" },
      { id: "had_some_to_spare", label: "از آن مقداری اضافه داشتم" },
    ],
  },
  otherLabel: "چیز دیگری — بنویس",
};

const GRADUATION_FA: GraduationSurface = {
  line: "این اواخر خودت داری توجه می‌کنی.",
  body: "تمام ماجرا همین است. حالا مال خودت شده — یادآوری‌ها فقط داربست بودند.",
  close: "هروقت خواستی ادامه بده.",
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
  thirdPartyWarning: "یک نفر دیگر هم در این یادداشت هست. طوری بنویس که انگار او می‌تواند بخواندش.",
};
