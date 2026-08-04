/**
 * Feelings & Needs `v1` — the Persian surface (the words).
 *
 * Realizes the same locale-invariant spec as `surface.en.ts`. Everything the
 * English file's header says about the four guardrails applies here unchanged;
 * what follows is only what is different about doing it in Persian.
 *
 * **`reviewStatus` is `draft`, and that is not a formality.** This was authored
 * against the spec and the register rules, not post-edited by a native speaker.
 * The app says so out loud (`banners.draftLocale`) rather than hiding it,
 * because for *this* module the words are not the wrapper around the
 * intervention — they are the intervention. P3 trains granularity by giving a
 * person better words for their own states; a word that is merely correct, and
 * not the one they would reach for, teaches nothing. A calque in a form label is
 * an irritation. A calque in this palette is a broken mechanism.
 *
 * What a native pass specifically owes, beyond reading it through:
 *
 * 1. **The texture palette.** These have to stay *bodily*. Persian has a strong
 *    pull from sensation toward feeling — «دلم گرفته» is a sensation by grammar
 *    and a sadness by usage — and every word that drifts across collapses the
 *    body step into naming the feeling twice, which is the one thing P2 exists
 *    to prevent. The uncertain ones are marked below.
 * 2. **The feeling palette.** Not whether each word is a correct translation,
 *    but whether it is the word someone would actually reach for. Some entries
 *    below are the accepted term where a native speaker might want the
 *    colloquial one.
 * 3. **The lexicon triggers** (`LEXICON_FA`). English faux-feelings are
 *    adjectives; the Persian ones are mostly passive constructions, and which
 *    surface forms people really type is an empirical question this file guesses
 *    at. Under-triggering is the safe failure and is what it is tuned for.
 * 4. **The six Persian-only concepts** at the end of the lexicon. These are
 *    authored, not translated — there is no published Persian faux-feelings list
 *    to translate from (the Persian NVC centre, زبان زندگی, publishes the
 *    feelings list and not Rosenberg's chapter-4 table). So the judgment call is
 *    entirely ours: is each one really a *reading of what someone did* rather
 *    than a felt state, and is it distinct from the concept next to it? A native
 *    reviewer disagreeing with one of these is the most useful thing that could
 *    happen to this file.
 *
 * Register (`04-conventions.md` §7b): informal تو/کن throughout — no شما, no
 * imperative ـید. Note the trap that section records: Persian imperatives drop
 * ید (کنید → کن) but subjunctives after اگر / تا / بخواهی keep ی (کنید → کنی),
 * and the two look identical. Both appear below, deliberately.
 */

import type {
  CatchCopySurface,
  FeelingsNeedsSurface,
  FrameSurface,
  GraduationSurface,
  LexiconCategorySurface,
  LexiconConceptSurface,
  LoopCopySurface,
  PaletteEntrySurface,
} from "../types";

// ─── Palettes ────────────────────────────────────────────────────────────────

/**
 * Where in the body.
 *
 * `carryLabel` matters more here than in English. The carry template is bare
 * («{{place}} —»), so each location supplies its own preposition *and its own
 * possessive suffix* — and Persian attaches that suffix according to how the
 * word ends: سینه → سینه‌ات, گلو → گلویت, فک → فکت. No rule the code could
 * apply gets all three, so the surface states each one.
 *
 * `stomach` is «دل», not «شکم» or «معده». The English id points at the gut
 * knot, and in Persian that sensation lives in the دل — «دلم شور می‌زند»,
 * «دلم ریخت». «شکم» is where food goes; nobody feels dread there. This is rule
 * 7a working as intended: the concept, not the word.
 *
 * `jaw` is «فک», the word people use, not «آرواره», the word in the anatomy
 * textbook.
 */
const LOCATIONS_FA: PaletteEntrySurface[] = [
  { id: "chest", label: "سینه", carryLabel: "توی سینه‌ات" },
  { id: "throat", label: "گلو", carryLabel: "توی گلویت" },
  { id: "stomach", label: "دل", carryLabel: "توی دلت" },
  { id: "shoulders", label: "شانه‌ها", carryLabel: "توی شانه‌هایت" },
  { id: "jaw", label: "فک", carryLabel: "توی فکت" },
  { id: "head", label: "سر", carryLabel: "توی سرت" },
  { id: "all_over", label: "همه‌جا", carryLabel: "همه‌جای بدنت" },
  // An answer, not an apology — same stance as the English. «جایش مشخص نیست»
  // reports something true about the state; a «نمی‌دانم» would make it a
  // question the person failed to answer.
  {
    id: "hard_to_place",
    label: "جایش مشخص نیست",
    carryLabel: "جایی که نمی‌شود دقیق نشانش داد",
  },
];

