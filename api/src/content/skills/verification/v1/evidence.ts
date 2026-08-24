/**
 * Verification Lab — criterion evidence lines, per locale.
 *
 * The "why this level" lines shown next to V1–V6. Pass 3 of the persona
 * review found them hardcoded in English; V3's line is worse than the rest
 * because `VerificationSessionPage` promotes it to the reveal's headline, so
 * an English string was the first thing a Persian learner read after every
 * attempt.
 *
 * Register: second person throughout — these are addressed to the learner,
 * not written about them. Same conventions as this directory's surfaces
 * (§7a–7d: concept not calque, informal تو/کن, Western digits).
 */

import { makeEvidence, type EvidenceTable } from "../../../../services/skills/evidenceText";

export type VerificationEvidenceKey =
  | "v1.none"
  | "v1.noOracleItemCorrect"
  | "v1.noOracleItemWrong"
  | "v1.ok"
  | "v1.noBearing"
  | "v2.noOracleItem"
  | "v2.none"
  | "v2.all"
  | "v2.mixed"
  | "v3.noneRun"
  | "v3.noneCouldFail"
  | "v3.allCouldFail"
  | "v3.someCouldFail"
  | "v4.underCeiling"
  | "v4.noDiscriminating"
  | "v4.ratio"
  | "v5.exact"
  | "v5.wrongElement"
  | "v5.none"
  | "v5.control"
  | "v6.wrongVerdict"
  | "v6.withResidual"
  | "v6.noResidual";

const TABLE: EvidenceTable<VerificationEvidenceKey> = {
  en: {
    "v1.none": "No oracle named before the first check, or the field was left empty.",
    "v1.noOracleItemCorrect":
      "You named an oracle and then closed on “cannot verify” — recognising that nothing here settles it is the oracle move this item asks for.",
    "v1.noOracleItemWrong":
      "You named an oracle, but your verdict didn't recognise this claim as unverifiable.",
    "v1.ok":
      "You named an oracle before running anything, and at least one check you ran bears on the specific claim.",
    "v1.noBearing":
      "You named an oracle, but it didn't lead to a check that bears on the specific claim made.",

    "v2.noOracleItem":
      "Nothing here is independently checkable, and your verdict says so rather than substituting a dependent check.",
    "v2.none":
      "Every check you ran derives from the artifact's own source — self-critique, stated confidence, or a re-ask.",
    "v2.all": "Every check you ran is independent of the artifact's source.",
    "v2.mixed": "You ran at least one independent check, but a non-independent one alongside it.",

    "v3.noneRun": "You committed without running a check.",
    "v3.noneCouldFail":
      "None of your checks could have failed. You reached this verdict without evidence for it.",
    "v3.allCouldFail": "Every check you ran could have failed.",
    "v3.someCouldFail": "At least one of your checks could have failed.",

    "v4.underCeiling": "Not scored on this rung — you're under a cost ceiling.",
    "v4.noDiscriminating": "No discriminating check was available to rate cost against.",
    "v4.ratio": "Cost ratio {ratio}× the cheapest sufficient check.",

    "v5.exact": "You named the specific failing element.",
    "v5.wrongElement": "Your verdict was right, but you named the wrong element as the cause.",
    "v5.none": "The fault was not correctly located.",
    "v5.control": "No fault to locate on a control item.",

    "v6.wrongVerdict": "Your verdict does not match the key.",
    "v6.withResidual": "Verdict matches the key, and you said what remains unchecked.",
    "v6.noResidual": "Verdict matches the key, but you gave no residual-risk statement.",
  },

  fa: {
    "v1.none": "قبل از اولین چک هیچ محکی اسم برده نشد، یا فیلدش خالی موند.",
    "v1.noOracleItemCorrect":
      "یه محک اسم بردی و بعد با «قابل‌تأیید نیست» بستیش — تشخیص اینکه هیچی اینجا قضیه رو حل نمی‌کنه، دقیقاً همون حرکتیه که این آیتم می‌خواد.",
    "v1.noOracleItemWrong":
      "یه محک اسم بردی، ولی حکمت نفهمید که این ادعا اصلاً قابل‌تأیید نیست.",
    "v1.ok":
      "قبل از اینکه چیزی رو اجرا کنی یه محک اسم بردی، و حداقل یکی از چک‌هایی که زدی به همون ادعای مشخص مربوطه.",
    "v1.noBearing":
      "یه محک اسم بردی، ولی به چکی نرسید که به همون ادعای مشخص مربوط باشه.",

    "v2.noOracleItem":
      "اینجا هیچی مستقل قابل‌چک نیست، و حکمت همینو می‌گه به‌جای اینکه یه چک وابسته رو جاش بذاره.",
    "v2.none":
      "هر چکی که زدی از خود همون منبعِ کار درمیاد — نقد خودش، اطمینانی که خودش اعلام کرده، یا دوباره‌پرسیدن از خودش.",
    "v2.all": "هر چکی که زدی مستقل از منبع خود کاره.",
    "v2.mixed": "حداقل یه چک مستقل زدی، ولی کنارش یه چک غیرمستقل هم زدی.",

    "v3.noneRun": "بدون اینکه چکی بزنی، حکم دادی.",
    "v3.noneCouldFail":
      "هیچ‌کدوم از چک‌هات نمی‌تونستن شکست بخورن. یعنی بدون شاهدی برای این حکم، بهش رسیدی.",
    "v3.allCouldFail": "هر چکی که زدی می‌تونست شکست بخوره.",
    "v3.someCouldFail": "حداقل یکی از چک‌هات می‌تونست شکست بخوره.",

    "v4.underCeiling": "توی این پله نمره داده نمی‌شه — زیر سقف هزینه‌ای.",
    "v4.noDiscriminating": "هیچ چکِ تفکیک‌کننده‌ای نبود که هزینه در برابرش سنجیده بشه.",
    "v4.ratio": "نسبت هزینه: {ratio}× ارزون‌ترین چکِ کافی.",

    "v5.exact": "همون عنصری که ایراد داشت رو اسم بردی.",
    "v5.wrongElement": "حکمت درست بود، ولی عنصر اشتباهی رو به‌عنوان علت اسم بردی.",
    "v5.none": "محل ایراد درست پیدا نشد.",
    "v5.control": "توی یه آیتم شاهد ایرادی نیست که پیدا بشه.",

    "v6.wrongVerdict": "حکمت با کلید نمی‌خونه.",
    "v6.withResidual": "حکم با کلید می‌خونه، و گفتی چی هنوز چک‌نشده مونده.",
    "v6.noResidual": "حکم با کلید می‌خونه، ولی نگفتی چه ریسکی هنوز باقیه.",
  },
};

export const verificationEvidence = makeEvidence(TABLE);
