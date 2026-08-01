/**
 * Clarity Lab — English surface for `clarity/v1`.
 *
 * The Gricean maxims appear here as a *diagnostic vocabulary*, never as a
 * rulebook. Grice framed them as a description of how understanding works, not
 * a code of conduct — so the modules use them to explain why an attempt failed
 * (too little context is a quantity failure; a buried ask is a manner failure)
 * rather than as commandments to obey.
 */

import type { ClarityItemSurface, ClarityModuleSurface } from "../types";

export const MODULES_EN: ClarityModuleSurface[] = [
  {
    moduleKey: "c1-ask",
    title: "Lead with the ask",
    concept:
      "A reader allocates attention front to back. Whatever arrives first sets the frame everything after it is read through — so a request that arrives last gets read as a footnote to the setup, and you get an answer to your background instead of your question.\n\nThe fix is unglamorous: say what you want, first, as a request. Then give the context that constrains it.\n\nThis feels blunt, and in conversation between people it often is. We bury requests deliberately: indirectness lets a speaker deny they were really asking, which preserves face on both sides. With a machine there is no face to save. The social reason for hedging is simply absent, so the plain version is not rude — it is just the version that works.\n\nOne ask, too. Two co-equal requests in one message force the reader to guess a priority, and a guessed priority is wrong about half the time. If you genuinely need two things, say which one matters more.",
    model:
      "Buried: \"We've been getting complaints about the export. It's been slow since the migration, and the CSV path especially. I was wondering if you could look at it.\"\n\nLed: \"Find why CSV export is slow and tell me the cause. Since the migration, exports over ~10k rows time out; other formats are unaffected.\"\n\nSame facts, same length. The second one can't be misread as a status update.",
  },
  {
    moduleKey: "c2-deliverable",
    title: "Name the deliverable",
    concept:
      "\"Summarise this\" has an enormous answer space. One line or two pages? Prose or bullets? For you, or for someone who has never seen the material? Every one of those is a defensible reading, so the reader picks — and then you do a round trip to correct a choice you could have made in four words.\n\nName the kind of output, then bound it: format, length, scope, structure. Two of those four is usually enough to collapse the space.\n\nThen say one thing that is **out of scope**. This is the highest-value sentence in most requests and the one people skip. \"Don't rewrite the tests\" or \"ignore the legacy folder\" prevents an entire category of unwanted work, and it does something a positive instruction can't: it marks the boundary you'd otherwise only discover by having it crossed.",
    model:
      "Unbounded: \"Write up the incident.\"\n\nBounded: \"Write an incident summary — under 400 words, structured as timeline, cause, fix — for engineers who weren't on call. Don't include remediation planning; that's a separate doc.\"",
  },
  {
    moduleKey: "c3-context",
    title: "Enough context, no more",
    concept:
      "This is Grice's quantity maxim, and it cuts both ways. Too little context and the reader fills the gap with assumptions. Too much and the load-bearing facts are buried in material that doesn't constrain anything.\n\nThe trap on the first side is the curse of knowledge: once you know something, you cannot really model not knowing it. The facts most obviously missing from your request are exactly the ones that feel too obvious to state. You have been staring at the problem for an hour; the reader arrives at sentence one.\n\nSo work from a checklist rather than from feel. Audience, purpose, inputs, constraints, prior attempts, what's already ruled out. Ask of each: does this change what a competent reader would produce? If not, cut it.\n\nThat last question is the whole skill. Not \"is this true?\" or \"is this relevant?\" — is this *load-bearing*?",
    model:
      "Under: \"Why is the test failing?\"\n\nOver: three paragraphs of history, two of which describe things already fixed.\n\nLoad-bearing: \"Why does `auth.integration.test.ts` fail only in CI? Passes locally on Node 22; CI runs Node 20. Started after we added the token-expiry test. I've already ruled out clock skew.\"",
  },
  {
    moduleKey: "c4-referents",
    title: "Nothing dangling",
    concept:
      "Pronouns and demonstratives are pointers. In your head they resolve instantly, because you know what you meant. On the page they resolve to whatever the reader last had in mind — which may not be what you last had in mind.\n\nThree things to catch:\n\n**Bare demonstratives.** \"Fix this.\" This *what*? Attach a noun: \"fix this timeout\".\n\n**Orphaned pronouns.** \"It fails when they run it.\" Three pointers, no anchors.\n\n**Unbounded quantifiers.** \"A few\", \"several\", \"soon\", \"better\", \"clean it up\". These feel specific from the inside and carry almost no information. \"Better\" is the worst offender in technical writing, because it names a direction and hides the target.\n\nThe test is mechanical: for every pointer, can you underline the exact phrase it points at? If not, replace the pointer with that phrase.",
    model:
      "Dangling: \"It's still broken after that change, so can you make it a bit faster?\"\n\nBound: \"The nightly sync still fails after the retry change. Bring its p95 under 30 seconds.\"",
  },
  {
    moduleKey: "c5-done",
    title: "Say what done looks like",
    concept:
      "A request without a success criterion outsources the standard to the reader. They will apply one — theirs — and you will find out what it was when you read the result.\n\nA criterion is checkable when a third party could apply it to the output and get a yes or no without asking you what you meant. \"Make it clearer\" fails that test. \"A new engineer can run it without asking a question\" passes.\n\nIf you can't state a bar, state the failure instead: what would make this answer wrong? That's often easier to name and does the same work.\n\nThis is the same move Tracker's Clarity Check makes on a goal's definition of done — observability and a clear yes/no — applied to a sentence rather than a goal. The scale differs; the question is identical, and if you have run the Clarity Check on a real goal you have already practised this once.",
    model:
      "Unfalsifiable: \"Make the onboarding docs better.\"\n\nCheckable: \"Rewrite the onboarding docs so a new engineer gets the app running locally without asking anyone. Success: someone who has never seen the repo follows it start to finish and hits no undocumented step.\"",
  },
  {
    moduleKey: "c6-economy",
    title: "Characters, actions, and cutting",
    concept:
      "Two ideas, and the second one is the durable version of a technique that keeps going out of date.\n\n**Characters and actions.** Readers judge a sentence clear when its grammatical subjects are the story's characters and its verbs are the story's actions. Prose goes murky when the actions get packed into nouns and the verbs go empty: \"perform a review of\" instead of \"review\", \"provide clarification on\" instead of \"clarify\". Find the real action, make it the verb.\n\n**Economy.** Say the necessary thing and nothing more, and put the load-bearing constraint early. Every sentence should add a constraint, an input, or a criterion; if a sentence adds none of the three, delete it and nothing is lost.\n\nYou may have met this as advice about token budgets. That framing perishes — context windows grow, prices change, the specific numbers stop being true. What doesn't perish is the reason underneath: front-load what matters, cut what doesn't. That was good writing advice before there were tokens to count, and it will outlast whatever the current limits are.",
    model:
      "Nominalised and padded: \"I wanted to reach out regarding the possibility of performing an optimisation of the query. There has been some discussion about performance recently.\"\n\nCharacters and actions: \"Optimise the dashboard query. It's the slowest call on the page at p95.\"",
  },
];