/**
 * Body textures. Sensations, not feelings — see the warning in the file header.
 *
 * Three of these are the ones to look at hardest:
 *
 * - `tight` → «تنگ» rather than «گرفته». «سینه‌ام گرفته» is the more idiomatic
 *   Persian for a tight chest, and it is also how you say you feel low. Using
 *   it would put a feeling in the texture palette.
 * - `sinking` → «فروریخته». Persian has the *event* («دلم ریخت») far more
 *   readily than the state; this is the state form and it may read stiffly.
 * - `fluttery` → «تپنده». Reaches for the throb rather than the flutter, since
 *   the literal «بال‌بال‌زن» is about longing, i.e. a feeling again.
 */
const TEXTURES_FA: PaletteEntrySurface[] = [
  { id: "tight", label: "تنگ" },
  { id: "heavy", label: "سنگین" },
  { id: "jittery", label: "لرزان" },
  { id: "warm", label: "گرم" },
  { id: "buzzy", label: "گزگز" },
  { id: "hollow", label: "خالی" },
  { id: "light", label: "سبک" },
  { id: "tense", label: "سفت" },
  { id: "knotted", label: "گره‌خورده" },
  { id: "sinking", label: "فروریخته" },
  { id: "cold", label: "سرد" },
  { id: "fluttery", label: "تپنده" },
];

/**
 * Feeling words. The `early` (pleasant / met-need) tier leads; `broaden` enters
 * once the loop is established. The tier weighting lives in the spec — this file
 * only supplies the words, in spec order.
 *
 * Kept plain on purpose. Where Persian has both an accepted term and a
 * colloquial one, the colloquial one wins: «قدردان» over «سپاسگزار», «کلافه»
 * over «برآشفته», «بی‌رمق» over «بی‌انگیزه». A palette in the register of a
 * pamphlet is a palette people read instead of use.
 */
const FEELINGS_FA: PaletteEntrySurface[] = [
  { id: "at_ease", label: "آسوده" },
  { id: "glad", label: "خوشحال" },
  { id: "calm", label: "آرام" },
  { id: "content", label: "راضی" },
  { id: "grateful", label: "قدردان" },
  { id: "hopeful", label: "امیدوار" },
  { id: "relieved", label: "خیال‌راحت" },
  { id: "curious", label: "کنجکاو" },

  { id: "uneasy", label: "ناآرام" },
  { id: "restless", label: "بی‌قرار" },
  { id: "disappointed", label: "سرخورده" },
  { id: "drained", label: "بی‌رمق" },
  { id: "lonely", label: "تنها" },
  { id: "hurt", label: "رنجیده" },
  { id: "sad", label: "غمگین" },
  // Irritation, not rage. «عصبانی» would be the squarer word for anger, and a
  // native pass may prefer it if the palette turns out not to name anger
  // plainly enough — but «کلافه» is what the mild end actually feels like, and
  // the mild end is where most sittings live.
  { id: "irritated", label: "کلافه" },
  { id: "anxious", label: "نگران" },
  { id: "overwhelmed", label: "آشفته" },
  { id: "ashamed", label: "شرمنده" },
  { id: "tender", label: "دل‌نرم" },
];

/**
 * Needs. Offered, never forced; not tier-weighted.
 *
 * `connection` is «نزدیکی», not «ارتباط» — the latter is what you have with a
 * server. `autonomy` is «اختیار», which carries choice rather than the
 * political «خودمختاری». `understanding` and `to_be_seen` are both stated as
 * things that happen *to* you («فهمیده شدن», «دیده شدن»), which is what makes
 * them needs rather than capacities.
 */
const NEEDS_FA: PaletteEntrySurface[] = [
  { id: "rest", label: "استراحت" },
  { id: "connection", label: "نزدیکی" },
  { id: "to_matter", label: "مهم بودن" },
  { id: "safety", label: "امنیت" },
  { id: "space", label: "فضا" },
  { id: "ease", label: "آسودگی" },
  { id: "to_be_seen", label: "دیده شدن" },
  { id: "autonomy", label: "اختیار" },
  { id: "trust", label: "اعتماد" },
  { id: "understanding", label: "فهمیده شدن" },
  { id: "respect", label: "احترام" },
  { id: "support", label: "حمایت" },
];

// ─── Day-1 frame (P1) — felt, not told ───────────────────────────────────────

