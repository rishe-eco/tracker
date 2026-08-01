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
    exemplarFix: "Update the CSV exporter so it accepts the v2 schema (nested `line_items`).",
    reveal:
      "Three pointers, no anchors: \"this\", \"it\", and \"the new format\" — which is definite-article-definite, implying the reader already knows which format, when they don't.\n\nA fix names all three. Something like: \"Update the CSV exporter so it accepts the v2 schema (nested `line_items`).\" The sentence gets longer and the round trip disappears.",
  },
  {
    itemId: "cl-a5",
    scenario: "Rewrite this so every quantity is bounded.",
    weakText: "There are a few slow queries on the dashboard — can you make them a bit faster soon?",
    exemplarFix: "Three dashboard queries take over 2 seconds; bring each under 300ms.",
    reveal:
      "No dangling pronouns here; this is the other half of R4. \"A few\", \"a bit faster\", and \"soon\" all feel specific from the inside and carry almost no information out.\n\n\"A bit faster\" is the worst of the three, because it names a direction and hides the target — the reader cannot tell whether 10% would satisfy you or whether you need 10×.",
  },
  {
    itemId: "cl-a6",
    scenario: "Cut everything that adds no constraint, input, or criterion. Keep what the reader needs.",
    weakText:
      "I hope this makes sense. I've been thinking about the search feature for a while now and wanted to get your thoughts. Search needs to handle typos — right now \"recieve\" returns nothing. It would be great to get this sorted at some point. Let me know what you think!",
    exemplarFix: "Search needs to tolerate typos — \"recieve\" currently returns nothing.",
    reveal:
      "Two sentences carry the whole message: search needs to tolerate typos, and \"recieve\" currently returns nothing — a concrete reproduction.\n\nThe rest is scaffolding. \"I hope this makes sense\", \"been thinking about it for a while\", \"would be great to get this sorted\", \"let me know what you think\" — four sentences, no constraints. Cutting them makes the request more direct, not colder: the concrete example is doing the friendly work, because it saves the reader from having to ask for one.",
  },
  {
    itemId: "cl-a7",
    scenario: "Rewrite so the subjects are the actors and the verbs are the actions.",
    weakText:
      "The performance of an assessment of the caching implementation should be undertaken by the team, with the provision of recommendations regarding potential improvements.",
    exemplarFix: "The team should assess the caching layer and recommend improvements.",
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

  // ── c1-ask · revision ────────────────────────────────────────────────────
  {
    itemId: "cl-p3",
    scenario:
      "Below is a message someone sent, and what came back. Diagnose which criteria it fails, then rewrite it.",
    weakText:
      "Hi! Hope you had a good weekend. I was going through the venue options for the offsite and there's a lot to weigh up — the Riverside place has better rooms but it's forty minutes further out, and the budget's tighter than last year. Priya said she'd looked at a couple too. Anyway, thoughts?",
    authoredMisread:
      "Good weekend thanks — went to my sister's. On the venues: Riverside does look nicer, though I'd worry about the drive putting people off, especially anyone coming by train. Budget-wise it depends whether we're counting travel. Might be worth seeing what Priya found before we commit either way. Happy to look at more options if it helps.\n\n(No venue chosen. The deposit deadline is in two days, which the message did not mention.)",
    reveal:
      "The ask is \"thoughts?\" — last, and unbounded even once you find it. So the reader gave thoughts. That is not a failure of attention; it is precisely what was requested.\n\n**R1** fails: the request is in the final sentence and asks for nothing specific. **R6** fails too — the weekend line and the aside about Priya add no constraint, input, or criterion between them.\n\nAnd notice what never appears anywhere: the deadline. It's the only fact that determines what the reader should have done, and the message doesn't contain it. Led: \"Pick between Riverside and the Old Mill by Thursday — deposit's due Friday. Riverside has better rooms; it's forty minutes further out.\"",
  },
  {
    itemId: "cl-p4",
    scenario: "A message, and the reply it produced. Diagnose what it fails, then rewrite it.",
    weakText:
      "Could you send me the updated Q3 figures, and also let me know whether we're still on for the client call on the 14th? Either is fine whenever you get a chance.",
    authoredMisread:
      "Yes — the 14th still works, 2pm your time. I've put it in the calendar.\n\n(The figures were not sent. They were needed for a board pack going out that afternoon.)",
    reveal:
      "Two requests of very different cost, presented as equals, followed by \"either is fine whenever you get a chance\" — which a reader correctly hears as *neither of these is urgent*. So they did the one that took ten seconds.\n\n**R1** is level 1: the ask is early and clear, but there are two of them with no stated priority. The fix isn't to send two separate messages — it's one clause: \"The figures are the urgent one, I need them before 3pm today; the call is just a yes/no whenever.\"",
  },
  {
    itemId: "cl-p5",
    scenario: "A message, and what the reader did with it. Diagnose what it fails, then rewrite it.",
    weakText: "It'd be good to have a version of the slide deck that works for the board.",
    authoredMisread:
      "Agreed — the current one is definitely pitched at the team rather than the board. Worth doing at some point.\n\n(No deck was produced. Two weeks later, the board meeting used the team version.)",
    reveal:
      "There is no request here. It's a wish, phrased as an observation, and the reader agreed with it — which is the correct response to what was actually written. **R1 = 0**: the reader had to infer that anything was being asked for at all.\n\nTwo more failures ride along. **R2**: no deliverable is bound — how long, what format, when. **R5**: \"works for the board\" is not checkable by anyone, including you.\n\nThis is the hardest habit in `c1` to break, because the indirect version feels considerate. Between people it often is — hedging preserves face on both sides. Here it just produced agreement instead of a deck.",
  },

  // ── c2-deliverable · revision ────────────────────────────────────────────
  {
    itemId: "cl-p6",
    scenario: "A request, and what came back. Diagnose what it fails, then rewrite it.",
    weakText: "Can you summarise the tenancy agreement for me? Thanks!",
    authoredMisread:
      "Sure — here's a clause-by-clause rundown.\n\n**1. Parties and premises.** The agreement is between… *(continues for nine hundred words, covering all twenty-two clauses including the boilerplate on notices and service of documents.)*\n\n(You wanted to know whether you can keep a cat. That's clause 14, and it's one line.)",
    reveal:
      "**R2 = 0.** The kind of output is named and nothing else — no length, no format, no scope. Nine hundred words is a defensible reading of \"summarise\"; so is one line. The reader had to pick, and picked the safe one.\n\n**R3** fails alongside it, and it's the more interesting failure: the *purpose* was missing. You didn't want a summary, you wanted an answer to a question, and the summary was your guess at how to get one. \"Does this agreement allow pets? Quote the relevant clause.\" is shorter than what was sent and gets the thing you actually wanted.",
  },
  {
    itemId: "cl-p7",
    scenario: "A request, and what came back. Diagnose what it fails, then rewrite it.",
    weakText:
      "Please write up notes from today's meeting — bullet points, roughly a page, for the people who couldn't make it.",
    authoredMisread:
      "Notes are up on the shared drive. Covered the roadmap discussion, the hiring update, the compensation review, and the Q4 dates.\n\n(The compensation review was confidential to the eight people in the room. It is now readable by the whole company.)",
    reveal:
      "This is a **good** request and it still fails. Kind, format, length and audience are all present — that's more than most messages manage, and **R2 is level 1, not 0**.\n\nWhat's missing is one out-of-scope clause. \"Don't include the compensation discussion\" is four words, and it prevents the single outcome here that cannot be undone.\n\nThat's why out-of-scope is the highest-value sentence in most requests and the one people skip: a positive instruction tells the reader where to go, and only a negative one tells them where the edge is. You otherwise find the edge by watching someone cross it.",
  },
  {
    itemId: "cl-p8",
    scenario: "A request, and what came back. Diagnose what it fails, then rewrite it.",
    weakText: "Can you put together something on the new returns policy for the shop floor team?",
    authoredMisread:
      "Done — two-page briefing document covering the policy change, the rationale, the transition dates and the escalation path, with the full policy text as an appendix.\n\n(What was needed was a laminated card with four steps on it, to live next to the till.)",
    reveal:
      "\"Something\" is the tell, and the sentence contains exactly one specific — \"for the shop floor team\" — which describes the audience, not the artifact. **R2 = 0**: two wildly different deliverables both satisfy this request perfectly.\n\nNotice the reader did nothing wrong and worked harder than they needed to. That's the usual shape of an R2 failure: not a bad answer, a well-made answer to a question you didn't ask. \"A one-side card, four steps max, to sit by the till\" costs eleven words and removes the entire ambiguity.",
  },

  // ── c3-context · revision ────────────────────────────────────────────────
  {
    itemId: "cl-p9",
    scenario: "A message, and what happened next. Diagnose what it fails, then rewrite it.",
    weakText: "The oven's not heating properly — can you have a look when you're next round?",
    authoredMisread:
      "Had a look. Checked the element and the thermostat, both testing fine. Could be the fan motor — I'll bring one next time and swap it out.\n\n(Call-out charged. The oven is gas. It does not have an element.)",
    reveal:
      "One fact was missing and it invalidated the whole visit. **R3** is the failure, and it is the purest possible case of the curse of knowledge: you have always known the oven is gas, so the fact most obviously absent from your message is exactly the one that felt too obvious to state.\n\nThis is why the module recommends working from a checklist rather than from feel. Feel is the faculty that just failed. \"The gas oven isn't reaching temperature — the grill still works\" is nine words longer and saves a wasted visit.",
  },
  {
    itemId: "cl-p10",
    scenario: "A message, and what came back. Diagnose what it fails, then rewrite it.",
    weakText:
      "So this has been rumbling on a while — originally the team was on the shared drive, then we moved to the cloud version last year, which broke the macros. Priya rebuilt most of those but a couple never came back. There was also the permissions mess in March, sorted now. Anyway, if you could rebuild the tracker that'd be great, ideally something that still opens in Excel 2016 since half of finance is on it.",
    authoredMisread:
      "Rebuilt it as a shared online sheet — much cleaner, and the macros are now scripts so they won't break on the next migration either. Link's in the channel.\n\n(Finance cannot open it.)",
    reveal:
      "Every sentence here is true and almost none of it is load-bearing. The shared drive, the migration, Priya's macros, the permissions mess — all resolved, none of it changes what a competent person would build.\n\nExactly one constraint does: it has to open in Excel 2016. It arrives in the final clause of the final sentence, behind everything else, hedged with \"ideally\".\n\n**R3 = 1** — the required context is present but buried past the point of being received, and supplied is not the same as received. **R6 = 0** — the load-bearing constraint is last, and at least two sentences constrain nothing. Front-load it and the message gets shorter as well as clearer.",
  },
  {
    itemId: "cl-p11",
    scenario: "A message, and what happened. Diagnose what it fails, then rewrite it.",
    weakText:
      "The new checkout is slower than the old one and customers have been complaining. Can you roll it back?",
    authoredMisread:
      "Rolled back, and confirmed the old flow is live again.\n\n(The new checkout was measurably faster. The two complaints received were about the confirm button being hard to find — a five-minute fix that has now been reverted along with everything else.)",
    reveal:
      "This looks like well-supplied context, and that's what makes it the hard one. You gave the reader a cause, a symptom and a remedy — but the cause was your inference, not your observation, and from outside the message there is no way to tell the two apart.\n\n**R3** is the failure, via Grice's quality maxim: don't assert what you can't back. The fix is almost embarrassingly small — one hedge, honestly placed: \"Two customers have complained about the new checkout. I *think* it's speed but I haven't measured it. Can you look before we decide whether to roll back?\"\n\nThat version gets you the five-minute fix. The original got you a rollback of work that was fine.",
  },

  // ── c4-referents · repair ────────────────────────────────────────────────
  {
    itemId: "cl-p12",
    scenario: "Rewrite this so nothing is left dangling.",
    weakText: "Send that when you've finished with it.",
    exemplarFix: "Send me the signed lease when you've finished reading it.",
    reveal:
      "Two pointers, no anchors — and no way to tell whether \"that\" and \"it\" are even the same object. In your head they resolved instantly; on the page they resolve to whatever the reader last had in mind.\n\nNaming both is the whole fix: \"Send me the signed lease when you've finished reading it.\" Six words longer, and the round trip disappears.",
  },
  {
    itemId: "cl-p13",
    scenario: "Rewrite this so every quantity is bounded.",
    weakText: "We'll need a few more chairs and some extra time on the day — can you sort it soon?",
    exemplarFix: "We'll need six more chairs and 45 extra minutes in the room booking. Can you confirm both by Friday?",
    reveal:
      "No dangling pronouns here; this is R4's other half. \"A few\", \"some extra\" and \"soon\" all feel specific from the inside and carry nothing out — the person setting up the room cannot act on any of them without asking you.\n\nAnd \"soon\" is doing real damage, because it reads as a deadline while committing to nothing. Numbers, or a range, or a date. Anything a second person could check.",
  },
  {
    itemId: "cl-p14",
    scenario: "Rewrite this so the target is stated, not just the direction.",
    weakText: "Make the sign better and move it somewhere more visible — a few people have missed it.",
    exemplarFix: "Reprint the sign at 48pt and mount it at eye height beside the main entrance.",
    reveal:
      "\"Better\" is the worst offender in this whole module, because it names a direction and hides the target — and it sounds like a specification while functioning as none. Better than what? Visible to whom, from where?\n\n\"A few people have missed it\" is the same failure wearing evidence: it sounds like data and can't be acted on. Two people or twenty changes what you'd do.",
  },

  // ── c5-done · revision ───────────────────────────────────────────────────
  {
    itemId: "cl-p15",
    scenario: "A request, and what came back. Diagnose what it fails, then rewrite it.",
    weakText: "Have a tidy of the garage this weekend if you get a chance.",
    authoredMisread:
      "Done — swept it through, stacked everything neatly against the back wall, took two bags to the tip.\n\n(The car still doesn't fit. That was the point.)",
    reveal:
      "\"Tidy\" is a direction, not a bar. The bar existed — the car fits — and was never stated, so the reader applied their own and met it completely. **R5 = 0.** Nobody underperformed here.\n\nIf you can't state a bar, state the failure instead: \"it hasn't worked if the car still doesn't fit.\" That's often easier to name and does the same job.\n\nNote that this isn't a workplace skill wearing a domestic example. It's the same move at every scale, and Tracker's own Clarity Check asks the identical question of a goal's definition of done: could a third party look at the result and say yes or no?",
  },
  {
    itemId: "cl-p16",
    scenario: "A request, and what came back. Diagnose what it fails, then rewrite it.",
    weakText:
      "Rewrite the welcome email so it feels warmer and more on-brand. Should be a quick one.",
    authoredMisread:
      "Here's a warmer version — swapped \"Dear\" for \"Hi\", added an exclamation mark to the greeting, signed off from the team rather than the company.\n\n(Three rounds of revisions followed. None of them converged.)",
    reveal:
      "Two criteria are stated and neither is checkable — not by a third party, and not by the person who wrote them. That's why it took three rounds: there was nothing to converge *on*, so each pass was a new guess at a target nobody could see.\n\n**R5 = 1**: criteria present, checkability absent. **R2** is partly at fault too — \"should be a quick one\" is a bound on the reader's effort, not on the deliverable.\n\nA checkable version names a test: \"a new customer should be able to tell what to do next without scrolling.\" One round.",
  },

  // ── c6-economy · repair ──────────────────────────────────────────────────
  {
    itemId: "cl-p17",
    scenario: "Cut everything that adds no constraint, input, or criterion.",
    weakText:
      "I hope you're well. I've been meaning to write for a while. The delivery didn't arrive on Tuesday as arranged. Let me know your thoughts when you have a moment. Thanks so much!",
    exemplarFix:
      "The delivery didn't arrive on Tuesday as arranged — please redeliver by Friday 5pm or refund the order.",
    reveal:
      "One sentence carries the message. Four don't.\n\nCutting them does something more useful than shortening it, though: it exposes that **no request was ever made**. \"Let me know your thoughts\" was standing in for one, and once it's gone the gap is obvious. You have to decide what you actually want — redelivery or a refund — and say so.\n\nThat's the usual reward for cutting padding. It isn't brevity; it's finding out what the message was missing.",
  },
  {
    itemId: "cl-p18",
    scenario: "Rewrite so the subjects are the actors and the verbs are the actions.",
    weakText:
      "The completion of the registration process must be performed prior to the submission of an application.",
    exemplarFix: "You must register before you apply.",
    reveal:
      "Every action in that sentence is hiding inside a noun — *completion*, *registration*, *submission*, *application* — and the only verb, \"be performed\", does no work at all.\n\nThere is also no actor anywhere in it. Nobody registers; registration merely gets completed. That's the giveaway, and it's why this register is so common in official writing: the missing person is a feature, not an accident.\n\nFind the character and the action: \"You must register before you apply.\" Sixteen words become six, the person reappears, and nothing is lost.",
  },
  {
    itemId: "cl-p19",
    scenario: "Move the load-bearing constraint to the front, and cut what doesn't constrain.",
    weakText:
      "Book the meeting room for the workshop, order lunch for everyone, sort out the projector, and make sure it's all done before Wednesday because the external facilitator arrives then.",
    exemplarFix:
      "Everything must be ready before Wednesday, when the external facilitator arrives: meeting room booked, lunch ordered, projector tested.",
    reveal:
      "Nothing here is padding and it still fails, which is the point of the item — **order is the fault, not length**.\n\nThe deadline is the only thing that determines whether any of the three tasks succeeds, and it sits in the last clause behind all of them. A reader skimming stops at \"sort out the projector\" and starts work with no idea there's a Wednesday.\n\n\"Make sure it's all done\" also earns nothing: the list already said that.",
  },
];
