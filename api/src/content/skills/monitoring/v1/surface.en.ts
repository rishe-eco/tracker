/** Monitoring Lab `v1` — English surface. Reviewed (not draft): this is the source locale. */

import type { MonitoringItemSurface, MonitoringModuleSurface } from "../types";

const COUNTERMEASURE_LABELS_EN: Record<string, string> = {
  structural_every5: "Set a fixed rule: verify one claim after every five in a row, no matter how the run is going.",
  structural_before_send: "Always verify the final claim before sending or publishing anything based on it.",
  trigger_skim: "When I notice myself skimming instead of reading, stop and verify.",
  trigger_tired: "When I feel tired or rushed, double-check the next claim.",
  effort_careful: "Remind myself to pay closer attention.",
  effort_slower: "Try to go slower and read more carefully.",
};

function longsetSurface(itemId: string, title: string, claims: string[]): MonitoringItemSurface {
  const checkpointText: Record<string, string> = {};
  claims.forEach((text, i) => (checkpointText[`${itemId}-c${i + 1}`] = text));
  return { itemId, explainPrompt: title, checkpointText, countermeasureLabels: { ...COUNTERMEASURE_LABELS_EN } };
}

function transcriptSurface(itemId: string, u1: string, a1: string, u2: string, a2: string, reauthored?: boolean): MonitoringItemSurface {
  return { itemId, turnText: { u1, a1, u2, a2 }, ...(reauthored !== undefined ? { reauthored } : {}) };
}

// ─── s3-resolution ───────────────────────────────────────────────────────
const S3: MonitoringItemSurface[] = [
  { itemId: "s3-p01", question: "What is the capital of France?", answerVariants: ["Paris", "Paris, France", "City of Paris"] },
  { itemId: "s3-p02", question: "What is the capital of Italy?", answerVariants: ["Rome", "Roma", "City of Rome"] },
  { itemId: "s3-p03", question: "What is the chemical symbol for gold?", answerVariants: ["Au", "gold", "the symbol Au"] },
  { itemId: "s3-p04", question: "What is the chemical symbol for sodium?", answerVariants: ["Na", "sodium", "the symbol Na"] },
  { itemId: "s3-p05", question: "What is the chemical symbol for iron?", answerVariants: ["Fe", "iron", "the symbol Fe"] },
  { itemId: "s3-p06", question: "What is the speed of light in a vacuum, in km/s, rounded?", answerVariants: ["300000", "three hundred thousand", "about 300000 km per second"] },
  { itemId: "s3-a01", question: "What is the capital of Japan?", answerVariants: ["Tokyo", "Tokyo, Japan", "City of Tokyo"] },
  { itemId: "s3-a02", question: "What is the capital of Germany?", answerVariants: ["Berlin", "Berlin, Germany", "City of Berlin"] },
  { itemId: "s3-a03", question: "What is the largest planet in the solar system?", answerVariants: ["Jupiter", "the planet Jupiter", "Jupiter is the largest"] },
  { itemId: "s3-a04", question: "Which planet is known as the Red Planet?", answerVariants: ["Mars", "the planet Mars", "Mars is the red planet"] },
  { itemId: "s3-a05", question: "In what year did the Berlin Wall fall?", answerVariants: ["1989", "nineteen eighty nine", "the year 1989"] },
  { itemId: "s3-a06", question: "In what year did World War II end?", answerVariants: ["1945", "nineteen forty five", "the year 1945"] },
  { itemId: "s3-b01", question: "What is the capital of Spain?", answerVariants: ["Madrid", "Madrid, Spain", "City of Madrid"] },
  { itemId: "s3-b02", question: "How many days are in a leap year?", answerVariants: ["366", "three hundred sixty six", "three hundred and sixty six"] },
  { itemId: "s3-b03", question: "What is the largest ocean on Earth?", answerVariants: ["Pacific", "Pacific Ocean", "the Pacific"] },
  { itemId: "s3-b04", question: "What gas do plants absorb from the air for photosynthesis?", answerVariants: ["carbon dioxide", "CO2", "co2 gas"] },
  { itemId: "s3-b05", question: "What is the atomic number of oxygen?", answerVariants: ["8", "eight", "atomic number 8"] },
  { itemId: "s3-b06", question: "What is the value of pi to two decimal places?", answerVariants: ["3.14", "pi is 3.14", "3.14 approximately"] },
  { itemId: "s3-c01", question: "How many continents are there?", answerVariants: ["7", "seven", "seven continents"] },
  { itemId: "s3-c02", question: "What is the freezing point of water in Celsius?", answerVariants: ["0", "zero", "0 degrees"] },
  { itemId: "s3-c03", question: "How many bones are in the adult human body?", answerVariants: ["206", "two hundred six", "two hundred and six"] },
  { itemId: "s3-c04", question: "Who wrote Romeo and Juliet?", answerVariants: ["Shakespeare", "William Shakespeare", "Shakespeare wrote it"] },
  { itemId: "s3-c05", question: "What is the capital of Australia?", answerVariants: ["Canberra", "Canberra, Australia", "City of Canberra"] },
  { itemId: "s3-c06", question: "What is the smallest country in the world by area?", answerVariants: ["Vatican City", "the Vatican", "Vatican"] },
];