const FRAME_FA: FrameSurface = {
  intro: {
    title: "پیش از تمرین روزانه — یک چیز برای امتحان",
    // Says what will happen, not what it will prove. Same refusal as the
    // English: the claim that feelings are workable is the one claim this
    // screen must not make.
    body: "دو دقیقه بیشتر نمی‌برد. یک لحظه از همین چند روز را برمی‌گردانی، می‌بینی کجای بدنت نشسته، و یک کلمه رویش امتحان می‌کنی. همین. چیزی نیست که لازم باشد درست انجامش بدهی.",
    begin: "شروع",
  },
  recall: {
    prompt: "یک لحظه از این یکی‌دو روز را به یاد بیاور که حالت کمی گرفته بود.",
    // Steering small is the mechanism, not gentleness: the first attempt has to
    // land a word, and the heaviest thing available is the least likely to.
    helper:
      "یک چیز معمولی — یک گیر کوچک، نه سنگین‌ترین چیزی که داری. یک لحظه وقت بگذار تا برگردد.",
    ready: "یادم آمد",
  },
  place: {
    prompt: "کجای بدنت نشسته؟",
    helper: "هر کدام نزدیک‌تر است را بردار — و اگر جایش مشخص نمی‌شود، آن هم یک جواب است.",
    locationIds: ["chest", "throat", "stomach", "shoulders", "jaw", "hard_to_place"],
  },
  texture: {
    prompt: "و آنجا چه حالی دارد؟",
    helper: "نه معنی‌اش — فقط اینکه از داخل چه حسی دارد.",
    textureIds: ["heavy", "tight", "hollow", "knotted", "light", "warm"],
  },
  name: {
    prompt: "حالا یک کلمه رویش امتحان کن.",
    helper: "نه کلمهٔ دقیقِ دقیق — هر کدام را بگیر جلوی آنچه دیدی و ببین کدام بیشتر جا می‌افتد.",
    feelingIds: ["uneasy", "drained", "disappointed", "restless", "irritated", "sad"],
  },
  payoff: {
    // Reports; does not conclude. The realization stays the reader's.
    line: "هیچ‌چیز از خودِ ماجرا عوض نشد.",
    body: "همان لحظهٔ دو دقیقه پیش است. ولی حالا یک شکل دارد و یک کلمه — و همین معمولاً کافی است که بتوانی کاری با آن بکنی.",
    close: "کل حرکت همین بود. حلقهٔ روزانه همین است، کوتاه‌تر.",
  },
};

// ─── The daily loop (P2 → P3 → P4) ───────────────────────────────────────────

/**
 * «نوبت» is the word for a sitting, and «حلقه» for the loop — matching the UI
 * strings the client already ships (`locales/fa/common.json`). One Persian word
 * per concept (rule 7c): the reason that rule exists is that the app once had
 * three words for "action".
 */
const LOOP_FA: LoopCopySurface = {
  // A threshold, not a timer. No duration promised, no completion recorded.
  breathePrompt: "یک نفس آرام.",
  breatheHint: "تو… و بیرون",
  breatheSkip: "رد کن",

  placePrompt: "کجا نشسته؟",
  placeHelper: "اول بدن. کلمه بعد می‌آید.",

  // Bare: the location carries its own preposition and possessive. See LOCATIONS_FA.
  textureCarry: "{{place}} —",
  texturePrompt: "چه حالی دارد؟",
  textureHelper: "فقط حسِ خودش، نه اینکه دربارهٔ چیست.",

  nameCarry: "آن حسِ {{texture}} —",
  namePrompt: "یک کلمه بردار و رویش امتحان کن.",
  // No arrow. An arrow means "forward" by pointing right, and in an RTL column
  // forward is the other way — a glyph that has to be flipped is a glyph that
  // will one day not be.
  nameOther: "چیز دیگری — بنویسش",
  nameOwnPlaceholder: "کلمهٔ خودت برایش…",

  needCarry: "این {{feeling}} —",
  // «اگر» is doing the same load-bearing work as the English "if". A need
  // recited instead of recognized is worse than no need at all, so the sentence
  // has to stay a real conditional and not become a request.
  needPrompt: "اگر به چیزی اشاره دارد که برایت مهم است، به چه؟",
  needSkip: "مطمئن نیستم — رد کن",

  // The withdrawn forms (P7): the beat kept, the coaching dropped. The need's
  // terse form keeps its «اگر», because the conditional is the guardrail rather
  // than part of the scaffolding.
  placePromptTerse: "کجا؟",
  texturePromptTerse: "چه حالی؟",
  namePromptTerse: "یک کلمه برایش؟",
  needPromptTerse: "اگر به جایی اشاره دارد — به کجا؟",

  smallStepPrompt: "کار کوچکی هست که بخواهی بکنی یا از کسی بخواهی؟",
  smallStepPlaceholder: "یک چیز کوچک…",
  smallStepSkip: "رد کن",

  done: "تمام. حلقه همین بود.",

  addAnotherAsk: "بیشتر از یک چیز حس می‌کنی؟",
  addAnother: "یکی دیگر",
  // Closes warmly; never says «حداکثر» or «محدودیت». The bound exists to stop
  // an emotional inventory forming, and announcing it as a rule would invite
  // exactly the completionism it prevents.
  addAnotherCapped: "برای یک نوبت همین کافی است.",
  finish: "تمامش کن",

  recapHeading: "این نوبت",
  recapLead: "کنار هم —",
  // The explicit refusal to relate them: relating is storytelling (P6, tier 4)
  // and letting it in here would smuggle a deferred tier into the demo.
  recapNotRelated: "اینکه چطور به هم وصل می‌شوند، بعدها.",

  repeatLead: "لازم نیست دوباره آرام بگیری — مستقیم برو.",
  repeatPrompt: "و آن یکی — کجا نشسته؟",
};

