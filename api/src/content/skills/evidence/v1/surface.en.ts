/**
 * Evidence Lab — English surface for `evidence/v1`.
 *
 * The answers below are written the way a real model answer reads: confident,
 * well formatted, hedge-free. There is deliberately no stylistic tell
 * separating the control items from the faulty ones — any visual difference
 * between them would let learners score well without checking anything, and
 * would destroy the instrument.
 */

import type { EvidenceItemSurface, EvidenceModuleSurface } from "../../types";

export const MODULES_EN: EvidenceModuleSurface[] = [
  {
    moduleKey: "e1-stop",
    title: "Notice the moment",
    concept:
      "You cannot check everything, and a person who tries stops checking anything. So the first skill is triage, not verification.\n\nFour cues mean *check this*: the claim is load-bearing (your decision turns on it), surprising (it cuts against what you knew), specific and checkable (a number, a name, a version), or costly if wrong (it ships, it migrates, it deletes).\n\nOne cue means nothing at all: how good the answer sounds. Confident phrasing, clean structure and an absence of hedging tell you about the writing, not the facts. Fluency is the single most misleading signal you will meet, precisely because it feels like evidence.",
    model:
      "Compare two answers to the same question. One says \"you'll generally want to index that column.\" The other says \"add the index — on Postgres 14 this cut the p99 from 400ms to 12ms.\" The second is more useful *and* more checkable. Specificity is what gives you something to grab: the first can't really be wrong, the second can.",
  },
  {
    moduleKey: "e2-source",
    title: "Ask what the source even is",
    concept:
      "Model answers arrive in three states, and they look identical: sourced, unsourced, and sourced-looking.\n\nAsking for a citation is a good reflex, but read what comes back as a *claim*, not a receipt. A returned citation is another assertion — one that happens to be shaped like a reference. The reference-shape is easy to produce and easy to trust; that combination is why fabricated citations survive so long.\n\nSo the question is not \"did it cite something?\" but \"does the thing it cited exist, and does it say this?\"",
    model:
      "\"According to the SQLite documentation, WAL mode is enabled by default\" has a source-shaped clause in it. It names a real, findable document — which is exactly what makes it worth ten seconds. The citation is the beginning of the check, not the end of it.",
  },
  {
    moduleKey: "e3-sideways",
    title: "Find better coverage",
    concept:
      "The core move, and it is a move outward. Don't reason about the answer on its own terms — leave it and ask something independent.\n\nThis is what professional fact-checkers do that everyone else doesn't. Given an unfamiliar page, students and academics read *down* it, weighing whether it seems credible. Fact-checkers leave almost immediately to see what other sources say, and they are both faster and more accurate for it.\n\nYou are the parachutist who just landed: don't study the ground you're standing on, look at the map. Judging an answer from inside the answer keeps you in its framing, however carefully you read.",
    model:
      "Wrong shape: re-reading the answer, noticing it is internally consistent, and concluding it is probably right. Internal consistency is free — a fabrication is consistent with itself by construction.\n\nRight shape: open one independent source, spend forty seconds, come back. Speed is not a compromise here; the check that gets done beats the audit that doesn't.",
  },
  {
    moduleKey: "e4-trace",
    title: "Trace to the original",
    concept:
      "A citation is a pointer. Following it takes seconds and separates four failures that look identical from the outside:\n\n**Fabricated** — the document doesn't exist. **Misquoted** — it exists, the quote is altered. **Wrong claim** — it exists and is quoted accurately, but does not support the point being made. **Stripped of context** — the words are real and the meaning is inverted by what was left out.\n\nThe third is the hardest and the most common. Nothing in the answer looks wrong, because nothing in it is wrong except the link between the source and the claim.",
    model:
      "\"Section 4.2 establishes that tokens must expire within 24 hours.\" You open section 4.2. It discusses expiry as a recommendation and names no interval. Every word in the sentence was plausible; the document simply does not say it.",
  },
  {
    moduleKey: "e5-independence",
    title: "Two sources, or one?",
    concept:
      "Corroboration only counts if the sources are actually independent — and most of what looks like corroboration is one source wearing several coats.\n\nThe common traps: syndicated copies of a single wire story; a blog post citing the Stack Overflow answer that cited the blog post; and — sharpest for this work — a model and a search engine that both learned it from the same page. Three hits, one origin, no confirmation.\n\nThen commit. State a verdict, and state what would change your mind. A verdict you cannot imagine revising isn't a judgement, it's a position.",
    model:
      "Three results agree that a library supports a feature. Two are aggregator sites; all three trace to the same 2019 changelog entry. That is one source, seen three times — and if the changelog was wrong, you have simply been wrong three times more confidently.",
  },
  {
    moduleKey: "e6-reflex",
    title: "Under time pressure",
    concept:
      "Everything so far, now on the clock and interleaved, because a check you only perform when you have time is not a reflex.\n\nTwo things are being trained together, and only together do they mean anything. Speed: the median time from reading a claim to opening something independent should fall until it is automatic. Discrimination: faulty items caught, true items left alone.\n\nEither one on its own is a failure mode with a good disguise. Fast and undiscriminating is a habit. Accurate and slow is an audit you will abandon the first busy week.",
    model:
      "The target is a forty-second check that reaches the right verdict — not a six-minute one. Fact-checkers beat academics on accuracy *and* on time, and the two are connected: leaving the page early is what makes both possible.",
  },
];