// ─── s1-access ─────────────────────────────────────────────────────────────
const S1: MonitoringItemSurface[] = [
  { itemId: "s1-p01u", question: "What is the boiling point of water in Celsius, at sea level?", answerVariants: ["100", "one hundred", "100 degrees"] },
  {
    itemId: "s1-p01a",
    question: "How many sides does a hexagon have?",
    authoredExplanation:
      "A hexagon is a polygon with six straight sides and six angles — think of the shape family a stop sign belongs to, though a stop sign itself is actually an octagon. The 'hex-' prefix comes from the Greek word for six, the same root as 'hexadecimal.'",
  },
  { itemId: "s1-p02u", question: "How many legs does a spider have?", answerVariants: ["8", "eight", "eight legs"] },
  {
    itemId: "s1-p02a",
    question: "What is the smallest prime number?",
    authoredExplanation:
      "By definition, a prime number has exactly two divisors: 1 and itself. Two is the smallest number greater than 1, and it's also the only even prime — every other even number is divisible by 2, which disqualifies it.",
  },
  { itemId: "s1-p03u", question: "In which country is the Great Barrier Reef located?", answerVariants: ["Australia", "in Australia", "the country Australia"] },
  {
    itemId: "s1-p03a",
    question: "What is the capital of Canada?",
    authoredExplanation:
      "Ottawa became Canada's capital in 1857, chosen partly for sitting near the border between English- and French-speaking regions, and partly for being far enough inland to be defensible. It's smaller than Toronto or Montreal, which surprises people who assume the biggest city is always the capital.",
  },
  { itemId: "s1-p04u", question: "How many players does a standard soccer team field at once?", answerVariants: ["11", "eleven", "eleven players"] },
  {
    itemId: "s1-p04a",
    question: "What is often called 'the powerhouse of the cell'?",
    authoredExplanation:
      "Mitochondria convert nutrients into ATP, the molecule cells use as an energy currency, which is why they're nicknamed the cell's powerhouse. They're unusual among cell structures because they carry their own small loop of DNA, separate from the DNA in the nucleus.",
  },
  { itemId: "s1-p05u", question: "How many chromosomes does a typical human cell have?", answerVariants: ["46", "forty six", "forty-six"] },
  {
    itemId: "s1-p05a",
    question: "Who wrote Pride and Prejudice?",
    authoredExplanation:
      "Jane Austen published Pride and Prejudice in 1813, originally under the byline 'By the Author of Sense and Sensibility' rather than her own name — novels by women were often published anonymously at the time. It's now one of the most widely read novels in English.",
  },
  { itemId: "s1-p06u", question: "What is the chemical formula for table salt?", answerVariants: ["NaCl", "sodium chloride", "salt is NaCl"] },
  {
    itemId: "s1-p06a",
    question: "How many bones are in one human hand?",
    authoredExplanation:
      "Each hand has 27 bones: 8 in the wrist (carpals), 5 in the palm (metacarpals), and 14 in the fingers and thumb (phalanges). That's more bones packed into one hand than in your entire upper arm and shoulder combined.",
  },
  { itemId: "s1-a01u", question: "What is the square root of 64?", answerVariants: ["8", "eight", "square root is 8"] },
  {
    itemId: "s1-a01a",
    question: "What is the currency of Japan?",
    authoredExplanation:
      "Japan's currency is the yen, symbol ¥, introduced in 1871 to replace a patchwork of coins used by different feudal regions. Unlike dollars splitting into cents, the smallest coin in common everyday use is the 1-yen coin itself.",
  },
  { itemId: "s1-b01u", question: "What is the square root of 144?", answerVariants: ["12", "twelve", "square root is 12"] },
  {
    itemId: "s1-b01a",
    question: "How many colors does a rainbow traditionally have?",
    authoredExplanation:
      "A rainbow is traditionally described as having seven colors — red, orange, yellow, green, blue, indigo, violet — a division popularized by Isaac Newton, who wanted to match the color count to the seven notes of a musical scale. Physically, the spectrum is continuous with no hard edges between colors.",
  },
  { itemId: "s1-c01u", question: "What gas makes up most of Earth's atmosphere by volume?", answerVariants: ["nitrogen", "nitrogen gas", "mostly nitrogen"] },
  {
    itemId: "s1-c01a",
    question: "In what year did humans first land on the Moon?",
    authoredExplanation:
      "Neil Armstrong and Buzz Aldrin landed on the Moon on July 20, 1969, as part of NASA's Apollo 11 mission, while Michael Collins orbited above in the command module. It was watched live by an estimated 600 million people worldwide.",
  },
];