// ─── Distinction catch (P5) ──────────────────────────────────────────────────

/**
 * The catch line, per family.
 *
 * «برداشت» — an impression, a reading someone took — is the pivot of all five,
 * and it is chosen over the more literal «خوانش», which is the register of a
 * literature seminar. The line has to sound like a person noticing something,
 * because a line that sounds like an assessment produces a defence, and a
 * person defending is not looking (P5).
 *
 * None of them says the person is wrong. Each names what the word is doing, and
 * then opens downward.
 */
const LEXICON_CATEGORIES_FA: LexiconCategorySurface[] = [
  {
    id: "excluded",
    catchTemplate: "«{{word}}» برداشتی است از کاری که کسی کرد — یا نکرد. زیرش —",
  },
  {
    id: "diminished",
    catchTemplate: "«{{word}}» برداشتی است از رفتاری که کسی با تو کرد. زیرش —",
  },
  {
    id: "betrayed",
    catchTemplate: "«{{word}}» دربارهٔ کاری است که کسی کرد. زیرش —",
  },
  {
    id: "pressured",
    catchTemplate: "«{{word}}» وضعیتی را می‌گوید که در آن گیر کردی. زیرش —",
  },
  {
    id: "threatened",
    catchTemplate: "«{{word}}» برداشتی است از کاری که کسی با تو کرد. زیرش —",
  },
];

const CATCH_FA: CatchCopySurface = {
  genericTemplate: "«{{word}}» بیشتر برداشتی است از کاری که کسی کرد تا یک احساس. زیرش —",
  feelingHintsLabel: "احساس",
  needHintsLabel: "نیاز",
  // Load-bearing. A catch you cannot wave off is a quiz.
  dismiss: "ولش کن — همان کلمه درست است",
  note: "کلمه‌ها مالِ خودت است، انتخاب هم مالِ خودت.",
};

/**
 * The detection list — the same 39 spec concepts, realized in Persian.
 *
 * **This is the part of the pack that does not translate.** The NVC
 * faux-feelings list is a claim about English *adjectives*: "ignored",
 * "dismissed", "let down" all look like feeling words and are not. Persian
 * mostly does not have those adjectives. It says the same things as passive
 * verb phrases — «نادیده گرفته شدم», «جدی گرفته نشدم», «قالم گذاشت» — so the
 * phenomenon is identical and the surface form is not. Three consequences:
 *
 * - **`word` is a gerund phrase, not an adjective**, because that is the form
 *   that reads naturally quoted back inside the catch line.
 * - **Triggers must enumerate their conjugations.** Persian personal endings
 *   attach directly to the stem (شدم / شده‌ام / می‌شوم), and the matcher requires
 *   a boundary on both sides, so «دیده نشد» does *not* match «دیده نشدم». A
 *   stem-matching matcher would be the alternative and it is the wrong trade:
 *   see the note below.
 * - **First person is favoured**, since a person naming their own state writes
 *   «...شدم», not the infinitive.
 *
 * The list is tuned to **under**-trigger. A catch that does not fire is a loop
 * that stays quiet; a catch that fires on the wrong word is the app telling
 * someone their feeling is a mistake, at the exact moment they took a risk to
 * name it. Those are not symmetric errors, and this file resolves every
 * uncertainty toward silence.
 *
 * Where two concepts nest — «مجبورم» (obligated) inside «مجبورم کردند»
 * (coerced) — longest-match-wins is doing real semantic work rather than just
 * breaking a tie: being made to is a different thing from feeling you have to.
 */
