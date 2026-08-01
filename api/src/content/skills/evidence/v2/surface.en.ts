/**
 * Evidence Lab — English surface for `evidence/v2`.
 *
 * The answers below are written the way a real model answer reads: confident,
 * well formatted, hedge-free. There is deliberately no stylistic tell
 * separating the control items from the faulty ones — any visual difference
 * between them would let learners score well without checking anything, and
 * would destroy the instrument. Bold, structure and citation density are
 * distributed across both.
 *
 * Subject matter is general on purpose (see `spec.ts`): every claim here can be
 * felt without background and settled by one ordinary search.
 */

import type { EvidenceItemSurface, EvidenceModuleSurface } from "../../types";

export const MODULES_EN: EvidenceModuleSurface[] = [
  {
    moduleKey: "e1-stop",
    title: "Notice the moment",
    concept:
      "You cannot check everything, and a person who tries stops checking anything. So the first skill is triage, not verification.\n\nFour cues mean *check this*: the claim is load-bearing (your decision turns on it), surprising (it cuts against what you knew), specific and checkable (a number, a name, a date), or costly if wrong (you'll repeat it, act on it, spend on it).\n\nOne cue means nothing at all: how good the answer sounds. Confident phrasing, clean structure and an absence of hedging tell you about the writing, not the facts. Fluency is the single most misleading signal you will meet, precisely because it feels like evidence.",
    model:
      "Compare two answers to the same question about resting between sets at the gym. One says \"take as long as you need to feel recovered.\" The other says \"rest three minutes between heavy sets — trained lifters given three minutes gained more strength over eight weeks than those given one.\" The second is more useful *and* more checkable. Specificity is what gives you something to grab: the first can't really be wrong, the second can.",
  },
  {
    moduleKey: "e2-source",
    title: "Ask what the source even is",
    concept:
      "Model answers arrive in three states, and they look identical: sourced, unsourced, and sourced-looking.\n\nAsking for a citation is a good reflex, but read what comes back as a *claim*, not a receipt. A returned citation is another assertion — one that happens to be shaped like a reference. The reference-shape is easy to produce and easy to trust; that combination is why fabricated citations survive so long.\n\nSo the question is not \"did it cite something?\" but \"does the thing it cited exist, and does it say this?\"",
    model:
      "\"According to the World Health Organization, adults should get at least 150 minutes of moderate activity a week\" has a source-shaped clause in it. It names a real, findable body and a specific figure — which is exactly what makes it worth ten seconds. The citation is the beginning of the check, not the end of it.",
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
      "\"A 2019 World Health Organization report establishes that screen use before bed cuts sleep quality by 30%.\" You open the report. It discusses screens and sleep in general terms and names no such figure. Every word in the sentence was plausible; the document simply does not say it.",
  },
  {
    moduleKey: "e5-independence",
    title: "Two sources, or one?",
    concept:
      "Corroboration only counts if the sources are actually independent — and most of what looks like corroboration is one source wearing several coats.\n\nThe common traps: syndicated copies of a single wire story; an article citing the encyclopedia entry that cited the article; and — sharpest for this work — a model and a search engine that both learned it from the same page. Three hits, one origin, no confirmation.\n\nThen commit. State a verdict, and state what would change your mind. A verdict you cannot imagine revising isn't a judgement, it's a position.",
    model:
      "Three news results agree that a food additive is dangerous. Two are aggregator sites; all three trace back to the same 2015 press release. That is one source, seen three times — and if the press release overstated it, you have simply been wrong three times more confidently.",
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
  // ── Probe form A ─────────────────────────────────────────────────────────
  {
    itemId: "ev2-a1",
    prompt: "How much water should I actually drink in a day?",
    answer:
      "The standard guidance is **eight 8-ounce glasses a day** — about 2 litres. This isn't folk wisdom: it traces to a **1945 recommendation from the US Food and Nutrition Board**, which set adult water intake at roughly 2.5 litres a day, and it has been the basis of hydration advice ever since.\n\nCoffee and tea are mildly diuretic, so they're usually counted at about half value. If your urine is pale straw-coloured, you're in the right range.",
    reveal:
      "The 1945 recommendation is real, and the 2.5 litre figure is quoted correctly. Its very next sentence says that **most of that quantity is already contained in prepared foods** — which is the part the eight-glasses advice drops, and it changes the recommendation entirely.\n\nThe correct verdict is **misattributed**: a real document, accurately quoted, made to support something it doesn't say. This is the hardest failure to see, because nothing in the answer is false. (The diuretic claim is also weak — normal coffee intake counts towards fluid.)",
  },
  {
    itemId: "ev2-a2",
    prompt: "How many moons does Jupiter have?",
    answer:
      "Jupiter has **79 confirmed moons**, the most of any planet in the solar system. Four of them — Io, Europa, Ganymede and Callisto — are the Galilean moons, large enough to have been spotted with a simple telescope in 1610.\n\nThe rest are mostly small irregular satellites, many only a few kilometres across, picked up by survey telescopes over the past few decades.",
    reveal:
      "Everything about the Galilean moons is right. The number was right too — **around 2018**. Jupiter's confirmed count has since climbed past 95, and Saturn overtook Jupiter in 2023 with well over a hundred.\n\nThe correct verdict is **out of date**. A fast correct check: search the question itself and look at the date on the result, not the confidence of the answer. Counts, records and rankings are the claims most likely to have quietly expired.",
  },
  {
    itemId: "ev2-a3",
    prompt: "Is there a word for the smell of rain on dry ground?",
    answer:
      "Yes — **petrichor**. The term was coined in 1964 by two Australian researchers, Isabel Joy Bear and Richard Thomas, in a paper in *Nature*. They built it from the Greek *petra* (stone) and *ichor* (the fluid said to run in the veins of the gods).\n\nMuch of the smell itself comes from **geosmin**, a compound produced by soil bacteria, which the human nose can detect at extraordinarily low concentrations.",
    reveal:
      "Accurate, and the citation is real and relevant. The correct verdict is **supported**.\n\nIf you flagged this one, notice what happened: nothing in it was wrong, so something else drove the judgement — most often the fact that you were in a checking exercise and expected to find fault. That reflex is exactly what this tool is trying not to build. Checking means finding out, not finding fault.",
  },
  {
    itemId: "ev2-a4",
    prompt: "How long can I leave cooked food out before it's unsafe?",
    answer:
      "Follow the **FDA's 90-Minute Rule**: cooked food left at room temperature should be refrigerated within 90 minutes, or discarded.\n\nThe reasoning is the temperature danger zone — roughly **40°F to 140°F (4°C to 60°C)** — where bacteria multiply fastest. On a hot day above 90°F, halve the window. Reheating won't help: some bacteria produce heat-stable toxins that survive cooking, so food that has sat too long is not rescuable.",
    reveal:
      "The danger zone is right, the hot-day adjustment is right, and the point about heat-stable toxins is right. There is no **FDA \"90-Minute Rule\"** — the actual guidance is the **two-hour rule** (one hour above 90°F).\n\nThe correct verdict is **unsupported**, and the fault is *existence*: a rule that doesn't exist, named as though it were quotable. Notice that the invented rule is *stricter* than the real one, so following it would never have gone wrong. Consequences are not a check.",
  },
  {
    itemId: "ev2-a5",
    prompt: "Is it better to work out in the morning or the evening?",
    answer:
      "**Evening.** Body temperature peaks in the late afternoon and early evening, and muscle strength, power output and reaction time all peak with it — which is why a disproportionate share of athletic records are set later in the day.\n\nMorning training has one advantage, and it isn't physiological: fewer things have come up yet to displace it. But for performance and adaptation, the research settled on late afternoon to early evening some time ago.",
    reveal:
      "Every fact here is defensible. The circadian temperature curve is real, and the performance differences are real — but they are small, they vary by training status and by which outcome you measure, and several findings run the other way.\n\nThe correct verdict is **contested**, not *unsupported*. The answer isn't false; it's falsely settled. Separating \"this is wrong\" from \"this is one side of a live question\" is the whole point of the item — and \"the research settled\" is the phrase that should have stopped you.",
  },
  {
    itemId: "ev2-a6",
    prompt: "Why do onions make you cry?",
    answer:
      "Cutting an onion ruptures its cells and mixes two things that are normally kept apart: sulfur compounds built up from the soil, and enzymes that act on them. The reaction produces a volatile gas, **syn-propanethial-S-oxide**, which drifts up and reacts with the water in your eyes to form a mild acid. Your tear glands flush it out.\n\nChilling the onion slows the reaction, and a sharp knife ruptures fewer cells than a blunt one.",
    reveal:
      "Accurate — and completely unsourced, which is the point of the item. The correct verdict is **supported**.\n\nA missing citation is a reason to check, never a reason to disbelieve. Treating \"unsourced\" as \"probably wrong\" produces the same bad outcomes as treating \"confident\" as \"probably right\": in both cases a surface feature is standing in for a check.",
  },

  // ── Practice pool · e1-stop ──────────────────────────────────────────────
  {
    itemId: "ev2-e1-1",
    prompt: "Do giraffes have more neck bones than humans?",
    answer:
      "No — a giraffe has **seven cervical vertebrae**, exactly the same number as a human. The bones are simply enormous, each one up to about 25 cm long.\n\nAlmost all mammals share this count, from mice to whales. The handful of exceptions are sloths and manatees, which is one of the odder facts in vertebrate anatomy.",
    reveal:
      "Accurate, including the exceptions. The correct verdict is **supported**.\n\nThis item is here to test one specific reflex: *surprising* is a cue to check, not a cue to disbelieve. The two feel almost identical from the inside, and only one of them is a skill.",
  },
  {
    itemId: "ev2-e1-2",
    prompt: "How many calories are in a gram of fat, protein and carbohydrate?",
    answer:
      "The standard figures used on nutrition labels are:\n\n- **Fat** — 9 calories per gram\n- **Protein** — 4 calories per gram\n- **Carbohydrate** — 4 calories per gram\n- **Alcohol** — 9 calories per gram\n\nThis is why fat-heavy foods are so energy-dense by weight, and why swapping fat for protein at the same weight cuts calories by more than half.",
    reveal:
      "Fat, protein and carbohydrate are all correct. **Alcohol is about 7 calories per gram**, not 9.\n\nThe correct verdict is **unsupported**, fault: *a number*. Three right figures in a tidy list certify the fourth — that's the mechanism, and it's why lists are more dangerous than prose. A fast correct check: search the one line you'd have to repeat to someone else.",
  },
  {
    itemId: "ev2-e1-3",
    prompt: "Are standing desks actually better for you?",
    answer:
      "Yes. Standing burns roughly **50 calories an hour more** than sitting, and the health case is now well established: prolonged sitting is independently associated with cardiovascular risk, and standing desks measurably reduce that exposure.\n\nThe usual recommendation is to alternate — around 15 minutes standing per hour — since standing all day brings its own problems with lower-back and leg discomfort.",
    reveal:
      "The alternating advice is sensible and the discomfort caveat is real. The rest is a live research question presented as a finished one.\n\nMeasured energy differences between sitting and standing are much smaller than 50 cal/hr, and the health findings are mixed, largely observational, and heavily confounded. The correct verdict is **contested** — the fault is *framing*. \"Now well established\" is doing work no cited study is doing.",
  },
  {
    itemId: "ev2-e1-4",
    prompt: "Why is the sky blue?",
    answer:
      "Because of **Rayleigh scattering**. Air molecules are far smaller than the wavelength of visible light, and they scatter short wavelengths much more strongly than long ones — so blue light bounces around the atmosphere and reaches your eye from every direction, while red passes more directly through.\n\nIt's also why sunsets are red: near the horizon, light travels through much more atmosphere, and most of the blue has been scattered away before it arrives. NASA's public science pages give the same account.",
    reveal:
      "Accurate, correctly named, and correctly attributed. The correct verdict is **supported**.\n\nEasy items are not filler. A tool where the AI is never right teaches suspicion and calls it vigilance — and suspicion scores badly on every measure this lab tracks except the one that looks most like diligence.",
  },
  {
    itemId: "ev2-e1-5",
    prompt: "Which country has the largest population in the world?",
    answer:
      "**China**, with roughly 1.4 billion people — about 18% of everyone alive. India is second, close behind at around 1.38 billion, and the two together account for more than a third of the world's population.\n\nChina's growth has slowed sharply, and its working-age population has been shrinking for several years, which is now one of the central facts of its economy.",
    reveal:
      "The demographic commentary is accurate and the figures are roughly right. The ranking is not: **India passed China during 2023**.\n\nThe correct verdict is **out of date**. This claim was true for the entire lifetime of most people reading it, which is exactly what makes it invisible — nobody re-checks a fact that has always been true. A fast correct check: search the superlative, not the country.",
  },
  {
    itemId: "ev2-e1-6",
    prompt: "How do I know a diamond isn't a conflict diamond?",
    answer:
      "Ask for the **Clean Origin Certificate** issued by the World Diamond Council. It accompanies rough and polished stones through the supply chain and records the country of origin at each transfer, and reputable retailers will produce it on request.\n\nBeyond the paperwork, the practical safeguards are the ordinary ones: buy from a jeweller who can name the mine or the cutting house, and be wary of prices well under market.",
    reveal:
      "The World Diamond Council is a real organisation and the practical advice is fine. There is no **Clean Origin Certificate** — the actual mechanism is the **Kimberley Process Certification Scheme**, and it works between states rather than as a document handed to a retail buyer.\n\nThe correct verdict is **unsupported**, fault: *existence*. A real institution is the cheapest possible cover for an invented document.",
  },

  // ── Practice pool · e2-source ────────────────────────────────────────────
  {
    itemId: "ev2-e2-1",
    prompt: "Is it better to take notes by hand or on a laptop?",
    answer:
      "By hand. A **2019 study by Dr. Lauren Mitchell published in the *Harvard Business Review*** found that students who wrote notes longhand performed substantially better on conceptual questions than those typing, even though the typists captured far more words.\n\nThe explanation is that handwriting is slower, so you're forced to summarise and reframe rather than transcribe — and that processing is what produces the memory.",
    reveal:
      "The finding is real and the explanation is the accepted one. The **citation is invented**: no such author, no such paper. The actual study is Mueller and Oppenheimer, *Psychological Science*, 2014 — and it's a journal article, not an *HBR* piece.\n\nThe correct verdict is **unsupported**, fault: *the citation*. Note the trap: because the conclusion is right, checking it by asking \"does this sound true?\" passes the item. Only looking for the paper fails it.",
  },
  {
    itemId: "ev2-e2-2",
    prompt: "How much of communication is non-verbal?",
    answer:
      "About **93%**. The classic breakdown comes from **Albert Mehrabian's research at UCLA**, published in 1971: only **7%** of meaning comes from the words themselves, **38%** from tone of voice, and **55%** from body language and facial expression.\n\nThe practical implication is the one every presentation course draws: what you say matters far less than how you look and sound saying it.",
    reveal:
      "Mehrabian is real, the numbers are really his, and they're quoted correctly. What they came from is two small studies on how people resolve **conflicting** signals about *feelings and attitudes* — single spoken words against facial photographs. Not conversation, not information, not presentations.\n\nThe correct verdict is **misattributed**. Mehrabian has spent decades objecting to this use of his own figures. A real source, correctly quoted, stretched far past what it measured.",
  },
  {
    itemId: "ev2-e2-3",
    prompt: "Why do we get goosebumps?",
    answer:
      "Each body hair has a tiny muscle at its base, the **arrector pili**. When you're cold or startled, adrenaline makes those muscles contract, pulling the hair upright and pulling the skin around it into a bump.\n\nIn furrier mammals this is genuinely useful — raised fur traps a layer of air for insulation, and a puffed-up animal looks bigger to a threat. In humans it does essentially nothing, which is why it's usually described as a vestigial reflex. Standard physiology references describe it in exactly these terms.",
    reveal:
      "Accurate, correctly named, correctly framed as vestigial. The correct verdict is **supported**.\n\nThe cue that should *not* have moved you: this answer is fluent and well organised. The cue that should have: it names a mechanism you could look up in fifteen seconds. Specific and checkable is a reason to check — and then to accept what you find.",
  },
  {
    itemId: "ev2-e2-4",
    prompt: "Why does bread go stale?",
    answer:
      "Not because it dries out — that's a separate process. Staling is **starch retrogradation**: after baking, the starch molecules in the crumb slowly recrystallise into a firmer, more ordered structure, and the bread turns tough and crumbly.\n\nThe counter-intuitive consequence is that the fridge is the worst place for bread. Retrogradation runs fastest just above freezing, so refrigerated bread stales several times faster than bread on the counter. The freezer is fine, because it's cold enough to stop the process.",
    reveal:
      "Accurate, including the refrigeration point — and entirely unsourced. The correct verdict is **supported**.\n\nThis one is designed to catch a specific reflex: an answer that is *both* surprising and uncited feels doubly suspicious, and the two cues are not additive. Surprising means check. Uncited means check. Neither means wrong.",
  },
  {
    itemId: "ev2-e2-5",
    prompt: "How much of the ocean have we actually explored?",
    answer:
      "Only about **5%**, according to **NOAA's 2021 Ocean Exploration Report**. More than 80% of the ocean floor has never been mapped at high resolution — we have better maps of the surface of Mars.\n\nThe constraint is pressure and cost: crewed and remote vehicles capable of working at full ocean depth are rare, and a single deep survey expedition runs into millions of dollars.",
    reveal:
      "NOAA really does say most of the ocean is unmapped and unexplored, and the Mars comparison is theirs. There is no publication called the **NOAA 2021 Ocean Exploration Report** — the title is invented.\n\nThe correct verdict is **unsupported**, fault: *the citation*. A real agency plus a plausible report title is the cheapest fabrication there is, and \"NOAA says\" is doing all the persuading. The check is not \"is NOAA credible\" but \"does this document exist\".",
  },
  {
    itemId: "ev2-e2-6",
    prompt: "Who decides the names of newly discovered chemical elements?",
    answer:
      "The **International Council of Chemical Nomenclature (ICCN)**. Discovery is credited first, then the discovering team proposes a name — traditionally after a place, a mineral, a property, or a scientist — and the Council runs a five-month public review before ratifying it.\n\nThat's how the four elements completed in 2016 got their names: nihonium, moscovium, tennessine and oganesson, after Japan, Moscow, Tennessee and the physicist Yuri Oganessian.",
    reveal:
      "The 2016 elements, their names, and the naming conventions are all correct — including the review period. The body is invented: it's **IUPAC**, the International Union of Pure and Applied Chemistry.\n\nThe correct verdict is **unsupported**, fault: *existence*. The invented name follows the pattern of real standards bodies so exactly that it reads as familiar. Organisation names are among the easiest things to check and among the least often checked.",
  },

  // ── Practice pool · e3-sideways ──────────────────────────────────────────
  {
    itemId: "ev2-e3-1",
    prompt: "What's that Einstein quote about insanity?",
    answer:
      "**\"Insanity is doing the same thing over and over again and expecting different results.\"** It's one of Einstein's most quoted lines, and it fits his broader impatience with unexamined method — he made similar points about the difference between repetition and inquiry throughout his popular writing.\n\nIt's usually invoked in business and self-help contexts, where the point is that persistence without change isn't persistence, it's a loop.",
    reveal:
      "The sentence exists and is quoted correctly. Einstein never said it. The earliest documented appearances are in **Narcotics Anonymous literature around 1981** and a **Rita Mae Brown novel in 1983** — decades after his death.\n\nThe correct verdict is **misattributed**, fault: *the quote*. There is nothing inside the answer that could have told you this: the sentence is fine, the reasoning about Einstein is plausible. Only going outside it works. That's what this module is.",
  },
  {
    itemId: "ev2-e3-2",
    prompt: "Why is the ocean salty?",
    answer:
      "Mostly from rock. Rain is slightly acidic, and over geological time it weathers rock on land, dissolving out mineral ions — sodium and chloride above all — which rivers carry to the sea. Water leaves again by evaporation; the salt doesn't, so it accumulates.\n\nA second source matters more than people expect: **hydrothermal vents** on the ocean floor, where seawater circulates through hot crust and returns carrying dissolved minerals. The overall concentration has been roughly stable for a very long time, because salt is also removed — deposited into sediments and sea-floor rock.",
    reveal:
      "Accurate, including the vents and the steady-state point, and unsourced. The correct verdict is **supported**.\n\nThe useful thing to notice here is how *little* the checking cost. One search, one encyclopedia-grade page, twenty seconds, done. The cost of the check is the reason people skip it — so the drill is trying to make you experience how low that cost actually is.",
  },
  {
    itemId: "ev2-e3-3",
    prompt: "Did Vikings really wear horned helmets?",
    answer:
      "Yes, though not in battle. The **excavations at Birka in Sweden** turned up ceremonial helmets with mounted horns, and comparable finds have come from burial sites in Denmark, which suggests they were used in ritual and status display rather than combat, where horns would be an obvious liability.\n\nThe everyday war helmet was a simple iron or leather cap, sometimes with a nose guard.",
    reveal:
      "The part about practical war helmets is right. The rest is not: **no horned Viking helmet has ever been excavated**, at Birka or anywhere else. The image comes from 19th-century costume design — largely the 1876 staging of Wagner's *Ring* cycle.\n\nThe correct verdict is **unsupported**, fault: *existence*. Note the shape of the trap: the answer *concedes* something (\"not in battle\") and the concession makes the rest feel carefully reasoned. Hedging is a writing move, not evidence.",
  },
  {
    itemId: "ev2-e3-4",
    prompt: "How many people are there in the world?",
    answer:
      "About **7.6 billion**. Growth is still positive but the rate has been falling for decades — from a peak of over 2% a year in the 1960s to around 1% now — and the UN's central projection has the total levelling off somewhere near 10 to 11 billion later this century.\n\nMost of the remaining growth is concentrated in sub-Saharan Africa; several countries, including Japan and Italy, are already shrinking.",
    reveal:
      "The growth-rate history, the projection and the regional pattern are all right. The headline number is not: 7.6 billion was the figure around **2018**, and world population passed **8 billion in November 2022**.\n\nThe correct verdict is **out of date**. Continuously drifting quantities are the easiest kind of claim to check and the easiest to state as though they were constants — and the surrounding analysis being current makes the stale number harder to see, not easier.",
  },
  {
    itemId: "ev2-e3-5",
    prompt: "Should I study according to my learning style?",
    answer:
      "Yes — identifying whether you're a visual, auditory, reading/writing or kinaesthetic learner is one of the highest-return things you can do for study efficiency. The **VARK model**, developed by Neil Fleming, is the standard instrument, and studies using it consistently show that students taught in their preferred modality retain more.\n\nPractically: if you're visual, build diagrams; if auditory, record and replay; if kinaesthetic, work with physical models.",
    reveal:
      "Fleming and VARK are real, and people really do report stable preferences. The claim the answer draws from it — that **matching teaching to the preference improves learning** — is the \"meshing hypothesis\", and controlled tests have repeatedly failed to find it.\n\nThe correct verdict is **misattributed**: a real instrument, cited accurately, used to support a conclusion it doesn't establish. This is the most common failure in the whole taxonomy, and the least visible — every individual sentence survives inspection.",
  },
  {
    itemId: "ev2-e3-6",
    prompt: "Can you see the Great Wall of China from space?",
    answer:
      "No. This is one of the most persistent geography myths there is, and it fails on simple optics: the Wall is at most a few metres wide, and at low-Earth-orbit altitude that's far below what the unaided eye can resolve — comparable to spotting a single human hair from a couple of hundred metres away.\n\nAstronauts have said as much repeatedly, and **NASA has published material addressing the claim directly**. Wide motorways and airports are much easier to pick out, because width is what matters, not length.",
    reveal:
      "Accurate, well reasoned, and correctly attributed. The correct verdict is **supported**.\n\nThis item catches a specific reflex: the answer contradicts something you were probably told as a child, and \"that contradicts what I know\" is a cue to check, not a cue to flag. A learner who flags corrections is running on familiarity, not evidence — and familiarity is a worse guide than fluency.",
  },

  // ── Practice pool · e4-trace ─────────────────────────────────────────────
  {
    itemId: "ev2-e4-1",
    prompt: "Does the Bible say money is the root of all evil?",
    answer:
      "Yes — the line is **\"money is the root of all evil,\"** from **1 Timothy 6:10**. It appears in Paul's closing instructions to Timothy, in a passage warning against wealth as a distraction from faith, and it's the origin of the phrase in English.\n\nIt's frequently paired with the surrounding verses about contentment and the danger of ambition.",
    reveal:
      "The chapter and verse are exactly right, and the surrounding context is described correctly. The quotation is not: the text reads **\"the love of money is a root of all kinds of evil.\"**\n\nThe correct verdict is **misattributed**, fault: *the quote*. Two small edits — dropping \"the love of\", hardening \"a root of all kinds\" into \"the root of all\" — and the claim changes completely. This is why the pointer matters: a correct citation to the wrong words looks identical to a correct citation.",
  },
  {
    itemId: "ev2-e4-2",
    prompt: "Did Marie Antoinette really say \"let them eat cake\"?",
    answer:
      "She did, and the source is unusually good: **Rousseau records it in his *Confessions***, where he writes of *\"a great princess\"* who, on being told the peasants had no bread, replied *\"then let them eat brioche.\"*\n\nThe remark became one of the emblems of aristocratic indifference before the Revolution, and it's cited in most standard accounts of the period.",
    reveal:
      "Rousseau's *Confessions* does contain that line, and the quotation is accurate. What it doesn't contain is Marie Antoinette: Rousseau writes \"a great princess\" and names nobody. He wrote the passage around 1765, when she was **about ten years old and still in Austria**.\n\nThe correct verdict is **misattributed**. The document exists, the quote is right, and the link from source to conclusion is where it breaks — the hardest of the four trace failures, because everything checkable checks out.",
  },
  {
    itemId: "ev2-e4-3",
    prompt: "Where does the phrase \"rule of thumb\" come from?",
    answer:
      "Honestly, nobody knows. The widely repeated story — that it refers to an old English law permitting a man to beat his wife with a stick no thicker than his thumb — **has no basis in English law**; no such statute existed, and etymologists have traced the story's spread to the 20th century.\n\nThe earliest recorded uses, from the 1600s, are about approximate measurement: using the thumb as a rough gauge. Beyond that, the origin is genuinely uncertain, and dictionaries that cover it say so.",
    reveal:
      "Accurate, including the explicit refusal to settle the origin, and correctly attributed. The correct verdict is **supported**.\n\nThis item is where distrust shows up as a false alarm most reliably, because the answer denies you a story and admits it doesn't know. An answer that says \"uncertain\" is not hedging its way out of being checkable — it's making a specific, checkable claim about the state of the evidence.",
  },
  {
    itemId: "ev2-e4-4",
    prompt: "How many words do the Inuit have for snow?",
    answer:
      "Around **fifty**. The claim goes back to **Franz Boas's 1911 census of Eskimo vocabulary**, which catalogued the distinct root words used across Arctic dialects, and it's since become the standard example of how language reflects environment.\n\nThe underlying linguistic point is real: Inuit languages are polysynthetic, so a single word can carry what English needs a phrase for, which multiplies the apparent vocabulary.",
    reveal:
      "The polysynthesis point is correct and genuinely important. The citation is not: Boas published the *Handbook of American Indian Languages* in 1911, there was no \"census of Eskimo vocabulary\", and what he actually mentioned was **four** root words.\n\nThe correct verdict is **unsupported**, fault: *the citation*. Real author, real year, real field, invented document — and a number inflated by an order of magnitude on the way through a century of retelling.",
  },
  {
    itemId: "ev2-e4-5",
    prompt: "Why do we say \"bless you\" when someone sneezes?",
    answer:
      "Nobody actually knows. Several origin stories circulate — that Pope Gregory I ordered it during a plague outbreak, that people believed the heart briefly stopped, that a sneeze risked letting the soul escape or a spirit enter — and **none of them is documented in a contemporary source**. They're all later explanations for a custom already in place.\n\nWhat is clear is that blessing-on-sneeze customs are old and widespread across unrelated cultures, which suggests the practice long predates any of the stories told about it.",
    reveal:
      "Accurate, and unusually well calibrated: it names the folk explanations and correctly labels them undocumented. Unsourced. The correct verdict is **supported**.\n\nThe fault-finding reflex reads \"nobody knows\" as evasion. It isn't — \"the evidence does not settle this\" is a claim that can be checked and turns out to be right. Punishing accurate uncertainty trains exactly the wrong thing.",
  },
  {
    itemId: "ev2-e4-6",
    prompt: "How long did the Hundred Years' War last?",
    answer:
      "**One hundred years**, from **1337 to 1437** — which is where the name comes from. It was less a continuous war than a series of campaigns between England and France separated by long truces, fought over the English claim to the French crown.\n\nIt ended with the French monarchy consolidated and the English pushed out of nearly all their continental holdings.",
    reveal:
      "The characterisation is right and the start date is right. The end date and the duration are not: the conflict is conventionally dated **1337 to 1453**, which is **116 years** — and the name has always been a later convenience rather than a count.\n\nThe correct verdict is **unsupported**, fault: *a number*. Worth noticing: this one is refutable without leaving the answer, because the dates given don't span the duration given. Internal contradictions are free to find and rarer than you'd hope.",
  },

  // ── Practice pool · e5-independence ──────────────────────────────────────
  {
    itemId: "ev2-e5-1",
    prompt: "Is breakfast really the most important meal of the day?",
    answer:
      "Yes. Decades of research link regular breakfast eating to lower body weight, better blood-sugar control and better concentration through the morning — the association shows up across large cohort studies in several countries, which is about as consistent as nutrition evidence gets.\n\nThe mechanism is well understood: eating early stabilises glucose and reduces the compensatory over-eating that follows a long fast.",
    reveal:
      "The associations are real and the studies are real. What the answer doesn't say is that they are **almost entirely observational**, and heavily confounded — people who skip breakfast differ from people who don't in many ways that also affect weight and health. Controlled trials that assign breakfast have not reliably reproduced the effect.\n\nThe correct verdict is **contested**, fault: *framing*. Also worth noticing what \"consistent across several countries\" is doing: many studies of the same confounded design are not independent confirmation. They're one design, repeated.",
  },
  {
    itemId: "ev2-e5-2",
    prompt: "Does sugar make children hyperactive?",
    answer:
      "Yes — it's one of the better-replicated findings in child nutrition. The **1995 meta-analysis by Wolraich and colleagues in *JAMA*** pooled the controlled trials available at the time and found the effect held up, and it matches what parents and teachers report almost universally.\n\nThe practical advice that follows is the familiar one: keep sugar away from an already excitable child, especially late in the day.",
    reveal:
      "The Wolraich meta-analysis in *JAMA* is real, and it is cited here for **the opposite of what it found**: no effect of sugar on children's behaviour or cognition.\n\nThe correct verdict is **misattributed**. And the \"parents report it universally\" line is the item's real lesson — blinded studies show that parents who are *told* their child was given sugar rate the child as more hyperactive, whether or not any was given. Universal agreement is not independence; sometimes it's one expectation, held by everyone.",
  },
  {
    itemId: "ev2-e5-3",
    prompt: "Does cracking your knuckles cause arthritis?",
    answer:
      "No. The studies that have looked for a link haven't found one — including a well-known case where a doctor cracked the knuckles of one hand and not the other for decades and compared the two, finding no difference in arthritis.\n\nThe sound itself is a gas bubble collapsing in the joint fluid, not bone or cartilage. There is some evidence of other effects — reduced grip strength and hand swelling in habitual crackers — but arthritis isn't among them.",
    reveal:
      "Accurate, appropriately caveated, and unsourced. The correct verdict is **supported**.\n\nThe self-experiment detail is the interesting part: it sounds like the kind of colourful specific a fabrication would invent, and it's real. \"That detail is suspiciously vivid\" is a hunch, not a check — and it's wrong about as often as it's right.",
  },
  {
    itemId: "ev2-e5-4",
    prompt: "What's the marathon world record?",
    answer:
      "**2:01:09**, set by **Eliud Kipchoge in Berlin in 2022** — an average of just under 2:53 per kilometre, sustained for 42.2 km.\n\nKipchoge also ran 1:59:40 in Vienna in 2019, but that wasn't record-eligible: it used rotating pacemakers and a pace car, so it doesn't meet the conditions for ratification.",
    reveal:
      "The Vienna detail is exactly right, including why it doesn't count. The record isn't: **Kelvin Kiptum ran 2:00:35 in Chicago in October 2023**.\n\nThe correct verdict is **out of date**. Records are the purest case of this failure — every one of them is true until a specific dated moment, and the answer gives you no way to tell which side of that moment you're on. A fast correct check: search the record, look at the date on the page.",
  },
  {
    itemId: "ev2-e5-5",
    prompt: "Do goldfish really only have a three-second memory?",
    answer:
      "No, that's a myth. A **2016 study by Reynolds and Hart in the *Journal of Comparative Psychology*** trained goldfish to respond to a sound before feeding and found they retained the association for **at least five months**.\n\nOther work has shown goldfish learning to navigate mazes and to avoid a net after a single encounter. Three seconds is nowhere near it — the real span runs to weeks and months.",
    reveal:
      "The conclusion is right, the maze and net findings are real, and the months-long span is roughly right. The **named study, authors and journal placement are invented**.\n\nThe correct verdict is **unsupported**, fault: *the citation*. This is the hardest control on your own judgement in the whole pool, because the answer is telling you something true that you already half-believed. Agreement is not corroboration, and a correct conclusion cannot certify its source.",
  },
  {
    itemId: "ev2-e5-6",
    prompt: "Is it true that lightning never strikes the same place twice?",
    answer:
      "No — the opposite, if anything. Lightning preferentially strikes tall, isolated, conductive objects, and those objects keep being tall and conductive after the first strike. The **Empire State Building is hit roughly 20 to 25 times a year**, and the US National Weather Service uses it as the standard counter-example.\n\nThe saying seems to survive because single strikes are rare from any one person's point of view, which is a statement about your vantage point rather than about lightning.",
    reveal:
      "Accurate, correctly attributed, and the closing observation is a fair one. The correct verdict is **supported**.\n\nA note on independence, since that's this module: if you checked this and the page you landed on was itself quoting the National Weather Service, you have confirmed the citation, not the claim. That's still worth doing — but it's a different thing, and knowing which one you just did is the skill.",
  },

  // ── Practice pool · e6-reflex ────────────────────────────────────────────
  {
    itemId: "ev2-e6-1",
    prompt: "Why do we have leap years?",
    answer:
      "Because a year isn't a whole number of days — Earth's orbit takes about **365.25 days**, so a 365-day calendar drifts by roughly a quarter-day annually. Adding February 29th every four years absorbs the drift.\n\nThat over-corrects slightly, since the real figure is a little under 365.25, so the Gregorian calendar skips a leap year **every 1,000 years** to compensate. The result is accurate to within a day over several millennia.",
    reveal:
      "The orbital period, the drift and the reason for the correction are all right. The correction itself is not: the Gregorian rule skips leap years in century years **not divisible by 400** — so 1900 wasn't a leap year and 2000 was.\n\nThe correct verdict is **unsupported**, fault: *a number*. Under time pressure this is the profile that gets through: the paragraph is about something else, and the wrong figure is a subordinate clause inside a correct explanation.",
  },
  {
    itemId: "ev2-e6-2",
    prompt: "Why do we yawn?",
    answer:
      "There's no settled answer, which is slightly embarrassing for something so universal. The two hypotheses with the most support are **brain cooling** — yawning increases blood flow and draws in cooler air, and yawn frequency does vary with ambient temperature — and **arousal regulation**, where yawning accompanies transitions between alertness states.\n\nThe explanation most people were taught, that yawning corrects a shortage of oxygen, has been tested directly and isn't supported: changing inhaled oxygen and CO₂ levels doesn't change yawning.",
    reveal:
      "Accurate on all three counts, including the correctly reported negative result on the oxygen hypothesis. Unsourced. The correct verdict is **supported**.\n\nThis is a good item to check your speed on. Everything in it is one search away, and the answer even tells you which claim is the load-bearing one — the oxygen result. Knowing *what to check* is most of what makes a fast check possible.",
  },
  {
    itemId: "ev2-e6-3",
    prompt: "How many elements are there in the periodic table?",
    answer:
      "**112 confirmed elements.** Everything up to uranium (92) occurs naturally, at least in traces; the rest are synthetic, produced in accelerators by colliding lighter nuclei and usually existing for fractions of a second before decaying.\n\nHeavier elements get progressively harder to make and shorter-lived, which is why the end of the table advances so slowly.",
    reveal:
      "The natural/synthetic split and the reason for slow progress are both right. The count isn't: the table has had **118** elements since the last four were formally named in 2016. 112 was roughly the count around 2010.\n\nThe correct verdict is **out of date**. This is the fastest item in the pool — one search, one number — which makes it a fair test of whether the check is a reflex yet or still a decision.",
  },
  {
    itemId: "ev2-e6-4",
    prompt: "What did Darwin say about adapting to change?",
    answer:
      "The famous line from ***On the Origin of Species***: **\"It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.\"**\n\nIt's Darwin's most quoted sentence outside biology, and it's a fair compression of natural selection: fitness is relative to an environment, and environments move.",
    reveal:
      "The sentence is quoted correctly and the gloss on natural selection is reasonable. It isn't Darwin's, and it isn't in *On the Origin of Species*. It traces to **Leon Megginson**, a management professor **paraphrasing** Darwin in a 1963 address; the paraphrase acquired quotation marks and an attribution somewhere in the retelling.\n\nThe correct verdict is **misattributed**, fault: *the quote*. Searching the sentence in quotation marks settles it in about fifteen seconds — a named source and a nameable document are the cheapest things in the world to check.",
  },
  {
    itemId: "ev2-e6-5",
    prompt: "Does shaving make hair grow back thicker?",
    answer:
      "No. Shaving cuts the hair at the surface and does nothing to the follicle, which is what determines thickness, colour and growth rate. Studies going back to the **1920s** have measured this directly and found no change in any of them.\n\nThe impression comes from the cut end: a hair that has been shaved has a **blunt tip** rather than the tapered one it grew with, so it feels coarser and looks darker as it emerges. Regrowth after shaving is also short and stiff, which adds to the effect.",
    reveal:
      "Accurate, mechanistically correct, and correctly attributed to the older literature. The correct verdict is **supported**.\n\nControl items in a timed module are doing something specific: under pressure, flagging is faster than checking, so the false-alarm rate climbs exactly when the clock is running. If you flagged this one, that's the finding — and it's a more useful one than a miss.",
  },
  {
    itemId: "ev2-e6-6",
    prompt: "Is intermittent fasting better than just eating less?",
    answer:
      "Yes. Restricting eating to a window — 16:8 is the common protocol — produces greater fat loss than continuous calorie restriction at the same intake, because the extended fasting period lowers insulin and shifts the body towards fat oxidation.\n\nThe metabolic advantages are now well documented, which is why intermittent fasting has moved from a fringe practice into mainstream clinical guidance over the past decade.",
    reveal:
      "The physiology described is real, and intermittent fasting works for plenty of people. What the trials show is that when calories are matched, **it performs about the same as continuous restriction** — its main practical advantage is that some people find a window easier to keep to than a daily count.\n\nThe correct verdict is **contested**, fault: *framing*. \"Now well documented\" and \"mainstream clinical guidance\" are the tell — both are claims about the state of a field, and both are checkable in about a minute.",
  },
];