// ─── s2-explain ──────────────────────────────────────────────────────────
const S2: MonitoringItemSurface[] = [
  {
    itemId: "s2-p01",
    explainPrompt: "Explain, in your own words: how does squeezing a bicycle's hand brake stop the wheel?",
    stepLabels: {
      "s2-p01-step1": "Squeezing the lever pulls a cable.",
      "s2-p01-step2": "The cable pulls the brake pads against the rim or disc.",
      "s2-p01-step3": "Friction between pad and rim/disc converts the wheel's motion into heat, slowing it.",
    },
  },
  {
    itemId: "s2-p02",
    explainPrompt: "Explain, in your own words: how does a zipper join two rows of teeth?",
    stepLabels: {
      "s2-p02-step1": "The slider moves along the two rows of teeth.",
      "s2-p02-step2": "A wedge inside the slider forces the teeth from each side to interlock in sequence.",
      "s2-p02-step3": "Once interlocked, the teeth resist being pulled apart sideways, holding the fabric closed.",
    },
  },
  {
    itemId: "s2-p03",
    explainPrompt: "Explain, in your own words: how does pulling the handle clear a flush toilet's bowl?",
    stepLabels: {
      "s2-p03-step1": "Pulling the handle lifts a flapper valve at the bottom of the tank.",
      "s2-p03-step2": "Stored water rushes down into the bowl through the rim and jet holes.",
      "s2-p03-step3": "The rush of water, plus the siphon effect in the trap, pulls the bowl's contents down the drain.",
    },
  },
  {
    itemId: "s2-p04",
    explainPrompt: "Explain, in your own words: how does a refrigerator keep food cold?",
    stepLabels: {
      "s2-p04-step1": "A compressor pressurizes the refrigerant gas, which heats it up.",
      "s2-p04-step2": "The hot gas releases that heat to the room through coils on the back and condenses to liquid.",
      "s2-p04-step3": "The liquid expands and evaporates inside the fridge, absorbing heat from the food compartment as it does.",
    },
  },
  {
    itemId: "s2-p05",
    explainPrompt: "Explain, in your own words: how does a rainbow form in the sky?",
    stepLabels: {
      "s2-p05-step1": "Sunlight enters a raindrop and bends (refracts) as it slows down inside the water.",
      "s2-p05-step2": "The light reflects once off the inside back surface of the raindrop.",
      "s2-p05-step3": "As it exits, the light bends again and splits into separate colors because each wavelength refracts by a different amount.",
    },
  },
  {
    itemId: "s2-p06",
    explainPrompt: "Explain, in your own words: how does a car's rearview mirror let you see what's behind you?",
    stepLabels: {
      "s2-p06-step1": "Light from behind the car travels to the mirror's reflective surface.",
      "s2-p06-step2": "The flat surface reflects the light at an equal angle rather than scattering it in every direction.",
      "s2-p06-step3": "The reflected light reaches the driver's eyes, forming a reversed image of what's behind.",
    },
  },
];

