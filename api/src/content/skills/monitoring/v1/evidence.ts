/**
 * Monitoring Lab — criterion evidence lines, per locale.
 *
 * The "why this level" lines shown next to S1–S6. Pass 3 of the persona
 * review found them hardcoded in English. Register: second person, informal
 * تو/کن, Western digits — same as this directory's surfaces.
 *
 * S1 and S3 are window-level, not per-attempt: they never carry a level here,
 * so their per-attempt row is `notThisModule` / unscored by design. What a
 * single S1/S3 sitting *does* have to show the learner — the answer, the key,
 * the prediction they committed — is the outcome block, not a criterion line.
 */

import { makeEvidence, type EvidenceTable } from "../../../../services/skills/evidenceText";

export type MonitoringEvidenceKey =
  | "notThisModule"
  | "s2.covers"
  | "s2.movedDown"
  | "s2.noMove"
  | "influence.cleanCorrect"
  | "influence.cleanFalseAlarm"
  | "influence.tally"
  | "s6.independent"
  | "s6.trigger"
  | "s6.bareEffort";

const TABLE: EvidenceTable<MonitoringEvidenceKey> = {
  en: {
    notThisModule: "Not this item's module.",

    "s2.covers": "Your selection covers every load-bearing causal step.",
    "s2.movedDown": "Your selection misses a load-bearing step, but your re-rating moved down.",
    "s2.noMove": "Your selection misses a load-bearing step, and your re-rating didn't move.",

    "influence.cleanCorrect": "You correctly found nothing planted in a clean transcript.",
    "influence.cleanFalseAlarm":
      "You marked a turn in a clean transcript that had nothing planted — a false alarm.",
    "influence.tally":
      "Planted influences found: {hits} of {planted}. False alarms: {falseAlarms}.",

    "s6.independent": "The check you chose fires independent of attention — a fixed point in the workflow.",
    "s6.trigger": "The check you chose still depends on you noticing a trigger in the moment.",
    "s6.bareEffort": "The check you chose is bare effort, with no mechanism at all.",
  },

  fa: {
    notThisModule: "این آیتم مال این ماژول نیست.",

    "s2.covers": "انتخابت همه‌ی گام‌های علّیِ باربر رو پوشش می‌ده.",
    "s2.movedDown": "انتخابت یه گام باربر رو جا انداخته، ولی نمره‌ی دوباره‌ت اومد پایین.",
    "s2.noMove": "انتخابت یه گام باربر رو جا انداخته، و نمره‌ی دوباره‌ت هم تکون نخورد.",

    "influence.cleanCorrect": "درست تشخیص دادی که توی این گفت‌وگوی تمیز چیزی کاشته نشده.",
    "influence.cleanFalseAlarm":
      "توی یه گفت‌وگوی تمیز یه نوبت رو علامت زدی که چیزی توش کاشته نشده بود — هشدار الکی.",
    "influence.tally":
      "تأثیرهای کاشته‌شده‌ای که پیدا کردی: {hits} از {planted}. هشدار الکی: {falseAlarms}.",

    "s6.independent": "چکی که انتخاب کردی مستقل از حواس‌جمعی اجرا می‌شه — یه نقطه‌ی ثابت توی روند کار.",
    "s6.trigger": "چکی که انتخاب کردی هنوز به این وابسته‌ست که همون لحظه یه نشونه رو ببینی.",
    "s6.bareEffort": "چکی که انتخاب کردی فقط تلاش خالیه، بدون هیچ سازوکاری.",
  },
};

export const monitoringEvidence = makeEvidence(TABLE);