const LEXICON_FA: LexiconConceptSurface[] = [
  // ── excluded ──────────────────────────────────────────────────────────────
  {
    id: "ignored",
    word: "نادیده گرفته شدن",
    triggers: ["نادیده گرفته", "نادیده گرفتن", "نادیده", "به حسابم نیاوردند"],
    feelingHints: ["رنجیده؟", "تنها؟"],
    needHints: ["مهم بودن؟", "به حساب آمدن؟"],
  },
  {
    id: "left_out",
    word: "کنار گذاشته شدن",
    triggers: ["کنار گذاشته", "کنارم گذاشتند", "جا گذاشته", "دور نگه داشتند"],
    feelingHints: ["تنها؟", "غمگین؟"],
    needHints: ["تعلق؟", "بودن در جمع؟"],
  },
  {
    id: "invisible",
    word: "دیده نشدن",
    triggers: ["دیده نشدم", "دیده نشده‌ام", "دیده نمی‌شوم", "دیده نشدن", "نامرئی"],
    feelingHints: ["تنها؟", "رنجیده؟"],
    needHints: ["دیده شدن؟", "مهم بودن؟"],
  },
  {
    id: "unheard",
    word: "شنیده نشدن",
    triggers: [
      "شنیده نشدم",
      "شنیده نشده‌ام",
      "شنیده نمی‌شوم",
      "شنیده نشدن",
      "حرفم را نشنیدند",
      "به حرفم گوش نکردند",
    ],
    feelingHints: ["کلافه؟", "تنها؟"],
    needHints: ["شنیده شدن؟", "مهم بودن؟"],
  },
  {
    id: "abandoned",
    word: "تنها گذاشته شدن",
    triggers: ["تنها گذاشته", "تنهایم گذاشت", "رها کردند", "ترکم کرد", "ترک شدم"],
    feelingHints: ["ترسیده؟", "تنها؟"],
    needHints: ["امنیت؟", "نزدیکی؟"],
  },
  {
    id: "neglected",
    word: "بی‌توجهی دیدن",
    triggers: ["بی‌توجهی", "بی‌محلی", "به من نرسیدند"],
    feelingHints: ["تنها؟", "غمگین؟"],
    needHints: ["توجه؟", "نزدیکی؟"],
  },
  {
    id: "rejected",
    word: "پس زده شدن",
    triggers: ["پس زده", "پسم زدند", "طرد", "قبولم نکردند"],
    feelingHints: ["رنجیده؟", "غمگین؟"],
    needHints: ["پذیرفته شدن؟", "تعلق؟"],
  },
  {
    id: "isolated",
    word: "منزوی شدن",
    triggers: ["منزوی", "دورافتاده", "بریده از همه"],
    feelingHints: ["تنها؟", "بی‌قرار؟"],
    needHints: ["نزدیکی؟", "همراهی؟"],
  },
  {
    id: "misunderstood",
    word: "بد فهمیده شدن",
    triggers: ["بد فهمیده", "اشتباه فهمیده", "درست نفهمیدند", "کسی نفهمید"],
    feelingHints: ["کلافه؟", "تنها؟"],
    needHints: ["فهمیده شدن؟", "نزدیکی؟"],
  },
  {
    id: "unsupported",
    word: "بی‌پشتیبان ماندن",
    triggers: ["بی‌پشتیبان", "پشتم نبود", "کسی کمکم نکرد", "هوایم را نداشت"],
    feelingHints: ["بی‌رمق؟", "آشفته؟"],
    needHints: ["حمایت؟", "همراهی؟"],
  },

  // ── diminished ────────────────────────────────────────────────────────────
  {
    id: "dismissed",
    word: "جدی گرفته نشدن",
    triggers: ["جدی گرفته نشدم", "جدی نگرفت", "جدی نگرفتند", "جدی گرفته نشدن", "سرسری گرفتند"],
    feelingHints: ["رنجیده؟", "کلافه؟"],
    needHints: ["شنیده شدن؟", "مهم بودن؟"],
  },
  {
    id: "belittled",
    word: "کوچک شدن",
    triggers: ["کوچک شدم", "کوچکم کرد", "کوچکم کردند", "خوارم کرد"],
    feelingHints: ["رنجیده؟", "عصبانی؟"],
    needHints: ["احترام؟", "کرامت؟"],
  },
  {
    id: "patronized",
    word: "از بالا نگاه شدن",
    triggers: ["از بالا نگاه", "از بالا حرف", "مثل بچه", "بچه حساب"],
    feelingHints: ["کلافه؟", "رنجیده؟"],
    needHints: ["احترام؟", "جدی گرفته شدن؟"],
  },
  {
    id: "criticized",
    word: "نقد شدن",
    triggers: ["انتقاد", "ایراد گرفت", "ایراد گرفتند", "زیر ذره‌بین"],
    feelingHints: ["رنجیده؟", "شرمنده؟"],
    needHints: ["پذیرفته شدن؟", "فهمیده شدن؟"],
  },
  {
    id: "judged",
    word: "قضاوت شدن",
    triggers: ["قضاوت", "قضاوتم کردند"],
    feelingHints: ["شرمنده؟", "معذب؟"],
    needHints: ["پذیرفته شدن؟", "فهمیده شدن؟"],
  },
  {
    id: "put_down",
    // «سرکوفت» was here and has moved to `fa_favour_held_over`, where it
    // belongs: a سرکوفت is specifically a past kindness or fault thrown back at
    // you, which is the منت move, not the تحقیر one.
    word: "تحقیر شدن",
    triggers: ["تحقیر", "خوار", "له شدم"],
    feelingHints: ["رنجیده؟", "عصبانی؟"],
    needHints: ["احترام؟", "کرامت؟"],
  },
  {
    id: "insulted",
    word: "توهین شدن",
    triggers: ["توهین", "فحش"],
    feelingHints: ["عصبانی؟", "رنجیده؟"],
    needHints: ["احترام؟", "کرامت؟"],
  },
  {
    id: "invalidated",
    word: "باور نشدن",
    triggers: ["باورم نکردند", "باور نکرد", "انگار دیوانه‌ام", "حسم را انکار کردند"],
    feelingHints: ["کلافه؟", "رنجیده؟"],
    needHints: ["باور شدن؟", "فهمیده شدن؟"],
  },
  {
    id: "unappreciated",
    word: "قدر ندیدن",
    triggers: ["قدر ندیدم", "قدرم را ندانستند", "قدرناشناسی", "زحمتم دیده نشد"],
    feelingHints: ["بی‌رمق؟", "دلخور؟"],
    needHints: ["دیده شدن؟", "قدردانی؟"],
  },
  {
    id: "taken_for_granted",
    // Persian has no single phrase for this; what it has is the *stance* —
    // treating what you did as simply owed. All four triggers name that stance
    // rather than a state, which is the honest realization of the concept.
    word: "وظیفه دیده شدن",
    triggers: ["مثل وظیفه", "طبیعی می‌دانند", "توقع دارند", "حق مسلم"],
    feelingHints: ["بی‌رمق؟", "دلخور؟"],
    needHints: ["قدردانی؟", "مهم بودن؟"],
  },
  {
    id: "disrespected",
    word: "بی‌احترامی دیدن",
    triggers: ["بی‌احترامی", "بی‌ادبی", "احترام نگذاشتند"],
    feelingHints: ["عصبانی؟", "رنجیده؟"],
    needHints: ["احترام؟", "جدی گرفته شدن؟"],
  },

  // ── betrayed ──────────────────────────────────────────────────────────────
  {
    id: "let_down",
    // «نامردی کرد» moved to `fa_no_loyalty`: a broken promise is what this
    // concept is about, and نامردی is a verdict on someone's character.
    word: "قال گذاشته شدن",
    triggers: ["قال گذاشت", "قالم گذاشت", "زیر قولش زد"],
    feelingHints: ["سرخورده؟", "رنجیده؟"],
    needHints: ["اعتماد؟", "تکیه به کسی؟"],
  },
  {
    id: "betrayed",
    word: "خیانت دیدن",
    triggers: ["خیانت", "از پشت خنجر"],
    feelingHints: ["رنجیده؟", "عصبانی؟"],
    needHints: ["اعتماد؟", "وفا؟"],
  },
  {
    id: "cheated",
    word: "کلاه سر کسی رفتن",
    triggers: ["کلاه سرم", "سرم کلاه", "حقم خورده شد"],
    feelingHints: ["عصبانی؟", "رنجیده؟"],
    needHints: ["اعتماد؟", "انصاف؟"],
  },
  {
    id: "lied_to",
    word: "دروغ شنیدن",
    triggers: ["دروغ گفت", "دروغ گفتند", "بهم دروغ", "گول زد", "فریب"],
    feelingHints: ["عصبانی؟", "رنجیده؟"],
    needHints: ["راستی؟", "اعتماد؟"],
  },
  {
    id: "distrusted",
    word: "اعتماد نشدن",
    triggers: ["بهم اعتماد نکرد", "اعتماد نکردند", "شک کردند", "باورم نداشت"],
    feelingHints: ["رنجیده؟", "کلافه؟"],
    needHints: ["اعتماد شدن؟", "احترام؟"],
  },
  {
    id: "used",
    word: "استفاده شدن",
    triggers: ["ازم استفاده کرد", "استفاده ابزاری", "وسیله شدم", "سوءاستفاده"],
    feelingHints: ["عصبانی؟", "رنجیده؟"],
    needHints: ["دوطرفه بودن؟", "احترام؟"],
  },
  {
    id: "manipulated",
    word: "بازی داده شدن",
    triggers: ["بازی داد", "بازیم داد", "دستکاری"],
    feelingHints: ["عصبانی؟", "ناآرام؟"],
    needHints: ["راستی؟", "اختیار؟"],
  },

  // ── pressured ─────────────────────────────────────────────────────────────
  {
    id: "pressured",
    word: "زیر فشار بودن",
    triggers: ["زیر فشار", "فشار آوردند", "هلم دادند"],
    feelingHints: ["نگران؟", "کلافه؟"],
    needHints: ["فضا؟", "انتخاب؟"],
  },
  {
    id: "coerced",
    word: "مجبور شدن",
    triggers: ["مجبورم کردند", "مجبورم کرد", "مجبور شدم", "به زور"],
    feelingHints: ["عصبانی؟", "ترسیده؟"],
    needHints: ["اختیار؟", "انتخاب؟"],
  },
  {
    id: "cornered",
    word: "گیر افتادن",
    triggers: ["گیر افتادم", "گیر کردم", "به بن‌بست", "راه فرار نداشتم"],
    feelingHints: ["نگران؟", "عصبانی؟"],
    needHints: ["فضا؟", "آزادی؟"],
  },
  {
    id: "obligated",
    // Nests inside `coerced` on purpose — see the note above the list.
    word: "تکلیف داشتن",
    triggers: ["مجبورم", "وظیفه‌ام بود", "رودربایستی", "احساس دین"],
    feelingHints: ["دلخور؟", "بی‌رمق؟"],
    needHints: ["انتخاب؟", "اختیار؟"],
  },
  {
    id: "overworked",
    word: "بیش از توان کار کردن",
    triggers: ["بیش از توانم", "از پا افتادم", "جان کندم", "کار زیاد"],
    feelingHints: ["بی‌رمق؟", "دلخور؟"],
    needHints: ["استراحت؟", "تعادل؟"],
  },

  // ── threatened ────────────────────────────────────────────────────────────
  {
    id: "attacked",
    word: "حمله دیدن",
    triggers: ["حمله کرد", "بهم پرید", "ریختند سرم"],
    feelingHints: ["ترسیده؟", "عصبانی؟"],
    needHints: ["امنیت؟", "احترام؟"],
  },
  {
    id: "threatened",
    word: "تهدید شدن",
    triggers: ["تهدید"],
    feelingHints: ["ترسیده؟", "نگران؟"],
    needHints: ["امنیت؟", "آرامش؟"],
  },
  {
    id: "intimidated",
    word: "ترسانده شدن",
    triggers: ["ترساندند", "زورش را نشان داد", "جلویش کم آوردم"],
    feelingHints: ["ترسیده؟", "نگران؟"],
    needHints: ["امنیت؟", "اعتماد به خود؟"],
  },
  {
    id: "bullied",
    word: "قلدری دیدن",
    triggers: ["قلدری", "زورگویی", "اذیتم کردند"],
    feelingHints: ["ترسیده؟", "عصبانی؟"],
    needHints: ["امنیت؟", "احترام؟"],
  },
  {
    id: "harassed",
    word: "آزار دیدن",
    triggers: ["آزار", "دست از سرم برنداشتند", "ولم نکردند"],
    feelingHints: ["عصبانی؟", "ترسیده؟"],
    needHints: ["امنیت؟", "آرامش؟"],
  },
  {
    id: "blamed",
    word: "متهم شدن",
    triggers: ["تقصیر را انداختند", "تقصیر من", "گردن من انداختند", "متهمم کردند"],
    feelingHints: ["شرمنده؟", "عصبانی؟"],
    needHints: ["انصاف؟", "فهمیده شدن؟"],
  },

  // ── Persian-only ──────────────────────────────────────────────────────────
  //
  // Six judgments Persian makes that English has no single word for, so they are
  // scoped to `fa` in the spec rather than paired with invented English. See the
  // note above `LEXICON_SPECS`' Persian block for the research behind them —
  // briefly: the Persian NVC centre publishes a feelings list and no
  // faux-feelings list, so there was nothing to translate.
  //
  // The admission test for each is the same one the English list passes: is this
  // a *reading of what someone did*, wearing a feeling's clothes? Persian has
  // plenty of genuine feeling words that look similar and are not admitted —
  // «دلتنگ» (missing someone) and «دلگیر» (quietly hurt) are felt states, and
  // they belong in the palette.
  {
    id: "fa_no_loyalty",
    // معرفت is a virtue: knowing what a relationship asks of you. Its absence is
    // a moral verdict on the other person, which is why «بی‌معرفت» lands as an
    // accusation and not as a report of how you feel.
    word: "بی‌معرفتی دیدن",
    triggers: ["بی‌معرفتی", "بی‌معرفت", "نامرد", "نامردی کرد", "مرام نداشت", "رفاقت نکرد"],
    feelingHints: ["رنجیده؟", "سرخورده؟"],
    needHints: ["وفا؟", "تکیه به کسی؟"],
  },
  {
    id: "fa_not_received",
    // تحویل گرفتن is something you actively *do* — you make a fuss of someone
    // arriving. Its absence is not general inattention, which is why this is not
    // `ignored`: the ritual was available and was withheld.
    word: "تحویل گرفته نشدن",
    triggers: ["تحویل نگرفت", "تحویل نگرفتند", "تحویلم نگرفت", "محلم نکرد", "پاسم نداد"],
    feelingHints: ["رنجیده؟", "تنها؟"],
    needHints: ["دیده شدن؟", "مهم بودن؟"],
  },
  {
    id: "fa_treated_as_stranger",
    // «غریبی کردن» — Dehkhoda: بیگانگی کردن, عدم آشنایی نمودن. The sting is that
    // it comes from someone close, so it is coldness rather than distance, and a
    // different thing from `isolated`.
    word: "غریبی دیدن",
    triggers: ["غریبی کرد", "غریبی می‌کند", "مثل غریبه", "سرد شد"],
    feelingHints: ["تنها؟", "غمگین؟"],
    needHints: ["نزدیکی؟", "خودی بودن؟"],
  },
  {
    id: "fa_not_counted",
    // Standing, not a single brushed-off remark — that is `dismissed`. This says
    // you were not counted as a person at all.
    word: "آدم حساب نشدن",
    triggers: ["آدم حساب نکرد", "آدم حساب نکردند", "آدم حسابم نکرد", "به حساب نیاوردند"],
    feelingHints: ["رنجیده؟", "کلافه؟"],
    needHints: ["احترام؟", "مهم بودن؟"],
  },
  {
    id: "fa_face_lost",
    // آبرو is the Iranian face concept — kept or spilled by whether you are seen
    // to hold to the moral order (Mashhad ethnographic study of آبرو). What makes
    // this its own concept rather than `put_down` is that it is *public*: تحقیر is
    // what someone did to you, ضایع شدن is the state of having been exposed.
    word: "ضایع شدن",
    triggers: ["ضایعم کرد", "ضایع شدم", "آبرویم رفت", "آبرویم را برد", "جلوی همه"],
    feelingHints: ["شرمنده؟", "عصبانی؟"],
    needHints: ["کرامت؟", "احترام؟"],
  },
  {
    id: "fa_favour_held_over",
    // منت گذاشتن — Moein: احسان و نیکویی در حق کسی را به یادش آوردن و به رخش
    // کشیدن. The root is مَن, a unit of weight: the kindness is put back on the
    // scale and weighed at you. A gift with a debt attached is a squeeze, which
    // is why the family is `pressured` and the need underneath is freedom.
    word: "منت شنیدن",
    triggers: ["منت گذاشت", "منت گذاشتند", "منتش را", "به رخم کشید", "سرکوفت"],
    feelingHints: ["دلخور؟", "شرمنده؟"],
    needHints: ["اختیار؟", "بخشندگی بی‌منت؟"],
  },
];

// ─── Self-initiation (P7) ────────────────────────────────────────────────────

const GRADUATION_FA: GraduationSurface = {
  // Capability, stated once. No number anywhere in this copy, and nothing here
  // that could be lost — a door you have walked through stays walked through.
  line: "این چند وقت خودت داری انجامش می‌دهی.",
  body: "نکته‌اش همین بود. حالا مالِ خودت است — برنامه فقط داربست بود.",
  close: "هر وقت خواستی، ادامه بده.",
};

// ─── Assembly ────────────────────────────────────────────────────────────────

export const SURFACE_FA: FeelingsNeedsSurface = {
  // Machine-drafted, not natively reviewed. See the file header for what that
  // costs and what a review pass is specifically for.
  reviewStatus: "draft",
  locations: LOCATIONS_FA,
  textures: TEXTURES_FA,
  feelings: FEELINGS_FA,
  needs: NEEDS_FA,
  frame: FRAME_FA,
  loop: LOOP_FA,
  catch: CATCH_FA,
  graduation: GRADUATION_FA,
  lexiconCategories: LEXICON_CATEGORIES_FA,
  lexicon: LEXICON_FA,
};