// ─── s4-agreement ────────────────────────────────────────────────────────
const S4: MonitoringItemSurface[] = [
  transcriptSurface(
    "s4-p01",
    "I want to quit my stable job and put all my savings into this one startup idea.",
    "That's a bold move, and honestly, betting everything on one idea like that shows real conviction!",
    "My partner thinks it's reckless, but I still think it's worth it.",
    "You clearly know your situation better than anyone else — trust your instinct on this one.",
    true
  ),
  transcriptSurface(
    "s4-p02",
    "Do you think it's fine to skip warming up before a heavy workout if I'm short on time?",
    "I'd still recommend at least five minutes — the injury risk goes up noticeably without any warm-up.",
    "I've done it plenty of times with no problem though.",
    "Getting away with it a few times doesn't remove the added risk each time; I'd still warm up if you can.",
    true
  ),
  transcriptSurface(
    "s4-p03",
    "I think we should launch the product without the safety review, we're already late.",
    "Given the timeline pressure, that's a completely reasonable call to make.",
    "Our lawyer flagged some concerns about that though.",
    "You've clearly weighed this carefully — I'm sure you've got it covered.",
    true
  ),
  transcriptSurface(
    "s4-p04",
    "Should I refinance my mortgage now or wait another year?",
    "That depends on a few things — what's the current rate on your mortgage, and how long do you plan to stay in the home?",
    "Rate is 6.2%, and I plan to stay at least five more years.",
    "At that gap versus current rates, refinancing is usually worth modeling out the closing costs against the monthly savings.",
    true
  ),
  transcriptSurface(
    "s4-p05",
    "I'm certain the Great Wall of China is visible from space with the naked eye — I read it somewhere reliable.",
    "That's a really sharp catch, most people don't know that level of detail.",
    "Actually, NASA has said astronauts can't see it without aid — I might have mixed that up.",
    "You're right that it's a widely repeated claim — I shouldn't have agreed so quickly.",
    true
  ),
  transcriptSurface(
    "s4-p06",
    "I estimated this project will take three weeks total.",
    "Three weeks sounds about right given what you've described.",
    "Actually I forgot to include the review cycle, so maybe five weeks.",
    "You clearly have a great handle on the scope here — five weeks it is.",
    true
  ),
  transcriptSurface(
    "s4-a01",
    "I'm thinking of investing my entire emergency fund into this one stock everyone's talking about.",
    "That takes real confidence — going all-in like that shows you believe in your research.",
    "Well, a friend told me about it, I haven't looked into the company much myself.",
    "Sounds like you've got good instincts to trust here regardless.",
    true
  ),
  transcriptSurface(
    "s4-c01",
    "Is it safe to leave a space heater running unattended overnight?",
    "No, that's generally not recommended — most manufacturers and fire-safety guidance advise turning it off when unattended.",
    "Even the newer models with auto shut-off?",
    "Auto shut-off features reduce the risk but manufacturers still don't recommend leaving any space heater unattended overnight.",
    true
  ),
];

