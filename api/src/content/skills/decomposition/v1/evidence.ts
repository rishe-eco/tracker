/**
 * Decomposition Lab — criterion evidence lines, per locale.
 *
 * These are the "why this level" lines the reveal shows next to D1–D6. They
 * are authored content, not code: pass 3 of the persona review found all of
 * them hardcoded in English, so a Persian learner's reveal explained a Persian
 * score in English. Same register rules as the surfaces in this directory
 * (conventions §7a–7d: concept not calque, informal تو/کن, Western digits).
 *
 * Adding a key is a type error until every locale defines it.
 */

import { makeEvidence, type EvidenceTable } from "../../../../services/skills/evidenceText";

export type DecompositionEvidenceKey =
  | "nothingSubmitted"
  | "needsJudge"
  | "noKey"
  | "d1.pieceFirst"
  | "d1.noStatement"
  | "d1.nearCopy"
  | "d1.noDoneWhen"
  | "d1.unbounded"
  | "d1.ok"
  | "d2.tooFewTop"
  | "d2.bfi"
  | "d2.noAuthoringOrder"
  | "d2.controlNotApplicable"
  | "d3.overlapPlacedOne"
  | "d3.overlapPlacedMany"
  | "d3.noOverlapPlaced"
  | "d3.stillOverlapOne"
  | "d3.stillOverlapMany"
  | "d3.noOverlapPresent"
  | "d3.controlNothing"
  | "d4.unboundedLeavesOne"
  | "d4.unboundedLeavesMany"
  | "d4.shatteredOne"
  | "d4.shatteredMany"
  | "d4.allBounded"
  | "d4.monolithPlaced"
  | "d4.monolithAvoided"
  | "d4.controlSplit"
  | "d4.controlWhole"
  | "d4.repairStillSingle"
  | "d4.repairSplitOk"
  | "d4.repairStillMany"
  | "d4.repairMergedPartly"
  | "d4.repairMergedUnbounded"
  | "d4.repairMergedOk"
  | "d4.repairNotThisFault"
  | "d5.mismatchPlaced"
  | "d5.mismatchFix"
  | "d5.match"
  | "d5.controlNone"
  | "d6.missing"
  | "d6.allPresentOne"
  | "d6.allPresentMany"
  | "d6.controlNone";

