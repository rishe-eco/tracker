/**
 * Reflect `v1`: the Persian surface.
 *
 * A declared draft (`reviewStatus: "draft"`), same convention as
 * `noticing/v1/surface.fa.ts`: structurally complete rather than absent, and
 * not served in this version (`DIALS.practiceLocale` is `en`, PD-7). A native
 * pass is owed before it is.
 *
 * Register follows `04-conventions.md` §7a to §7c: the Persian says what the
 * English means rather than its words, in the informal register (تو/کن),
 * never شما/کنید. Persian letters ی ک throughout in prompts; Western digits.
 * No prompt uses the Persian words for "why" or "deepest" (AC-19).
 *
 * The lexicon is the exception to the single-spelling rule. The matcher folds
 * Arabic-keyboard letters and reads ZWNJ as a space, so those variants are
 * redundant after normalization; they are authored anyway so the list reads
 * as what people actually type. The joined spelling with no ZWNJ (میکنه beside
 * می‌کنه) is NOT covered by the fold, so it is a real addition. Variants of one
 * family may normalize to the same string; no trigger nests across families.
 * The register is spoken Persian, since a story is told the way it was lived.
 */

import type { LexiconFamily, ReflectSurface } from "../types";

const LEXICON_FA: LexiconFamily[] = [
  {
    family: "absolute",
    triggers: [
      "همیشه",
      "هیچ‌وقت",
      "هیچوقت",
      "هرگز",
      "هیچ‌کس",
      "هیچکس",
      "هيچ‌كس", // Arabic-keyboard spelling
      "هر بار",
      "هربار",
      "مدام",
      "همه‌اش",
      "همه‌ش",
      "هیچ‌چیز",
    ],
  },
  {
    family: "mind_reading",
    triggers: [
      "از قصد",
      "عمدا",
      "عمدی",
      "می‌خواست",
      "میخواست",
      "قصد داشت",
      "می‌دونست",
      "میدونست",
      "می‌دانست",
      "خوب می‌دونست",
      "حواسش بود",
      "برایش مهم نبود",
      "براش مهم نبود",
    ],
  },
  {
    family: "label",
    triggers: [
      "خودخواه",
      "بی‌ادب",
      "بیادب",
      "بي‌ادب", // Arabic-keyboard spelling
      "تنبل",
      "کنترل‌گر",
      "كنترل‌گر", // Arabic-keyboard spelling
      "کنترلگر",
      "مغرور",
      "بی‌احترام",
      "بیاحترام",
      "بی‌مسئولیت",
      "بیمسئولیت",
      "سنگدل",
    ],
  },
  {
    family: "verdict",
    triggers: [
      "نادیده‌ام گرفت",
      "نادیده‌م گرفت",
      "منو نادیده گرفت",
      "تحقیرم کرد",
      "جدی‌م نگرفت",
      "جدیم نگرفت",
      "حرفمو قطع کرد",
      "حرفم را قطع کرد",
      "دستم انداخت",
      "منو سرزنش کرد",
      "کوچیکم کرد",
      "پشتم حرف زد",
      "ولم کرد",
    ],
  },
];

export const SURFACE_FA: ReflectSurface = {
  reviewStatus: "draft",

  story: {
    scenePrompt: "کجا بودی و چه کسی آنجا بود؟",
    scenePlaceholder: "آشپزخانه، من و خواهرم",
    storyPrompt:
      "طوری تعریفش کن که انگار از آن سر اتاق نگاه می‌کردی: هر کس چه گفت و چه کرد، یکی پس از دیگری.",
  },

  feelings: {
    prompt: "کجای ماجرا حسی سراغت آمد؟",
    whenLabel: "کِی",
    whenPlaceholder: "وقتی در را بست",
    feelingLabel: "حس",
    needLabel: "نیاز",
    metLabel: "برآورده شد یا نه؟",
    metOptions: { met: "برآورده شد", unmet: "نشد", not_sure: "مطمئن نیستم" },
  },

  reality: {
    prompt:
      "دوباره بخوانش. کدام قسمت‌ها را دوربین ضبط می‌کرد و کدام‌ها برداشت خودت است؟ دیدنِ یک برداشت یعنی غلط بودنش نیست.",
    readingLabel: "یک برداشت در آن",
    cameraLabel: "آنچه دوربین همان‌جا می‌دید",
  },

  close: {
    prompt: "حالا که نگاهش می‌کنی، چه چیزی می‌بینی که موقع شروع ندیده بودی؟",
  },

  interpretation: {
    offerLine: "«{word}» شاید برداشتی از ماجرا باشد. می‌خواهی مثل یک برداشت نگاهش کنی؟",
    useLabel: "همین را بگذار",
    dismissLabel: "این نه",
  },

  lexicon: LEXICON_FA,
};