export const ITEM_SURFACES_EN: ClarityItemSurface[] = [
  {
    itemId: "cl-a1",
    scenario:
      "You need a colleague's help producing a short written piece about a recent outage. Write the request you would actually send.",
    contextSheet:
      "What you know:\n\n• The outage lasted 47 minutes on Tuesday morning.\n• Root cause was a connection-pool exhaustion after a config change.\n• The write-up is for the weekly all-hands, where most of the audience is non-technical.\n• It needs to fit on one slide.\n• Your colleague was not on call and has not seen the incident channel.\n• The incident channel has 300 messages in it.\n• You personally think the config review process is the real problem, but that's your opinion and not established.",
    reveal:
      "Four facts here are load-bearing: the audience is non-technical, it has to fit one slide, your colleague hasn't seen the incident channel (so they need the cause stated, not just pointed at), and the cause itself.\n\nThree are not. The 47 minutes is colour. The 300 messages describe your experience, not their task. And your opinion about the review process is explicitly not established — including it as background invites them to write it up as fact, which is a quality-maxim problem: don't assert what you can't back.\n\nR3 level 2 needs the four, and at most one of the three. Pasting the whole sheet is not thoroughness; it's handing over the sorting job you were supposed to do.",
  },
  {
    itemId: "cl-a2",
    scenario:
      "A page in your app is slow and you want help fixing it. Write the request. You will be judged mainly on whether someone else could tell when the job is finished.",
    contextSheet:
      "What you know:\n\n• The reports page takes about 6 seconds to load.\n• Users have complained; two have stopped using it.\n• You suspect the date-range query but haven't profiled it.\n• There's a caching layer you'd rather not touch — it's shared with billing.\n• Anything above about 1 second feels broken to your users.\n• You have a staging environment with production-sized data.",
    reveal:
      "The trap is that \"make the reports page faster\" feels like a specification. It isn't: any improvement satisfies it, so nobody can tell when to stop.\n\nA checkable bar is available and sitting in the context sheet — under a second, on staging, with production-sized data. Note it needs all three parts: a number without an environment is not reproducible, and \"under 1s\" on an empty database means nothing.\n\nAlso available and commonly missed: the caching layer is out of scope. Saying so prevents an entire class of solution you don't want, and costs one clause.",
  },
  {
    itemId: "cl-a3",
    scenario:
      "Below is a request someone sent, and what the reader produced from it. Diagnose which criteria it fails, then rewrite it.",
    weakText:
      "Hey — hope the sprint's going okay. We've had a few reports from the support side about the billing export, and I know you've been deep in the migration work so I didn't want to add noise. There was also that thread last week about column ordering, which may or may not be related. Anyway, when you get a chance, could you take a look?",
    authoredMisread:
      "Sure — I read back through the column-ordering thread. I don't think it's related to the migration; the ordering change only touched the display layer, and the migration didn't move any billing tables. Let me know if you want me to dig further into the migration side.\n\n(Total time spent: 40 minutes. Nothing was looked at in the billing export.)",
    reveal:
      "The request is there — \"could you take a look\" — in the last sentence, behind three sentences of hedging. The reader did what readers do: they answered the most concrete thing in the message, which was the column-ordering thread.\n\n**R1** fails: the ask is last, and it's vague enough that \"look at\" could mean anything. **R6** fails too — the sprint pleasantry, the apology about noise, and the \"may or may not be related\" aside add no constraint, input, or criterion between them.\n\nNotice what isn't wrong: the tone. Politeness costs nothing here. What costs is putting the polite part in the position the reader treats as the point.",
  },
  {
    itemId: "cl-a4",
    scenario: "Rewrite this so nothing is left dangling.",
    weakText: "Can you update this so it works with the new format?",
    reveal:
      "Three pointers, no anchors: \"this\", \"it\", and \"the new format\" — which is definite-article-definite, implying the reader already knows which format, when they don't.\n\nA fix names all three. Something like: \"Update the CSV exporter so it accepts the v2 schema (nested `line_items`).\" The sentence gets longer and the round trip disappears.",
  },
  {
    itemId: "cl-a5",
    scenario: "Rewrite this so every quantity is bounded.",
    weakText: "There are a few slow queries on the dashboard — can you make them a bit faster soon?",
    reveal:
      "No dangling pronouns here; this is the other half of R4. \"A few\", \"a bit faster\", and \"soon\" all feel specific from the inside and carry almost no information out.\n\n\"A bit faster\" is the worst of the three, because it names a direction and hides the target — the reader cannot tell whether 10% would satisfy you or whether you need 10×.",
  },
  {
    itemId: "cl-a6",
    scenario: "Cut everything that adds no constraint, input, or criterion. Keep what the reader needs.",
    weakText:
      "I hope this makes sense. I've been thinking about the search feature for a while now and wanted to get your thoughts. Search needs to handle typos — right now \"recieve\" returns nothing. It would be great to get this sorted at some point. Let me know what you think!",
    reveal:
      "Two sentences carry the whole message: search needs to tolerate typos, and \"recieve\" currently returns nothing — a concrete reproduction.\n\nThe rest is scaffolding. \"I hope this makes sense\", \"been thinking about it for a while\", \"would be great to get this sorted\", \"let me know what you think\" — four sentences, no constraints. Cutting them makes the request more direct, not colder: the concrete example is doing the friendly work, because it saves the reader from having to ask for one.",
  },
  {
    itemId: "cl-a7",
    scenario: "Rewrite so the subjects are the actors and the verbs are the actions.",
    weakText:
      "The performance of an assessment of the caching implementation should be undertaken by the team, with the provision of recommendations regarding potential improvements.",
    reveal:
      "Every action in that sentence is hiding inside a noun: *performance*, *assessment*, *implementation*, *provision*, *improvements*. The actual verbs — \"should be undertaken\" — do no work at all.\n\nFind the characters (the team) and the actions (assess, recommend): \"The team should assess the caching layer and recommend improvements.\" Twenty-eight words become eleven, and nothing is lost — which is Williams's point exactly.",
  },
  {
    itemId: "cl-p1",
    scenario:
      "You want a written comparison of two libraries to help your team decide. Write the request.",
    contextSheet:
      "What you know:\n\n• The choice is between two date libraries for the frontend.\n• The team decides at Thursday's meeting — five people, mixed seniority.\n• Bundle size matters; the app is already over budget.\n• You don't want a recommendation, you want the trade-offs laid out.\n• One of the two is already used in a different repo at the company.",
    reveal:
      "\"Compare these two libraries\" names a kind of output and nothing else. R2 level 2 wants the shape: a table or prose, how long, and — the one most often missed here — that you want trade-offs rather than a recommendation. That's an out-of-scope statement, and without it you will get a recommendation, because that's what a helpful reader produces by default.",
  },
  {
    itemId: "cl-p2",
    scenario:
      "Below is a request and what the reader produced. Diagnose what it fails, then rewrite it.",
    weakText:
      "Please clean up the README — it's out of date in a few places and generally not great for new people. Markdown is fine. Aim for something reasonably short.",
    authoredMisread:
      "Done — trimmed the README from 800 to 300 lines, removed the outdated sections on the old deploy flow, and tightened the language throughout.\n\n(The setup instructions, which were the part new people actually got stuck on, are now shorter and still missing the two undocumented steps.)",
    reveal:
      "This one is well-ordered and specific about format and length — and still fails, because \"not great for new people\" isn't checkable. The reader optimised for the bar they could see, which was brevity, and made the actual problem slightly worse.\n\n**R5** is the failure: there's no test a third party could apply. \"A new engineer follows it start to finish and hits no undocumented step\" would have redirected the entire effort. **R2** is partly at fault too — \"reasonably short\" is a bound in name only.",
  },
];