const TABLE: EvidenceTable<DecompositionEvidenceKey> = {
  en: {
    nothingSubmitted: "Nothing submitted.",
    needsJudge:
      "Free-authored text needs a judge to match against the key; self-diagnose against the revealed key instead.",
    noKey:
      "There is no authored key for real material — this criterion can't be scored outside the modules.",

    "d1.pieceFirst": "A piece was added before the whole was stated.",
    "d1.noStatement": "No statement of the undivided problem.",
    "d1.nearCopy": "The statement closely restates the prompt rather than reframing it.",
    "d1.noDoneWhen": "No done condition was given for the whole.",
    "d1.unbounded":
      "The done condition is present but not bounded — no date, count, or state-change verb.",
    "d1.ok": "Stated first, bounded: “{doneWhen}”.",

    "d2.tooFewTop": "Fewer than two top-level pieces.",
    "d2.bfi": "Breadth-first index {bfi}.",
    "d2.noAuthoringOrder": "Nothing was added during the fix — there is no authoring order to judge.",
    "d2.controlNotApplicable": "Not applicable to a control item.",

    "d3.overlapPlacedOne": "An overlapping pair was placed in full: {pairs}.",
    "d3.overlapPlacedMany": "Overlapping pairs were placed in full: {pairs}.",
    "d3.noOverlapPlaced": "No overlapping pair both placed.",
    "d3.stillOverlapOne": "An overlapping pair is still both present: {pairs}.",
    "d3.stillOverlapMany": "Overlapping pairs are still both present: {pairs}.",
    "d3.noOverlapPresent": "No overlapping pair both present.",
    "d3.controlNothing": "Nothing to overlap.",

    "d4.unboundedLeavesOne": "{count} leaf with no bounded done condition.",
    "d4.unboundedLeavesMany": "{count} leaves with no bounded done condition.",
    "d4.shatteredOne": "{count} piece split that the key marks atomic.",
    "d4.shatteredMany": "{count} pieces split that the key marks atomic.",
    "d4.allBounded": "Every leaf has a bounded done condition.",
    "d4.monolithPlaced": "The monolith option was placed instead of the right-sized pieces.",
    "d4.monolithAvoided": "The monolith option was not placed.",
    "d4.controlSplit": "Split into {count} pieces; this task was already one checkable piece.",
    "d4.controlWhole": "Left whole, as the task already was.",
    "d4.repairStillSingle": "Still a single unsplit piece.",
    "d4.repairSplitOk": "Split into checkable pieces.",
    "d4.repairStillMany": "Still {count} pieces for one atomic action.",
    "d4.repairMergedPartly": "Merged to {count} pieces; one atomic action needs one.",
    "d4.repairMergedUnbounded": "Merged to one piece, but its done condition isn't bounded.",
    "d4.repairMergedOk": "Merged back into one checkable piece.",
    "d4.repairNotThisFault": "Not this item's fault type; boundedness only.",

    "d5.mismatchPlaced":
      "A required blocking relation was missing or inverted, or an independent pair was falsely ordered.",
    "d5.mismatchFix":
      "A blocking relation is still missing or inverted, or an independent pair is falsely ordered.",
    "d5.match": "Dependencies match the key.",
    "d5.controlNone": "No dependency to mark.",

    "d6.missing": "Missing: {missing}.",
    "d6.allPresentOne": "The one required piece is present.",
    "d6.allPresentMany": "All {required} required pieces present.",
    "d6.controlNone": "Nothing required beyond the whole itself.",
  },

  fa: {
    nothingSubmitted: "چیزی ثبت نشد.",
    needsJudge:
      "متن آزاد برای تطبیق با کلید به یه داور نیاز داره؛ به‌جاش خودت با کلیدی که نشون داده می‌شه مقایسه کن.",
    noKey:
      "برای کار واقعی کلید نوشته‌شده‌ای وجود نداره — این معیار بیرون از ماژول‌ها قابل نمره‌دادن نیست.",

    "d1.pieceFirst": "قبل از اینکه کل کار گفته بشه، یه تکه اضافه شده بود.",
    "d1.noStatement": "کل کار، تقسیم‌نشده، اصلاً گفته نشده.",
    "d1.nearCopy": "این جمله تقریباً همون صورت‌مسئله رو تکرار می‌کنه، نه اینکه از نو بیانش کنه.",
    "d1.noDoneWhen": "برای کل کار هیچ شرط تمام‌شدنی گفته نشده.",
    "d1.unbounded":
      "شرط تمام‌شدن هست ولی مرزبندی نشده — نه تاریخی، نه تعدادی، نه فعلی که تغییر وضعیت رو نشون بده.",
    "d1.ok": "اول گفته شد و مرزبندی داره: «{doneWhen}».",

    "d2.tooFewTop": "کمتر از دو تکه‌ی سطح اول.",
    "d2.bfi": "شاخص سطح‌به‌سطح بودن: {bfi}.",
    "d2.noAuthoringOrder": "توی این اصلاح چیزی اضافه نشد — ترتیب ساختی وجود نداره که قضاوت بشه.",
    "d2.controlNotApplicable": "برای یه آیتم شاهد معنا نداره.",

    "d3.overlapPlacedOne": "یه جفت هم‌پوشان، هر دو طرفش گذاشته شده: {pairs}.",
    "d3.overlapPlacedMany": "جفت‌های هم‌پوشان، هر دو طرفشون گذاشته شدن: {pairs}.",
    "d3.noOverlapPlaced": "هیچ جفت هم‌پوشانی نبود که هر دو طرفش گذاشته شده باشه.",
    "d3.stillOverlapOne": "یه جفت هم‌پوشان هنوز هر دو طرفش هست: {pairs}.",
    "d3.stillOverlapMany": "جفت‌های هم‌پوشان هنوز هر دو طرفشون هستن: {pairs}.",
    "d3.noOverlapPresent": "هیچ جفت هم‌پوشانی نمونده که هر دو طرفش باشه.",
    "d3.controlNothing": "چیزی نبود که هم‌پوشانی داشته باشه.",

    "d4.unboundedLeavesOne": "{count} تکه‌ی پایانی بدون شرط تمام‌شدنِ مرزبندی‌شده.",
    "d4.unboundedLeavesMany": "{count} تکه‌ی پایانی بدون شرط تمام‌شدنِ مرزبندی‌شده.",
    "d4.shatteredOne": "{count} تکه تقسیم شده که کلید اون رو تقسیم‌ناپذیر می‌دونه.",
    "d4.shatteredMany": "{count} تکه تقسیم شدن که کلید اون‌ها رو تقسیم‌ناپذیر می‌دونه.",
    "d4.allBounded": "هر تکه‌ی پایانی یه شرط تمام‌شدنِ مرزبندی‌شده داره.",
    "d4.monolithPlaced": "به‌جای تکه‌های اندازه‌ی درست، گزینه‌ی یکپارچه گذاشته شده.",
    "d4.monolithAvoided": "گزینه‌ی یکپارچه گذاشته نشد.",
    "d4.controlSplit": "به {count} تکه تقسیم شد؛ این کار خودش از قبل یه تکه‌ی قابل‌چک بود.",
    "d4.controlWhole": "دست‌نخورده موند، همون‌طور که کار از اول بود.",
    "d4.repairStillSingle": "هنوز یه تکه‌ی تقسیم‌نشده‌ست.",
    "d4.repairSplitOk": "به تکه‌های قابل‌چک تقسیم شد.",
    "d4.repairStillMany": "هنوز {count} تکه برای یه کار تقسیم‌ناپذیر.",
    "d4.repairMergedPartly": "به {count} تکه ادغام شد؛ یه کار تقسیم‌ناپذیر فقط به یکی نیاز داره.",
    "d4.repairMergedUnbounded": "به یه تکه ادغام شد، ولی شرط تمام‌شدنش مرزبندی نشده.",
    "d4.repairMergedOk": "دوباره به یه تکه‌ی قابل‌چک ادغام شد.",
    "d4.repairNotThisFault": "ایراد این آیتم از این جنس نیست؛ فقط مرزبندی چک شد.",

    "d5.mismatchPlaced":
      "یه رابطه‌ی بازدارنده‌ی لازم جا افتاده یا برعکس شده، یا برای یه جفت مستقل ترتیب الکی گذاشته شده.",
    "d5.mismatchFix":
      "هنوز یه رابطه‌ی بازدارنده جا افتاده یا برعکسه، یا برای یه جفت مستقل ترتیب الکی گذاشته شده.",
    "d5.match": "وابستگی‌ها با کلید می‌خونن.",
    "d5.controlNone": "وابستگی‌ای نبود که علامت بخوره.",

    "d6.missing": "جا افتاده: {missing}.",
    "d6.allPresentOne": "تنها تکه‌ی لازم هست.",
    "d6.allPresentMany": "همه‌ی {required} تکه‌ی لازم هستن.",
    "d6.controlNone": "بیشتر از خود کل کار، چیزی لازم نبود.",
  },
};

export const decompositionEvidence = makeEvidence(TABLE);