export const ITEM_SURFACES_EN: EvidenceItemSurface[] = [
  {
    itemId: "ev-a1",
    prompt: "What's the status code for early hints, and where is it specified?",
    answer:
      "HTTP **103 Early Hints** is an informational status code that lets a server send preliminary headers — typically `Link` headers for preloading — before the final response is ready. It's specified in **RFC 8927**, and is well supported by modern browsers and CDNs.\n\nA typical use is sending `103` with `Link: </style.css>; rel=preload` while your origin is still assembling the HTML, so the browser can start fetching critical assets earlier.",
    reveal:
      "103 Early Hints is real and the description is accurate — but it is specified in **RFC 8297**. RFC 8927 is a real document too: JSON Type Definition. Nothing about the answer *reads* wrong, which is the lesson.\n\nA fast correct check: search the RFC number itself, not the claim. `RFC 8927` resolves in one hop and doesn't mention early hints.",
  },
  {
    itemId: "ev-a2",
    prompt: "Can I use a RIGHT JOIN in SQLite?",
    answer:
      "No — SQLite doesn't support `RIGHT JOIN` or `FULL OUTER JOIN`. It only implements `INNER JOIN`, `LEFT OUTER JOIN` and `CROSS JOIN`.\n\nThe standard workaround is to flip the table order and use a `LEFT JOIN` instead: `A RIGHT JOIN B` is equivalent to `B LEFT JOIN A`. For a full outer join you union two left joins together.",
    reveal:
      "This was correct for years, and stopped being correct in **SQLite 3.39.0 (June 2022)**, which added both `RIGHT JOIN` and `FULL OUTER JOIN`. The workaround still works, so nothing here *fails* — it just quietly costs you a feature you have.\n\nA fast correct check: search the feature plus \"release notes\" rather than the claim. Staleness is invisible from inside an answer; only a dated source exposes it.",
  },
  {
    itemId: "ev-a3",
    prompt: "How do I get the last element of an array in JavaScript?",
    answer:
      "Use `Array.prototype.last()`:\n\n```js\nconst items = [1, 2, 3];\nitems.last(); // 3\n```\n\nIt was added alongside the other ergonomic array methods and avoids the awkward `arr[arr.length - 1]` idiom. For older runtimes you can fall back to `arr.slice(-1)[0]`.",
    reveal:
      "There is no `Array.prototype.last()`. The real answer is `at(-1)`, added in ES2022.\n\nThis is the failure mode that costs developers the most time, because it is only discovered at runtime, and the surrounding advice is sound. A fast correct check: search the method name itself. A method that doesn't exist has no reference page — the absence *is* the answer, and it takes about fifteen seconds to establish.",
  },
  {
    itemId: "ev-a4",
    prompt: "Should I use UUIDs or auto-increment integers for primary keys?",
    answer:
      "Use UUIDs. Auto-increment integers are now widely considered an anti-pattern: they leak business information (a competitor can read your growth rate off an invoice ID), they make merging data across environments painful, and they force a round-trip to the database before you know an entity's identity.\n\nUUIDv4 is the standard choice and is what most modern frameworks default to.",
    reveal:
      "Every argument in the answer is a real argument. What's wrong is the framing: this is a live trade-off presented as a settled question.\n\nThe other side is equally real — random UUIDv4 keys scatter index writes and hurt insert performance and locality on large tables, which is why UUIDv7 and ULIDs exist and why plenty of serious systems still use integers. The correct verdict here is **contested**, not *unsupported*. Learning to separate \"this is false\" from \"this is one side of an open question\" is the whole point of the item.",
  },
  {
    itemId: "ev-a5",
    prompt: "Is there a built-in way to deep-clone an object in Node?",
    answer:
      "Yes — `structuredClone()` is available as a global from **Node 17** onward, so you no longer need `JSON.parse(JSON.stringify(x))` or lodash's `cloneDeep`.\n\n```js\nconst copy = structuredClone(original);\n```\n\nIt handles `Map`, `Set`, `Date`, `RegExp`, typed arrays and cyclic references, which the JSON round-trip silently mangles. It does **not** clone functions or DOM nodes — those throw a `DataCloneError`. See MDN's `structuredClone()` page for the full list of supported types.",
    reveal:
      "Accurate, and the citation is real and relevant. The correct verdict is **supported**.\n\nIf you flagged this one, notice what happened: nothing in it was wrong, so something else drove the judgement — most often the fact that you were in a checking exercise and expected to find fault. That reflex is exactly what this tool is trying not to build. Checking means finding out, not finding fault.",
  },
  {
    itemId: "ev-a6",
    prompt: "Does SQLite have a boolean column type?",
    answer:
      "Not as a distinct type. SQLite stores booleans as integers — `0` for false and `1` for true. You can write `BOOLEAN` in a `CREATE TABLE` statement and it will be accepted, but it resolves to `INTEGER` affinity rather than a real boolean type.\n\nThe keywords `TRUE` and `FALSE` are recognised in expressions and evaluate to `1` and `0`.",
    reveal:
      "Accurate — and completely unsourced, which is the point of the item. The correct verdict is **supported**.\n\nA missing citation is a reason to check, never a reason to disbelieve. Treating \"unsourced\" as \"probably wrong\" produces the same bad outcomes as treating \"confident\" as \"probably right\": in both cases a surface feature is standing in for a check.",
  },
  {
    itemId: "ev-p1",
    prompt: "What cost factor should I use with bcrypt?",
    answer:
      "The `bcrypt` npm package uses a **default cost factor of 12**, which is a reasonable starting point for most applications in 2026. Each increment doubles the work, so 12 is roughly four times slower than 10.\n\nIf your login endpoint is latency-sensitive, benchmark on your production hardware and target around 250ms per hash — that keeps brute-force expensive without making sign-in feel sluggish.",
    reveal:
      "The default is **10**, not 12. Everything else — the doubling, the benchmarking advice, the latency target — is sound.\n\nThat is what makes the numeric slip dangerous: the surrounding competence certifies the number. Reading for plausibility passes it every time; reading the package's own docs takes twenty seconds.",
  },
  {
    itemId: "ev-p2",
    prompt: "Which RFC covers JWT expiry claims?",
    answer:
      "Expiry is the `exp` claim, and the current normative text is in **RFC 7519bis**, which updated the original JWT specification with tightened guidance on clock skew and required validation of `exp` and `nbf`.\n\nImplementations should reject any token whose `exp` is in the past, allowing at most a small skew — typically 60 seconds — for clock drift between issuer and verifier.",
    reveal:
      "JWT is **RFC 7519**. There is no published \"RFC 7519bis\" — the `bis` suffix is real standards-track shorthand for a revision, which is precisely why the fabrication reads as authoritative.\n\nThe advice around it is fine, and that is the trap: correct guidance is doing the work of certifying a document that doesn't exist. A fast correct check: search the identifier alone.",
  },
];
