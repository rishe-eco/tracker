/**
 * Seed accounts for the Feelings & Needs feel-test.
 *
 * The internal pass (plan §9 M6) is about whether the module *feels* like the
 * pillar — short, body-first, in your own words, always moving toward a need,
 * teaching by gentle catch rather than quiz. You cannot judge that from the
 * first screen: most of what there is to feel only appears after a fortnight of
 * practice, and nobody is going to run fifteen sittings to get there.
 *
 * So this puts a reviewer directly into each state. Every account is real data
 * through the ordinary tables — no special-casing anywhere in the app.
 *
 *   npm run seed:fn
 *
 * Re-runnable: it deletes and recreates its own accounts, and touches nothing
 * else. Never point it at production; the passwords are shared and printed.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { DIALS } from "../content/feelings-needs";

const prisma = new PrismaClient();

const PASSWORD = "change-me-please";
const DOMAIN = "@feeltest.local";

type Scenario = {
  slug: string;
  label: string;
  /** What the reviewer should be looking at in this state. */
  lookFor: string;
  frameDone: boolean;
  completedSittings: number;
};

const { sittingsPerFadeStep, graduationFadeLevel } = DIALS.graduation;

const SCENARIOS: Scenario[] = [
  {
    slug: "fresh",
    label: "Day one, nothing done",
    lookFor:
      "The frame is the only way in — the loop button is disabled. Does the frame land without telling you the lesson?",
    frameDone: false,
    completedSittings: 0,
  },
  {
    slug: "new",
    label: "Frame done, first loop",
    lookFor:
      "Full scaffolding, and only pleasant/met-need words in the palette. Does the first pass land a word easily?",
    frameDone: true,
    completedSittings: 0,
  },
  {
    slug: "settled",
    label: "The loop is a habit",
    lookFor:
      "Helper lines have gone and the palette has broadened to the harder words. Notice that nothing announced either change.",
    frameDone: true,
    completedSittings: sittingsPerFadeStep,
  },
  {
    slug: "catching",
    label: "Ready for a distinction catch",
    lookFor:
      'Type a faux-feeling at "other → type it" — try "ignored" or "taken for granted". Does the catch read as gentle, and can you wave it off?',
    frameDone: true,
    completedSittings: DIALS.distinctions.minLoopsBeforeCatch,
  },
  {
    slug: "faded",
    label: "Scaffolding mostly withdrawn",
    lookFor: "Terse prompts throughout. Is it still obvious what to do?",
    frameDone: true,
    completedSittings: sittingsPerFadeStep * 2,
  },
  {
    slug: "door",
    label: "One sitting from graduating",
    lookFor:
      "Finish one loop and the capability moment appears. Does it read as a door rather than a prize?",
    frameDone: true,
    completedSittings: sittingsPerFadeStep * graduationFadeLevel - 1,
  },
];

async function seedOne(s: Scenario) {
  const email = `fn-${s.slug}${DOMAIN}`;
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(PASSWORD, 4),
      name: s.label,
      loopState: { create: { contentVersion: "feelings-needs/v1" } },
      ...(s.frameDone ? { frameCompletion: { create: {} } } : {}),
    },
  });

  // Spread the sittings backwards over distinct days. Same-day rows would all
  // count as "today" and the tool would try to resume one of them.
  for (let i = 0; i < s.completedSittings; i++) {
    const day = new Date();
    day.setDate(day.getDate() - (s.completedSittings - i));
    day.setHours(10, 0, 0, 0);

    await prisma.loopSitting.create({
      data: {
        userId: user.id,
        breathTaken: true,
        createdAt: day,
        completedAt: day,
        entries: {
          create: {
            passIndex: 0,
            bodyLocation: "chest",
            bodyTexture: "tight",
            feelingWord: "uneasy",
            feelingSource: "palette",
            need: "rest",
            needSource: "palette",
            createdAt: day,
          },
        },
      },
    });
  }

  return email;
}

async function main() {
  console.log("Seeding Feelings & Needs feel-test accounts…\n");

  for (const s of SCENARIOS) {
    const email = await seedOne(s);
    console.log(`  ${s.label}`);
    console.log(`    ${email}`);
    console.log(`    ${s.lookFor}\n`);
  }

  console.log(`Password for all of them: ${PASSWORD}`);
  console.log("Start at /tools/learn/feelings-needs\n");
  console.log(
    "Every account works in both languages — switch the app to فارسی and the\n" +
      "same account runs in Persian, since the locale comes off the request and\n" +
      "is not stored per user. The Persian surface is a DRAFT: the app says so in\n" +
      "a banner, and the words want a native ear more than a proofread. The two to\n" +
      'look hardest at are the texture palette (must stay bodily — «دلم گرفته» is\n' +
      "a sensation by grammar and a sadness by usage) and whether each feeling word\n" +
      "is the one you would actually reach for.\n"
  );
  console.log(
    "What this pass cannot answer: whether any of it works. That needs the\n" +
      "discovery, not a review — this is a check that the thing feels like the\n" +
      "pillar, and nothing more."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