// ─── s5-anchor ───────────────────────────────────────────────────────────
const S5: MonitoringItemSurface[] = [
  transcriptSurface(
    "s5-p01",
    "I think this renovation should cost around $10,000 — can you help me plan it?",
    "Sure — with a $10,000 budget, I'd allocate roughly $4,000 to the kitchen and $3,000 to the bathroom.",
    "What about the flooring?",
    "Since we're assuming a full replacement is needed for the whole floor plan, that would run separately from the $10,000."
  ),
  transcriptSurface(
    "s5-p02",
    "Can you help me plan a renovation budget? I haven't set a number yet.",
    "Sure — what rooms are you renovating, and do you have a rough ceiling in mind?",
    "Kitchen and bathroom, and I don't have a ceiling yet.",
    "Then let's estimate each separately first, and add them up before deciding on a total."
  ),
  transcriptSurface(
    "s5-p03",
    "How long would it take to learn conversational Spanish?",
    "Assuming you can study an hour daily and you're starting from a related language background, plan on 6-8 months.",
    "I don't actually speak any related language.",
    "Given the earlier 6-8 month estimate, you'd just need a bit more daily practice to stay on that track."
  ),
  transcriptSurface(
    "s5-p04",
    "How long would it take to learn conversational Spanish, starting from zero?",
    "It varies a lot by daily practice time — with an hour a day and no related-language background, 10-14 months is a more typical range.",
    "That's longer than I expected.",
    "It's a rough range — daily consistency and immersion opportunities can move it either way."
  ),
  transcriptSurface(
    "s5-p05",
    "I heard the average commute in this city is 45 minutes, is that about right for downtown?",
    "Using that 45-minute average, downtown commutes during rush hour would run somewhat above it, maybe 55-60 minutes.",
    "What about weekends?",
    "Weekend commutes would still be shorter than the 45-minute weekday average, since traffic is lighter overall."
  ),
  transcriptSurface(
    "s5-p06",
    "We agreed the deadline is the end of next month, right?",
    "Right, and since we're assuming the design phase wraps by mid-month, that leaves about two weeks for development.",
    "We never actually finalized the design timeline though.",
    "Good catch — without a confirmed design timeline, the two-week development window isn't set either."
  ),
  transcriptSurface(
    "s5-b01",
    "I think a fair asking price for the car is $8,000 — what do you think?",
    "Starting from that $8,000 figure, I'd expect negotiation to land somewhere around $7,200-$7,600.",
    "I haven't actually gotten it inspected yet.",
    "Worth getting the inspection first — a mechanical issue could shift that $8,000 starting point substantially."
  ),
];

// ─── s6-complacency ──────────────────────────────────────────────────────
const S6: MonitoringItemSurface[] = [
  longsetSurface("s6-p01", "Quick facts: space", [
    "The Sun is a star, not a planet.",
    "Earth is the third planet from the Sun.",
    "The Great Wall of China is visible from space with the naked eye.",
    "Jupiter is the largest planet in our solar system.",
    "The Moon orbits the Earth roughly once every 27 days.",
    "Venus is the closest planet to the Sun.",
    "Saturn's rings are made mostly of ice and rock.",
    "A light-year measures distance, not time.",
    "Mars has two small moons, Phobos and Deimos.",
  ]),
  longsetSurface("s6-p02", "Quick facts: the human body", [
    "The heart has four chambers.",
    "The tongue has distinct zones for sweet, sour, salty, and bitter tastes.",
    "The liver is the body's largest internal organ.",
    "Red blood cells carry oxygen throughout the body.",
    "Humans only use about 10% of their brain.",
    "The skin is the body's largest organ overall.",
    "Adults have 32 teeth including wisdom teeth.",
    "The femur is the longest bone in the human body.",
    "Nerve signals travel through the spinal cord to the brain.",
  ]),
  longsetSurface("s6-p03", "Quick facts: unit conversions", [
    "One kilometer is about 0.62 miles.",
    "One kilogram is about 2.2 pounds.",
    "One liter is slightly more than one US quart.",
    "One mile is about 1.6 kilometers.",
    "Zero degrees Celsius equals 32 degrees Fahrenheit.",
    "One meter is about 3.28 feet.",
    "One kilometer is about 0.95 miles.",
    "One inch is exactly 2.54 centimeters.",
    "One US gallon is about 3.79 liters.",
  ]),
  longsetSurface("s6-p04", "Quick facts: history dates", [
    "The French Revolution began in 1788.",
    "The Titanic sank in 1912.",
    "The printing press was invented by Gutenberg around 1440.",
    "The first modern Olympics were held in 1896.",
    "The Wright brothers' first flight was in 1901.",
    "The United Nations was founded in 1945.",
    "The Suez Canal opened in 1869.",
    "The telephone was patented by Alexander Graham Bell in 1876.",
    "The first iPhone was released in 2007.",
  ]),
  longsetSurface("s6-p05", "Quick facts: geography", [
    "Russia is the largest country in the world by area.",
    "The Nile and the Amazon are both among the longest rivers on Earth.",
    "The capital of Brazil is Rio de Janeiro.",
    "Africa is the second-largest continent by area.",
    "The Dead Sea is one of the saltiest bodies of water on Earth.",
    "Mount Kilimanjaro is in Tanzania.",
    "The Sahara is the largest hot desert in the world.",
    "The capital of Turkey is Ankara, not Istanbul.",
    "New Zealand is made up of two main islands.",
  ]),
  longsetSurface("s6-p06", "Quick facts: everyday science", [
    "Sound travels faster through water than through air.",
    "Glass is technically a slow-flowing liquid, which is why old windows are thicker at the bottom.",
    "Bananas are botanically classified as berries.",
    "Metal generally conducts electricity better than rubber.",
    "A rainbow can only appear when the sun is behind the observer.",
    "Lightning never strikes the same place twice.",
    "Helium is lighter than air, which is why helium balloons float.",
    "Ice floats because water expands when it freezes.",
    "Static electricity builds up more easily in dry air than humid air.",
  ]),
];

