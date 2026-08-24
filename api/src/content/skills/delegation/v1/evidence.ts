/**
 * Delegation Lab — criterion evidence lines, per locale.
 *
 * The "why this level" lines shown next to G1–G6. Pass 3 of the persona
 * review found them hardcoded in English. Register: second person, informal
 * تو/کن, Western digits — same as this directory's surfaces.
 */

import { makeEvidence, type EvidenceTable } from "../../../../services/skills/evidenceText";

export type DelegationEvidenceKey =
  | "notThisModule"
  | "g2.correct"
  | "g2.wrong"
  | "g3.void"
  | "g3.undefined"
  | "g3.woa"
  | "g4.correct"
  | "g4.wholeTask"
  | "g4.inverted"
  | "g5.pending"
  | "g5.good"
  | "g5.none"
  | "g5.partial"
  | "g6.tooCloseToZero"
  | "g6.dropRatio";

const TABLE: EvidenceTable<DelegationEvidenceKey> = {
  en: {
    notThisModule: "Not this item's module.",

    "g2.correct":
      "The cue you picked bears on relative competence, or correctly reported none exists.",
    "g2.wrong": "The cue you picked was a category claim, or missed an instance cue that existed.",

    "g3.void": "Your estimate fell outside the plausible range — void, not scored.",
    "g3.undefined":
      "The advice equalled your initial estimate — weight of advice is undefined for this item.",
    "g3.woa": "You moved {woa} of the distance to the advice; the benchmark for this item is {benchmark}.",

    "g4.correct":
      "You handed over the piece the key marks delegable and kept the piece only you could judge.",
    "g4.wholeTask": "You delegated or kept the whole task where the key marks it separable.",
    "g4.inverted": "You split the task, but inverted which piece to hand over.",

    "g5.pending": "Waiting on the other half of this pair.",
    "g5.good": "Reliance was either reduced under high stakes, or kept and made recoverable.",
    "g5.none":
      "Reliance was unchanged under high stakes, with no recoverability move recorded.",
    "g5.partial":
      "Some change, but below the pair's threshold, and no recoverability move recorded.",

    "g6.tooCloseToZero":
      "Round 1's weighting was too close to zero for a drop ratio to mean anything.",
    "g6.dropRatio": "Drop ratio {ratio} (round 3 weighting ÷ round 1 weighting).",
  },

  fa: {
    notThisModule: "این آیتم مال این ماژول نیست.",

    "g2.correct":
      "نشانه‌ای که انتخاب کردی به توانایی نسبی مربوطه، یا درست گفتی که همچین نشانه‌ای وجود نداره.",
    "g2.wrong":
      "نشانه‌ای که انتخاب کردی یه ادعای کلی بود، یا نشانه‌ی موردیِ موجود رو ندیدی.",

    "g3.void": "تخمین اولت بیرون از بازه‌ی محتمل بود — باطل، نه غلط؛ نمره داده نشد.",
    "g3.undefined":
      "توصیه دقیقاً همون تخمین اولت بود — وزن توصیه برای این آیتم تعریف‌نشده‌ست.",
    "g3.woa": "به اندازه‌ی {woa} از فاصله‌ت تا توصیه حرکت کردی؛ معیار این آیتم {benchmark} بود.",

    "g4.correct":
      "همون تکه‌ای که کلید واگذارشدنی می‌دونه رو واگذار کردی و تکه‌ای که فقط خودت می‌تونستی قضاوت کنی رو نگه داشتی.",
    "g4.wholeTask": "جایی که کلید کار رو قابل‌تفکیک می‌دونه، کل کار رو یا واگذار کردی یا نگه داشتی.",
    "g4.inverted": "کار رو تقسیم کردی، ولی برعکس: تکه‌ی اشتباهی رو واگذار کردی.",

    "g5.pending": "منتظر نیمه‌ی دیگه‌ی این جفت.",
    "g5.good": "زیر ریسک بالا یا تکیه‌ت رو کم کردی، یا نگهش داشتی و قابل‌جبرانش کردی.",
    "g5.none": "زیر ریسک بالا تکیه‌ت تغییری نکرد و هیچ حرکتی هم برای قابل‌جبران‌کردنش ثبت نشد.",
    "g5.partial":
      "یه تغییری بود، ولی زیر آستانه‌ی این جفت، و حرکتی برای قابل‌جبران‌کردنش ثبت نشد.",

    "g6.tooCloseToZero":
      "وزن‌دهی دور اول اون‌قدر به صفر نزدیک بود که نسبت افت معنایی نداشته باشه.",
    "g6.dropRatio": "نسبت افت: {ratio} (وزن‌دهی دور 3 ÷ وزن‌دهی دور 1).",
  },
};

export const delegationEvidence = makeEvidence(TABLE);