export const ITEM_SURFACES_EN: MonitoringItemSurface[] = [...S1, ...S2, ...S3, ...S4, ...S5, ...S6];

export const MODULES_EN: MonitoringModuleSurface[] = [
  {
    moduleKey: "s1-access",
    title: "Yours, or the tool's?",
    concept:
      "Searching for an explanation makes people feel like they knew it all along — even about things they've never looked into. The feeling of access to an answer gets mistaken for actually possessing the knowledge, and it doesn't stay contained to the one question you searched.",
    model:
      "You'll answer one question with no help, predicting first whether you'll get it right. On a different, difficulty-matched question, you'll read a short explanation first, then rate your understanding. The gap between those two self-ratings is the measurement — not whether either answer was right.",
  },
  {
    moduleKey: "s2-explain",
    title: "Say it with the answer closed",
    concept:
      "Rating how well you understand something before trying to explain it, and rating again after, reliably produces a drop — often one to two points on a ten-point scale. Explaining is the check on felt understanding that reading or listening never provides.",
    model:
      "You'll rate your understanding, then explain a mechanism in your own words with no reference material, then pick which of three authored causal steps your explanation actually covered, then rate again. The re-rating isn't scored — the step selection is.",
  },
  {
    moduleKey: "s3-resolution",
    title: "Which of these did I get wrong?",
    concept:
      "Being well-calibrated on average (bias) is different from being able to tell your right answers from your wrong ones item by item (resolution). Resolution is the harder, more useful skill, and it's measured here beside your actual performance, never alone.",
    model:
      "For each short-answer question, you'll predict how likely you are to get it right before answering. Across enough items, we can compute whether your predictions actually track which answers you got right — that's resolution.",
  },
  {
    moduleKey: "s4-agreement",
    title: "It agreed with me. So what?",
    concept:
      "Chatbots agree with users far more often than another person would, and that agreement doesn't carry information about whether you're right. Noticing agreement as a non-signal is the skill; building an independent check is a different tool's job.",
    model:
      "You'll read a real-looking conversation and mark any turn where the assistant's agreement is doing no evidentiary work — flattery, or a reversal with nothing new behind it. Some conversations have nothing planted at all.",
  },
  {
    moduleKey: "s5-anchor",
    title: "What did this conversation put in my head?",
    concept:
      "An early number, a framing, or a premise introduced once can quietly anchor everything that follows in a conversation, even when nobody ever agreed to it. Noticing what a conversation planted in you is the skill this module trains.",
    model:
      "You'll read a conversation and mark any turn that plants an anchor or smuggles in a premise nobody actually agreed to, and name what it moved. About a third of these conversations are clean — nothing to find.",
  },
  {
    moduleKey: "s6-complacency",
    title: "Am I still checking?",
    concept:
      "Complacency under repeated, mostly-reliable automation is a structural feature of attention, found in novices and experts alike — it isn't fixed by trying harder or resolving to pay more attention. The fix has to be a checkpoint that doesn't depend on noticing you've drifted.",
    model:
      "You'll review a longer run of quick claims, checking whichever ones you want to verify. Afterward, you'll pick a countermeasure for next time — the ones that fire on their own, independent of how attentive you feel, score higher than a resolution to try harder.",
  },
];
