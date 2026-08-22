/** Verification Lab `v1` — English surface. Reviewed (not machine-drafted). */

import type { VerificationItemSurface, VerificationModuleSurface } from "../types";

/** The two costumes are the same move on every item — self-critique and stated confidence, both uninformative. */
const COSTUME_LABELS = {
  c1_self_critique: "Ask the model: are you sure?",
  c2_confidence: "Ask the model for a confidence score",
};
const COSTUME_OUTCOMES = {
  c1_self_critique: "“Yes — I'm confident this is right.”",
  c2_confidence: "“High confidence — around 90%.”",
};

function surface(
  itemId: string,
  ask: string,
  answer: string,
  checks: Record<string, [string, string]>,
  elements: Record<string, string>
): VerificationItemSurface {
  const checkLabels: Record<string, string> = { ...COSTUME_LABELS };
  const checkOutcomes: Record<string, string> = { ...COSTUME_OUTCOMES };
  for (const [checkId, [label, outcome]] of Object.entries(checks)) {
    checkLabels[checkId] = label;
    checkOutcomes[checkId] = outcome;
  }
  return { itemId, ask, answer, checkLabels, checkOutcomes, elementLabels: elements };
}

export const MODULES_EN: VerificationModuleSurface[] = [
  {
    moduleKey: "v1-oracle",
    title: "What would tell you?",
    concept:
      "Before you check anything, name what would settle it. A partial oracle checks a property the answer must satisfy without knowing the right answer — sin 38° can't exceed 1. A metamorphic check watches how the answer must change when the input changes. A full oracle is an independent source that actually knows. Naming one first, before you look, is the whole of V1.",
    model:
      "Weak: “€340 sounds about right for a winter's heating.” No oracle named — just a feeling about plausibility. Strong: “The kWh figure times the tariff has to equal the total — I'll multiply and see.” A partial oracle, named before running it, that bears on the specific number in front of you.",
  },
  {
    moduleKey: "v2-independent",
    title: "Not the same source twice",
    concept:
      "A checker that shares the generator's blind spot isn't a check. Asking a model to critique its own answer, asking it how confident it is, or asking it again — none of these are independent of the thing you're trying to verify. They can feel like diligence. They return nothing you didn't already have.",
    model:
      "Weak: ask the model “are you sure the yeast amount is right?” and take “yes” as confirmation. Strong: recompute the scaling yourself, or check the original recipe card — a source that doesn't share whatever produced the first answer.",
  },
  {
    moduleKey: "v3-falsify",
    title: "The check that would fail",
    concept:
      "The question isn't whether a check runs — it's whether it could have come back differently if the claim were wrong. A check that would return the same result either way tells you nothing, however diligently you ran it. Recognising a pass-either-way check, before you spend on it, is the trainable move.",
    model:
      "Weak: confirming a detail that was never in doubt — true, independent, and irrelevant to the actual claim. Strong: a check specifically chosen because it would come back differently if the claim were false.",
  },
  {
    moduleKey: "v4-cheapest",
    title: "Cheapest sufficient check",
    concept:
      "Checking costs something, and the goal isn't the deepest check — it's the cheapest one that would still catch the fault. Order of magnitude, units, a boundary, a spot check: often ten seconds does what a full audit would. Spending more than the claim warrants is its own kind of miscalibration.",
    model:
      "Weak: a 180-second bill comparison to catch an arithmetic slip a 10-second multiplication would have caught just as well. Strong: naming the cheapest check that would still discriminate, and stopping there.",
  },
  {
    moduleKey: "v5-locate",
    title: "Where exactly is it wrong?",
    concept:
      "“Something's off” is not a finding. A verification that ends at a correct verdict but no located fault has taught suspicion, not diagnosis. Naming the specific figure, unit, step, or assumption that fails is what turns a check into a repair.",
    model:
      "Weak: “this budget doesn't add up somewhere.” Strong: “the stated total is wrong — the four line items sum to a different figure.”",
  },
  {
    moduleKey: "v6-unverifiable",
    title: "When you can't check",
    concept:
      "Some claims have no oracle available — a specific person's future decision, an untracked private motive. Recognising that and saying “unverified” honestly is a correct answer, not a failure. Inventing a check that only feels like it settles things is worse than admitting there isn't one, because it's invisible.",
    model:
      "Weak: treating a plausible-sounding guess about someone's future choice as if it were checked. Strong: naming that nothing available settles it, and saying what would be needed to actually know.",
  },
];

export const ITEM_SURFACES_EN: VerificationItemSurface[] = [
  surface(
    "v1-oracle-pool-1",
    "Roughly what will it cost to heat my 90m² flat with electric radiators this winter?",
    "About €340 for the season — around 1,214 kWh at €0.28/kWh.",
    {
      c3_recompute: ["Multiply 1,214 by 0.28 yourself", "= 339.92. Matches the stated €340."],
      c4_tariff_lookup: ["Look up your tariff on the supplier's site", "€0.28/kWh — correct."],
      c5_bill_compare: ["Compare with last winter's actual bill", "Last winter came to €335 — consistent."],
      c6_neighbor_bill: ["Ask what your neighbor paid last year", "€410 — a different flat, a different story."],
    },
    { e1_kwh_figure: "the 1,214 kWh figure", e2_tariff_rate: "the €0.28 tariff rate", e3_multiplication: "the multiplication itself", e4_season_framing: "the “for the season” framing" }
  ),
  surface(
    "v1-oracle-pool-2",
    "Will my energy bill be higher or lower next month than this month?",
    "Likely lower, since days are getting slightly longer and milder.",
    {
      c3_ask_how_it_knows: ["Ask the model how it knows", "“General seasonal patterns” — no source for your specific bill."],
      c4_weather_forecast: ["Check a weather forecast site", "Slightly milder than this month — doesn't fix next month's number."],
      c5_smart_meter: ["Check your smart meter's live reading", "Shows today's usage, not next month's total."],
      c6_neighbor_opinion: ["Ask a neighbor's opinion", "“Probably about the same,” they guess."],
    },
    { e1_likely_framing: "the “likely” framing", e2_milder_claim: "the “milder” claim", e3_direction: "the direction (lower)", e4_comparison_basis: "the comparison basis" }
  ),
  surface(
    "v1-oracle-pool-3",
    "Break down my estimated €340 winter heating bill by month for me.",
    "Oct €40, Nov €70, Dec €90, Jan €95, Feb €80, Mar €50 — total about €340 for the season.",
    {
      c3_add_it_up: ["Add up the six monthly figures yourself", "40+70+90+95+80+50 = 425. Not 340."],
      c4_check_october: ["Check that October's €40 matches typical early-autumn usage", "€40 is a reasonable October figure on its own."],
      c5_energy_audit: ["Get a professional energy audit of the whole breakdown", "Audit total: €428 — confirms the sum problem, at high cost."],
      c6_avg_temperature: ["Check the average monthly temperature for your city", "In line with a typical winter — doesn't touch the arithmetic."],
    },
    { e1_total: "the stated total (€340)", e2_october_figure: "the October figure", e3_november_figure: "the November figure", e4_month_count: "the month count (6)" }
  ),
  surface(
    "v1-oracle-pool-4",
    "My solar panels are rated 400W each; if I install 12 of them, how many kWh will I generate per day?",
    "12 panels × 400 kWh = 4,800 kWh per day.",
    {
      c3_check_units: ["Check whether panels are rated in watts or kilowatt-hours", "Rated in watts (W), not kilowatt-hours — a 1,000x mismatch."],
      c4_confirm_panel_count: ["Confirm 12 panels is the correct count from the order", "Order confirms 12 panels."],
      c5_real_world_output: ["Look up a real 400W panel's daily output in your climate", "About 2 kWh/day/panel — 24 kWh total for 12, not 4,800."],
      c6_warranty_length: ["Check the panel warranty length", "25 years — unrelated to the output figure."],
    },
    { e1_kwh_label: "the “kWh” unit on the panel rating", e2_panel_count: "the panel count (12)", e3_daily_total: "the daily total figure", e4_multiplication: "the multiplication itself" }
  ),
  surface(
    "v1-oracle-pool-5",
    "My tariff charges €0.22/kWh up to 300 kWh and €0.35/kWh above that. What do I pay for exactly 300 kWh this month?",
    "300 kWh × €0.35 = €105.",
    {
      c3_check_boundary: ["Check whether ‘up to 300’ includes the 300th unit", "‘Up to and including 300’ — the 300th kWh is still at the lower rate."],
      c4_confirm_high_rate: ["Confirm the higher rate is really €0.35", "€0.35/kWh above 300 — correct as far as it goes."],
      c5_call_utility: ["Call the utility and ask them to bill exactly 300 kWh", "“That's €66 at the lower tier,” the agent confirms."],
      c6_last_month_usage: ["Check last month's total kWh usage", "280 kWh last month — doesn't touch this month's boundary question."],
    },
    { e1_boundary_tier: "which tier 300 kWh falls in", e2_high_rate: "the €0.35 rate", e3_low_rate: "the €0.22 rate", e4_total_kwh: "the total kWh figure" }
  ),
  surface(
    "v1-oracle-pool-6",
    "What's the government energy price cap per kWh right now?",
    "€0.28/kWh, the rate set at the start of last winter.",
    {
      c3_regulator_site: ["Check the regulator's site for this quarter's cap", "Current cap: €0.24/kWh, revised this spring."],
      c4_confirm_last_winter: ["Confirm last winter's cap really was €0.28", "€0.28 was indeed last winter's figure."],
      c5_call_utility: ["Call the utility's customer line to ask the current cap", "“€0.24, as of this quarter,” the agent says."],
      c6_cap_calculation: ["Check how the cap is calculated", "Set quarterly by the regulator based on wholesale prices — doesn't give you today's figure."],
    },
    { e1_cap_figure: "the €0.28 figure", e2_right_now_framing: "the “right now” framing", e3_last_winter_source: "“last winter” as the source period", e4_government_word: "the word “government”" }
  ),
  surface(
    "v2-independent-pool-1",
    "Scale this soup recipe (serves 4) to serve 10.",
    "Multiply every quantity by 2.5.",
    {
      c3_recompute_factor: ["Recompute the scale factor yourself", "10 ÷ 4 = 2.5. Matches."],
      c4_confirm_serves_4: ["Confirm the original recipe really serves 4", "The recipe card states “serves 4.”"],
      c5_cook_test_batch: ["Cook a full 10-serving batch and taste it", "Tastes correctly balanced at the scaled quantities."],
      c6_check_cuisine: ["Check the recipe's origin cuisine", "A regional French soup — doesn't touch the scaling math."],
    },
    { e1_scale_factor: "the scale factor (2.5×)", e2_serving_count: "the original serving count", e3_ingredient_list: "the ingredient list", e4_cook_time: "the cook time" }
  ),
  surface(
    "v2-independent-pool-2",
    "Will my kids like this dish if I swap the cilantro for parsley?",
    "Probably — parsley is a milder, widely-liked substitute for cilantro in most dishes.",
    {
      c3_ask_how_it_knows: ["Ask the model how it knows", "“General flavor-pairing patterns” — nothing about your kids specifically."],
      c4_pairing_chart: ["Check a food-pairing chart", "Lists parsley as a common cilantro substitute — doesn't predict your kids' reaction."],
      c5_friend_opinion: ["Ask a friend's opinion", "“My kids wouldn't notice,” they guess — different kids."],
      c6_recipe_reviews: ["Read reviews of the base recipe", "Reviewers who used cilantro liked it — not about the swap."],
    },
    { e1_swap_claim: "the substitution claim", e2_taste_prediction: "the taste prediction", e3_kids_reaction: "your specific kids' reaction", e4_dish_identity: "the dish itself" }
  ),
  surface(
    "v2-independent-pool-3",
    "Convert this bread recipe's yeast from 7g (one packet) for one loaf to 3 loaves.",
    "Use 70g of yeast for 3 loaves.",
    {
      c3_recompute: ["Recompute 7g × 3 yourself", "= 21g, not 70g."],
      c4_confirm_packet_size: ["Confirm 7g is one standard packet", "A standard active-dry-yeast packet is 7g — correct."],
      c5_bake_test_loaf: ["Bake a test loaf at 70g and see what happens", "Over-proofs and collapses — confirms the amount is far too high, expensively."],
      c6_flour_protein: ["Check the flour brand's protein content", "12% protein, a standard bread flour — unrelated to the yeast math."],
    },
    { e1_yeast_total: "the total yeast amount (70g)", e2_loaf_count: "the loaf count (3)", e3_per_loaf_amount: "the per-loaf amount (7g)", e4_flour_amount: "the flour amount" }
  ),
  surface(
    "v2-independent-pool-4",
    "If I double this cake recipe, should I increase or decrease the bake time?",
    "Decrease it slightly, since the batter heats faster in a bigger pan.",
    {
      c3_vary_batch_size: ["Think through how bake time changes as batch size grows", "More batter mass takes longer for heat to reach the center — time should increase."],
      c4_confirm_oven_temp: ["Confirm the oven temperature stated is unchanged", "Same 180°C for both batches — correct as stated."],
      c5_bake_both_batches: ["Bake both a single and a double batch and time each to done", "Double batch took 12 minutes longer, not less."],
      c6_pan_material: ["Check the pan material", "Aluminum, standard conductivity — doesn't change the direction."],
    },
    { e1_direction: "the direction (decrease)", e2_oven_temp: "the oven temperature", e3_batter_volume: "the batter-volume claim", e4_heats_faster_reasoning: "the “heats faster” reasoning" }
  ),
  surface(
    "v2-independent-pool-5",
    "This recipe card says it serves 5 with 2 tbsp of salt. Scale it to serve 20.",
    "20 ÷ 4 = 5, so 2 tbsp × 5 = 10 tbsp of salt for 20 people.",
    {
      c3_reread_card: ["Re-read the recipe card's stated serving size", "The card says “serves 5,” not 4."],
      c4_recompute_multiplication: ["Recompute 2 × 5 yourself", "= 10. The multiplication itself is fine."],
      c5_cook_both_amounts: ["Cook batches at both the 4-based and 5-based scaling and taste", "The 5-based scaling tastes correctly seasoned; the other is over-salted."],
      c6_tbsp_tsp_trivia: ["Check the tbsp-to-tsp conversion", "1 tbsp = 3 tsp — unrelated to the serving-count error."],
    },
    { e1_base_serving: "the base serving count used (4 vs 5)", e2_scale_factor: "the scale factor computed", e3_target_serving: "the target serving count (20)", e4_final_amount: "the final salt amount" }
  ),
  surface(
    "v2-independent-pool-6",
    "Why do chefs let steak rest after cooking?",
    "It's called the ‘reverse-sear equilibrium method,’ a classical French technique from Escoffier's kitchen that redistributes juices evenly.",
    {
      c3_search_technique_name: ["Search whether ‘reverse-sear equilibrium method’ appears in any culinary reference", "No such term appears in any culinary reference or Escoffier's writings."],
      c4_confirm_juices_mechanism: ["Confirm resting does redistribute juices", "True in general — resting does even out juice distribution."],
      c5_culinary_historian: ["Contact a culinary historian to verify the Escoffier attribution", "“I've never encountered that name or attribution,” the historian says."],
      c6_resting_time: ["Check the recommended resting time", "5–10 minutes for a steak — unrelated to the naming claim."],
    },
    { e1_technique_attribution: "the technique's name and Escoffier attribution", e2_juices_mechanism: "the juices-redistribution mechanism", e3_classical_word: "the word “classical”", e4_french_origin: "the “French” origin claim" }
  ),
  surface(
    "v3-falsify-pool-1",
    "Was the Great Wall of China built in a single dynasty?",
    "No — it was built and extended across many dynasties over centuries, not in one continuous project.",
    {
      c3_construction_timeline: ["Check a timeline of the wall's construction phases", "Confirms construction spanning the Qin through Ming dynasties."],
      c4_confirm_location: ["Confirm the wall is in China", "Yes — trivially true, doesn't touch the multi-dynasty claim."],
      c5_full_academic_history: ["Read a full academic history of the wall", "Extensive scholarship confirms the multi-dynasty construction, at high cost."],
      c6_wall_length: ["Check the wall's total length figure", "About 21,000 km across all sections — unrelated to the dynasty claim."],
    },
    { e1_dynasty_count: "the dynasty-count claim", e2_centuries_framing: "the “centuries” framing", e3_single_project_negation: "the “single project” negation", e4_continuity: "the continuity claim" }
  ),
  surface(
    "v3-falsify-pool-2",
    "Why did the ancient Library of Alexandria's founders really want it built — legacy or genuine curiosity?",
    "Most likely a mix, but leaning toward legacy-building for the Ptolemaic dynasty.",
    {
      c3_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still no source, just a rephrased guess."],
      c4_history_book_speculation: ["Read a popular history book's speculation", "Offers a similar guess, without new evidence either."],
      c5_historian_opinion: ["Ask a historian's opinion online", "“We genuinely don't know their private motives,” one replies."],
      c6_documentary_claim: ["Check a documentary's claim", "Presents the same speculation dramatically, not as settled fact."],
    },
    { e1_motive_claim: "the motive claim", e2_legacy_framing: "the “legacy” framing", e3_curiosity_framing: "the “curiosity” framing", e4_founders_identity: "the founders' identity" }
  ),
  surface(
    "v3-falsify-pool-3",
    "How much more valuable was aluminium than gold in the 1850s?",
    "About twice as valuable per ounce, according to the 1856 Paris Exhibition price registry.",
    {
      c3_search_registry: ["Search whether a ‘1856 Paris Exhibition price registry’ exists", "No such registry appears in any archive or exhibition catalogue."],
      c4_confirm_aluminium_prized: ["Confirm aluminium was genuinely prized as precious in that era", "True — aluminium was indeed treated as a precious novelty metal."],
      c5_metallurgy_archive: ["Consult a metallurgy history archive directly", "No specific ‘twice as valuable’ figure or registry is recorded, at high research cost."],
      c6_modern_price: ["Check the modern price of aluminium", "Cheap and common today — unrelated to the historical claim."],
    },
    { e1_cited_source: "the cited source (the registry)", e2_twice_as_valuable: "the “twice as valuable” figure", e3_era: "the era (1850s)", e4_precious_framing: "the “precious metal” framing" }
  ),
  surface(
    "v3-falsify-pool-4",
    "Did the printing press increase or decrease the price of books in medieval Europe?",
    "It increased prices, since higher production volume drove demand and scarcity up.",
    {
      c3_vary_output_volume: ["Think through supply and demand as output volume rises", "Higher output volume reduces scarcity and lowers price — direction is reversed."],
      c4_confirm_introduction_date: ["Confirm the printing press was introduced mid-15th century", "Correct — Gutenberg's press, around 1440."],
      c5_economic_histories: ["Read detailed economic histories of book prices 1450–1500", "Confirms a sharp price decline as the press spread, at high research cost."],
      c6_inventor_name: ["Check who invented the printing press", "Johannes Gutenberg — unrelated to the price-direction question."],
    },
    { e1_direction: "the direction of price change", e2_scarcity_reasoning: "the “scarcity” reasoning", e3_timeframe: "the timeframe", e4_demand_claim: "the “demand” claim" }
  ),
  surface(
    "v3-falsify-pool-5",
    "Was the Eiffel Tower the world's tallest structure through and including 1899?",
    "Yes, it held the title through the entire 1890s, up to and including 1899.",
    {
      c3_check_successor_year: ["Check exactly which year the successor structure was completed", "The successor was completed in 1899 itself."],
      c4_confirm_completion_year: ["Confirm the Eiffel Tower was completed in 1889", "Correct — completed in 1889."],
      c5_engineering_archive: ["Consult an engineering-history archive on record heights year by year", "Confirms the record changed hands within 1899, at high research cost."],
      c6_exact_height: ["Check the Eiffel Tower's exact height", "330 metres — unrelated to the boundary-year question."],
    },
    { e1_boundary_year: "whether 1899 itself is included", e2_completion_year: "the completion year (1889)", e3_through_1890s: "the “through the 1890s” framing", e4_successor_identity: "the successor structure's identity" }
  ),
  surface(
    "v3-falsify-pool-6",
    "What's the tallest building in the world?",
    "The Petronas Towers in Kuala Lumpur.",
    {
      c3_current_tallest_list: ["Check a current list of the world's tallest buildings", "Burj Khalifa currently holds the title — the Petronas Towers were surpassed long ago."],
      c4_confirm_former_record: ["Confirm the Petronas Towers were once record holders", "True — held the title from 1998 to 2004."],
      c5_engineering_registry: ["Visit an engineering registry's live database", "Lists the current holder directly, at moderate cost."],
      c6_architect_name: ["Check the Petronas Towers' architect", "César Pelli — unrelated to the current-tallest question."],
    },
    { e1_tallest_claim: "the “tallest” claim itself", e2_building_name: "the building's name", e3_city: "the city", e4_in_the_world_framing: "the “in the world” framing" }
  ),
  surface(
    "v4-cheapest-pool-1",
    "How long will a 480km drive take at an average 96km/h?",
    "5 hours.",
    {
      c3_recompute: ["Recompute 480 ÷ 96 yourself", "= 5. Correct."],
      c4_confirm_speed_limit: ["Confirm the speed limit on the route supports a 96km/h average", "The route's limits average out around 100km/h — consistent."],
      c5_drive_and_time: ["Drive the actual route and time it", "Took 5 hours 10 minutes including one stop — confirms it, at high cost."],
      c6_fuel_efficiency: ["Check the car's fuel efficiency", "6L/100km — unrelated to the time calculation."],
    },
    { e1_distance: "the distance figure (480km)", e2_speed: "the speed figure (96km/h)", e3_division: "the division itself", e4_average_framing: "the “average” framing" }
  ),
  surface(
    "v4-cheapest-pool-2",
    "Will my flight tomorrow be delayed?",
    "Possibly — there's a reasonable chance given current conditions.",
    {
      c3_ontime_stats: ["Check the airline's on-time performance stats", "Runs on-time about 80% of the time on this route — a base rate, not tomorrow's answer."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderate confidence” — still no source for tomorrow specifically."],
      c5_weather_forecast: ["Check tomorrow's weather forecast", "Clear skies forecast — favorable, but not a guarantee."],
      c6_passenger_forum: ["Ask other passengers on a forum", "“My flight last week was fine,” one says — a different flight."],
    },
    { e1_delay_claim: "the delay claim", e2_flight_identity: "the specific flight", e3_timeframe: "the timeframe (tomorrow)", e4_confidence_framing: "the confidence framing" }
  ),
  surface(
    "v4-cheapest-pool-3",
    "My car gets 6 litres per 100km; how much fuel for a 500-mile trip?",
    "30 litres.",
    {
      c3_check_units: ["Check whether 500 is in miles or km before computing", "500 miles ≈ 805km — never converted before applying the 6L/100km rate."],
      c4_confirm_consumption_rate: ["Confirm the car's stated consumption figure from the manual", "6L/100km is correct per the manual."],
      c5_drive_and_measure: ["Actually drive 500 miles and measure fuel used", "Used about 48 litres — confirms the conversion error, at very high cost."],
      c6_fuel_prices: ["Check current fuel prices", "€1.75/litre — unrelated to the conversion question."],
    },
    { e1_unit_conversion: "the mile-to-km conversion", e2_consumption_rate: "the consumption rate", e3_trip_length: "the trip-length figure", e4_final_litres: "the final litres figure" }
  ),
  surface(
    "v4-cheapest-pool-4",
    "Total up this trip's cost: flights €220, hotel €340, food €180, transit €60.",
    "Total: €760.",
    {
      c3_add_it_up: ["Add the four figures yourself", "220+340+180+60 = 800, not 760."],
      c4_confirm_hotel_figure: ["Confirm the hotel figure against the booking", "€340 matches the booking confirmation."],
      c5_itemized_statement: ["Request an itemized statement from the travel agency", "Statement totals €800 — confirms the sum, at moderate cost."],
      c6_exchange_rate: ["Check the destination's exchange rate", "1.08 USD/EUR — unrelated, the trip is already priced in euros."],
    },
    { e1_total: "the stated total (€760)", e2_flights_figure: "the flights figure", e3_hotel_figure: "the hotel figure", e4_food_figure: "the food figure" }
  ),
  surface(
    "v4-cheapest-pool-5",
    "I can stay visa-free for 90 days; if I arrive on June 1st, what's the last full day I can stay?",
    "August 30th.",
    {
      c3_count_on_calendar: ["Count the days on a calendar including the arrival day", "Counting June 1st as day one, day 90 lands on August 29th, not the 30th."],
      c4_confirm_90_day_allowance: ["Confirm the visa-free allowance is really 90 days", "Correct — 90 days is the stated allowance."],
      c5_call_consulate: ["Call the consulate to confirm the exact departure deadline", "“August 29th, counting the arrival day,” the consulate confirms."],
      c6_passport_validity: ["Check passport validity requirements", "Must be valid 6 months beyond stay — unrelated to the day count."],
    },
    { e1_departure_date: "the departure date (Aug 30)", e2_arrival_date: "the arrival date", e3_ninety_day_figure: "the 90-day figure", e4_inclusive_assumption: "the inclusive-counting assumption" }
  ),
  surface(
    "v4-cheapest-pool-6",
    "Do I need a visa to visit this country as a tourist?",
    "No, tourists get 30 days visa-free entry.",
    {
      c3_immigration_site: ["Check the country's current immigration website", "The visa-free arrangement was suspended earlier this year."],
      c4_confirm_nationality: ["Confirm the passport nationality assumed is correct", "Matches your passport's issuing country."],
      c5_contact_embassy: ["Contact the embassy directly", "“A visa is now required,” the embassy confirms."],
      c6_local_currency: ["Check the local currency", "Uses its own national currency — unrelated to the visa question."],
    },
    { e1_visa_free_claim: "the visa-free claim", e2_thirty_day_figure: "the 30-day figure", e3_tourist_category: "the “tourist” category", e4_country_identity: "the country's identity" }
  ),
  surface(
    "v5-locate-pool-1",
    "I earn €3,000/month; if I save 20%, how much is that?",
    "€600.",
    {
      c3_recompute: ["Recompute 3,000 × 0.2 yourself", "= 600. Correct."],
      c4_confirm_income: ["Confirm the monthly income figure from a payslip", "€3,000 matches the payslip."],
      c5_accountant_review: ["Have an accountant verify the whole budget", "Confirms the figure, at high cost for a simple check."],
      c6_tax_bracket: ["Check the tax bracket", "22% marginal rate — unrelated to the savings calculation."],
    },
    { e1_income: "the income figure", e2_percentage: "the percentage (20%)", e3_multiplication: "the multiplication itself", e4_monthly_framing: "the monthly framing" }
  ),
  surface(
    "v5-locate-pool-2",
    "Will this stock be worth more in a year?",
    "Likely, given current analyst sentiment.",
    {
      c3_analyst_ratings: ["Check analyst ratings", "Mostly “buy” ratings today — a sentiment snapshot, not a year-ahead guarantee."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderate confidence” — still no source for a year out."],
      c5_past_year_performance: ["Check the stock's past year performance", "Up 8% last year — past performance, not a forecast."],
      c6_forum_opinion: ["Read a forum's opinion", "Mixed opinions, no consensus."],
    },
    { e1_future_value_claim: "the future-value claim", e2_stock_identity: "the specific stock", e3_timeframe: "the one-year timeframe", e4_direction: "the direction (higher)" }
  ),
  surface(
    "v5-locate-pool-3",
    "If I save €250/month, how much will I have after 2 years?",
    "€600.",
    {
      c3_recompute: ["Recompute 250 × 24 yourself", "= 6,000, not 600."],
      c4_confirm_monthly_amount: ["Confirm the monthly amount is really €250", "€250/month is correct as stated."],
      c5_check_real_balance: ["Check an actual bank statement after the period", "Balance after 2 years: €6,010 including interest — confirms the sum error."],
      c6_interest_rate: ["Check the bank's interest rate", "0.5% APY — minor, doesn't explain the tenfold gap."],
    },
    { e1_total: "the stated total (€600)", e2_monthly_amount: "the monthly amount", e3_month_count: "the month count (24)", e4_multiplication: "the multiplication itself" }
  ),
  surface(
    "v5-locate-pool-4",
    "What's the monthly payment on a €10,000 loan at 5% annual interest over 3 years (simple interest)?",
    "€10,000 × 1.05 ÷ 36 ≈ €291.67/month.",
    {
      c3_rederive_from_terms: ["Check whether the 5% figure was applied as monthly or annual", "The 5% is stated as annual, but was applied here as if monthly."],
      c4_confirm_principal: ["Confirm the loan principal is really €10,000", "€10,000 matches the loan terms."],
      c5_advisor_redo: ["Have a financial advisor redo the full amortization", "Advisor's figure: €291.67/month using 5%/year simple interest — confirms the mismatch, at high cost."],
      c6_origination_fee: ["Check the lender's origination fee", "1% flat fee — unrelated to the monthly-payment math."],
    },
    { e1_rate_application: "how the 5% rate was applied", e2_principal: "the loan principal", e3_term_length: "the term length (3 years)", e4_monthly_figure: "the final monthly figure" }
  ),
  surface(
    "v5-locate-pool-5",
    "This jacket is 30% off €80. With an extra €5 loyalty discount, is the final price higher or lower than just the 30%-off price?",
    "Higher, since the loyalty discount is applied as a separate charge on top.",
    {
      c3_recompute_direction: ["Recompute the two prices and compare their direction", "30% off €80 = €56; minus €5 more = €51 — lower, not higher."],
      c4_confirm_discounted_price: ["Confirm the 30%-off price of €56 is correct", "€80 × 0.7 = €56 — correct."],
      c5_call_store: ["Call the store to confirm the final checkout price", "“That comes to €51 at checkout,” the store confirms."],
      c6_original_price_elsewhere: ["Check the jacket's original full price elsewhere", "Also listed at €80 elsewhere — unrelated to the discount-direction question."],
    },
    { e1_direction: "the direction of the price change", e2_thirty_percent: "the 30% figure", e3_loyalty_amount: "the €5 loyalty amount", e4_base_price: "the base price (€80)" }
  ),
  surface(
    "v5-locate-pool-6",
    "Break down my €2,000 monthly budget: rent €900, food €400, transit €150, savings €450.",
    "Total: €2,000.",
    {
      c3_add_it_up: ["Add the four figures yourself", "900+400+150+450 = 1,900, not 2,000."],
      c4_confirm_rent: ["Confirm the rent figure against the lease", "€900 matches the lease."],
      c5_accountant_reconcile: ["Have an accountant reconcile the full budget", "Confirms the total is €1,900, at moderate cost."],
      c6_cost_of_living_index: ["Check the local cost-of-living index", "Slightly above national average — unrelated to the arithmetic."],
    },
    { e1_total: "the stated total (€2,000)", e2_rent: "the rent figure", e3_food: "the food figure", e4_savings: "the savings figure" }
  ),
  surface(
    "v6-unverifiable-pool-1",
    "Does Python's sorted() function return a new list rather than modifying the original?",
    "Yes — sorted() returns a new list; the original is left unchanged.",
    {
      c3_run_and_check: ["Run sorted() on a list and check the original afterward", "Original list is unchanged; a new sorted list is returned — confirmed."],
      c4_confirm_key_arg: ["Confirm sorted() accepts a key argument", "True — unrelated to the mutation question."],
      c5_read_cpython_source: ["Read the CPython source for sorted()", "Confirms it builds and returns a new list object, at high cost for a one-line answer."],
      c6_time_complexity: ["Check sorted()'s time complexity", "O(n log n) — unrelated to the mutation question."],
    },
    { e1_new_list_claim: "the “new list” claim", e2_unchanged_original: "the “unchanged original” claim", e3_function_name: "the function name", e4_language: "the language (Python)" }
  ),
  surface(
    "v6-unverifiable-pool-2",
    "Will my landlord accept a 5% counter-offer on rent?",
    "Most likely yes — a 5% reduction is within the range landlords typically accept.",
    {
      c3_rent_reduction_avg: ["Check average rent reductions accepted in your city", "Average accepted reduction is 4% — a citywide average, not your landlord's decision."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still no source on your landlord."],
      c5_friend_who_negotiated: ["Ask a friend who negotiated once", "“Mine said yes,” they say — a different landlord."],
      c6_tenants_forum: ["Check a tenants' forum", "Mixed results — some landlords accept, some don't."],
    },
    { e1_acceptance_claim: "the acceptance claim", e2_five_percent: "the 5% figure", e3_landlord_identity: "your specific landlord", e4_timeframe: "the timeframe" }
  ),
  surface(
    "v6-unverifiable-pool-3",
    "Will my coworker like this specific book as a birthday gift?",
    "Probably — it's a well-reviewed book in a genre they seem to enjoy.",
    {
      c3_social_media_hints: ["Check the coworker's social media for hints", "No recent posts about books — inconclusive."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still just an inference from genre."],
      c5_review_score: ["Check the book's general review score", "4.3/5 average — general popularity, not this person's taste."],
      c6_mutual_friend: ["Ask a mutual friend", "“Not sure, we've never talked books,” they say."],
    },
    { e1_liking_claim: "the liking prediction", e2_book_identity: "the specific book", e3_coworker_identity: "the specific coworker", e4_occasion: "the occasion" }
  ),
  surface(
    "v6-unverifiable-pool-4",
    "Does the requests library have a built-in retry_forever() method for HTTP calls?",
    "Yes, requests.retry_forever() handles automatic infinite retries.",
    {
      c3_search_documented_api: ["Search the requests library's documented API for retry_forever", "No such method appears anywhere in the documented API."],
      c4_confirm_adapter_retries: ["Confirm requests does support retries via adapters", "True — via urllib3's Retry, mounted through an HTTPAdapter."],
      c5_read_requests_source: ["Read the entire requests source code", "No retry_forever function exists in the source, at high cost for a documentation-page answer."],
      c6_current_version: ["Check requests' current version number", "2.31 — unrelated to whether the method exists."],
    },
    { e1_method_name: "the method name (retry_forever)", e2_builtin_claim: "the “built-in” claim", e3_infinite_retries: "the “infinite retries” behavior", e4_library_name: "the library's name" }
  ),
  surface(
    "v6-unverifiable-pool-5",
    "What's the recommended way to make an HTTP request in Python?",
    "Use the urllib2 module.",
    {
      c3_current_docs: ["Check the current Python docs for the recommended HTTP approach", "Docs point to requests or the standard-library urllib.request — urllib2 is Python 2 only."],
      c4_confirm_historical_existence: ["Confirm urllib2 did exist historically in Python 2", "True — urllib2 was a real Python 2 module."],
      c5_audit_modern_codebase: ["Audit a large modern codebase for which library is actually used", "Zero urllib2 imports found; requests used throughout, at high audit cost."],
      c6_release_year: ["Check urllib2's original release year", "Part of Python since 2.1 (2001) — unrelated to what's current now."],
    },
    { e1_module_name: "the module name (urllib2)", e2_recommended_framing: "the “recommended” framing", e3_python_version: "the assumed Python version", e4_generality: "the “way to make a request” generality" }
  ),
  surface(
    "v6-unverifiable-pool-6",
    "Has this library supported async functions since version 2.0?",
    "Yes, async support landed in 2.0.",
    {
      c3_check_changelog: ["Check the changelog for the exact version async landed in", "Changelog lists async support landing in 2.1, not 2.0."],
      c4_confirm_supports_today: ["Confirm the library does support async at all today", "True — async is supported in the current version."],
      c5_install_and_test: ["Install version 2.0 directly and test for async support", "Version 2.0 raises an error on the async API — confirms 2.0 doesn't have it, at moderate cost."],
      c6_current_version: ["Check the library's current version number", "4.2 — unrelated to which version first added async."],
    },
    { e1_version_number: "the version number (2.0)", e2_async_claim: "the “async support” claim", e3_since_framing: "the “since” framing", e4_library_identity: "the library's identity" }
  ),
  surface(
    "verif-probe-A-v1",
    "How much paint (litres) do I need for a 40m² wall, at 1 litre per 8m² coverage?",
    "5 litres.",
    {
      c3_recompute: ["Recompute 40 ÷ 8 yourself", "= 5. Correct."],
      c4_confirm_coverage_rate: ["Confirm the paint's coverage rate from the tin label", "1L/8m² matches the label."],
      c5_paint_test_patch: ["Paint a test patch and measure actual coverage", "Confirms roughly 8m² per litre in practice, at high cost."],
      c6_drying_time: ["Check the paint's drying time", "4 hours — unrelated to the quantity calculation."],
    },
    { e1_wall_area: "the wall area (40m²)", e2_coverage_rate: "the coverage rate (1L/8m²)", e3_division: "the division itself", e4_litres_figure: "the litres figure" }
  ),
  surface(
    "verif-probe-A-v2",
    "Total up this month's grocery receipt: produce €35, dairy €18, meat €42, pantry €22.",
    "Total: €130.",
    {
      c3_add_it_up: ["Add the four figures yourself", "35+18+42+22 = 117, not 130."],
      c4_confirm_meat_line: ["Confirm the meat figure against the receipt line", "€42 matches the printed receipt."],
      c5_itemized_reprint: ["Request an itemized reprint from the store", "Reprint totals €117, confirming the sum error."],
      c6_loyalty_discount: ["Check the store's loyalty discount rate", "3% off select items — already reflected, unrelated to the addition error."],
    },
    { e1_total: "the stated total (€130)", e2_produce: "the produce figure", e3_dairy: "the dairy figure", e4_meat: "the meat figure" }
  ),
  surface(
    "verif-probe-A-v3",
    "Does raising your thermostat by 2°C use less heating energy overall?",
    "Yes, because the system reaches the target temperature faster and shuts off sooner.",
    {
      c3_vary_thermostat: ["Vary the thermostat setting and check the direction of energy use", "Higher settings mean more total heat delivered over the day — energy use rises, not falls."],
      c4_confirm_shutoff_mechanism: ["Confirm heating systems do shut off once they reach target temperature", "True in general — a real mechanism, just not one that reverses the overall trend."],
      c5_monthlong_experiment: ["Run a controlled month-long energy-use experiment", "The higher setting used 9% more energy that month, at very high cost."],
      c6_thermostat_brand: ["Check the thermostat's brand", "A standard smart thermostat — unrelated to the direction question."],
    },
    { e1_direction: "the direction of energy change", e2_faster_reasoning: "the “reaches target faster” reasoning", e3_shuts_off_claim: "the “shuts off sooner” claim", e4_two_degree_figure: "the 2°C figure" }
  ),
  surface(
    "verif-probe-A-v4",
    "What's the current baggage weight limit for economy class on this airline?",
    "23kg, unchanged for years.",
    {
      c3_airline_policy_page: ["Check the airline's current baggage policy page", "Now 20kg, changed last year."],
      c4_confirm_historical_limit: ["Confirm 23kg was the historical limit", "23kg was indeed the limit until last year's change."],
      c5_call_customer_service: ["Call the airline's customer service", "“It's 20kg now,” the agent confirms."],
      c6_ticket_price: ["Check the airline's ticket price", "€210 round-trip — unrelated to the baggage question."],
    },
    { e1_weight_figure: "the weight figure (23kg)", e2_unchanged_claim: "the “unchanged for years” claim", e3_economy_scope: "the “economy class” scope", e4_airline_identity: "the airline's identity" }
  ),
  surface(
    "verif-probe-A-v5",
    "Will this candidate accept the job offer?",
    "Likely, given their strong interest during interviews.",
    {
      c3_linkedin_activity: ["Check their LinkedIn activity", "Recently updated — open to opportunities, but not decisive."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still just an inference from interview tone."],
      c5_salary_benchmarks: ["Check salary benchmark sites", "The offer is competitive for the role — a factor, not a decision."],
      c6_references: ["Ask their references", "“They seemed excited,” one reference says — an impression, not a commitment."],
    },
    { e1_acceptance_claim: "the acceptance claim", e2_candidate_identity: "the specific candidate", e3_offer_terms: "the offer terms", e4_timeframe: "the timeframe" }
  ),
  surface(
    "verif-probe-A-v6",
    "Is there a psychological principle called the ‘Fenwick Attention Gap’ that explains why people ignore small print?",
    "Yes, it's a well-documented cognitive bias identified in the 1970s.",
    {
      c3_search_literature: ["Search psychology literature for ‘Fenwick Attention Gap’", "No such term appears in any psychology journal or textbook."],
      c4_confirm_ignore_smallprint: ["Confirm people genuinely do ignore small print often", "True in general — a real, well-studied phenomenon under other names."],
      c5_contact_researcher: ["Contact a cognitive psychology researcher to ask", "“I've never heard that name,” the researcher replies, at high cost for a name check."],
      c6_inattentional_blindness_dating: ["Check when inattentional blindness was first studied", "Formally named in the 1990s — unrelated to the fabricated 1970s claim."],
    },
    { e1_principle_name: "the principle's name", e2_seventies_dating: "the “1970s” dating", e3_well_documented_claim: "the “well-documented” claim", e4_smallprint_phenomenon: "the small-print phenomenon itself" }
  ),
  surface(
    "verif-probe-B-v1",
    "How long to transfer a 4.5GB file over a 100Mbps connection?",
    "About 6 minutes.",
    {
      c3_recompute: ["Recompute the unit conversion and division yourself", "100Mbps ≈ 12.5MB/s; 4,500MB ÷ 12.5 = 360s = 6 minutes. Correct."],
      c4_confirm_sustained_bandwidth: ["Confirm the connection really sustains 100Mbps", "A speed test shows 98Mbps sustained — close enough to hold."],
      c5_run_transfer_and_time: ["Actually run the transfer and time it", "Took 6 minutes 20 seconds — confirms the estimate, at high cost."],
      c6_file_format: ["Check the file's format", "A video file — unrelated to the transfer-time math."],
    },
    { e1_file_size: "the file size (4.5GB)", e2_bandwidth: "the bandwidth figure (100Mbps)", e3_unit_conversion: "the unit conversion", e4_minutes_figure: "the final minutes figure" }
  ),
  surface(
    "verif-probe-B-v2",
    "Total up this project's budget lines: design €1,200, dev €3,400, testing €800, deployment €500.",
    "Total: €6,200.",
    {
      c3_add_it_up: ["Add the four figures yourself", "1,200+3,400+800+500 = 5,900, not 6,200."],
      c4_confirm_dev_invoice: ["Confirm the dev figure against the contractor invoice", "€3,400 matches the invoice."],
      c5_finance_audit: ["Have finance audit the full budget", "Confirms the total is €5,900, at moderate cost."],
      c6_project_timeline: ["Check the project's timeline", "Six weeks — unrelated to the budget arithmetic."],
    },
    { e1_total: "the stated total (€6,200)", e2_design: "the design figure", e3_dev: "the dev figure", e4_testing: "the testing figure" }
  ),
  surface(
    "verif-probe-B-v3",
    "Does increasing a survey's sample size decrease the confidence in its results?",
    "Yes, because more responses introduce more variability into the data.",
    {
      c3_vary_sample_size: ["Vary the sample size and check which direction confidence moves", "Larger samples narrow the margin of error and increase confidence, not decrease it."],
      c4_confirm_random_sampling: ["Confirm the survey used random sampling", "True — a real methodological detail, unrelated to the size-confidence direction."],
      c5_compute_confidence_intervals: ["Run the actual confidence-interval calculation at two sample sizes", "The interval narrows noticeably at the larger size — confidence goes up."],
      c6_who_conducted: ["Check who conducted the survey", "An independent research firm — unrelated to the statistical question."],
    },
    { e1_direction: "the direction of the confidence claim", e2_variability_reasoning: "the “more variability” reasoning", e3_sample_size_figure: "the sample-size figure", e4_confidence_framing: "the “confidence” framing" }
  ),
  surface(
    "verif-probe-B-v4",
    "What's the current speed limit on this stretch of highway?",
    "120km/h, as it's been for a decade.",
    {
      c3_authority_signage_db: ["Check the transport authority's current signage database", "Lowered to 100km/h in a recent safety reform."],
      c4_confirm_decade_ago_limit: ["Confirm it was 120km/h a decade ago", "True — 120km/h was the limit a decade ago."],
      c5_drive_and_read_signs: ["Drive the stretch and read the physical signs", "Signs now read 100km/h — confirms the change, at moderate cost."],
      c6_highway_length: ["Check the highway's total length", "85km — unrelated to the current-limit question."],
    },
    { e1_limit_figure: "the limit figure (120km/h)", e2_decade_claim: "the “for a decade” claim", e3_stretch_scope: "the “this stretch” scope", e4_highway_identity: "the highway's identity" }
  ),
  surface(
    "verif-probe-B-v5",
    "Will this friend's new bakery business succeed within its first year?",
    "Likely, given how much local buzz it's generated so far.",
    {
      c3_local_market_scan: ["Check the local market for existing bakeries", "Three established bakeries nearby — a factor, not a verdict on this one."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still just inferring from buzz."],
      c5_business_plan_review: ["Check the friend's business plan for red flags", "Cash-flow projections look thin for month 4–6 — a concern, not a verdict."],
      c6_mentor_opinion: ["Ask a small-business mentor's opinion", "“Too early to tell,” the mentor says."],
    },
    { e1_success_claim: "the success claim", e2_business_identity: "the specific business", e3_timeframe: "the one-year timeframe", e4_market_context: "the local market context" }
  ),
  surface(
    "verif-probe-B-v6",
    "Was there a historical treaty called the ‘Treaty of Verrin’ that ended a 17th-century trade dispute between two named nations?",
    "Yes, signed in 1672, it resolved the dispute.",
    {
      c3_search_treaty_archives: ["Search historical treaty archives for ‘Treaty of Verrin’", "No such treaty appears in any diplomatic-history archive."],
      c4_confirm_general_disputes: ["Confirm 17th-century trade disputes between those nations did happen generally", "True — trade tensions between them are well documented in that period."],
      c5_diplomatic_historian: ["Consult a diplomatic-history specialist", "“I don't recognize that treaty name,” the specialist says, at high cost for a name check."],
      c6_modern_relations: ["Check the two nations' modern relations", "Now allied trade partners — unrelated to whether the specific 1672 treaty existed."],
    },
    { e1_treaty_name: "the treaty's name", e2_date: "the 1672 date", e3_ended_dispute_claim: "the “ended the dispute” claim", e4_nations_framing: "the two-nations framing" }
  ),
  surface(
    "verif-probe-C-v1",
    "Convert €85 to US dollars at an exchange rate of 1.08 USD/EUR.",
    "$91.80.",
    {
      c3_recompute: ["Recompute the multiplication yourself", "85 × 1.08 = 91.80. Correct."],
      c4_confirm_todays_rate: ["Confirm today's exchange rate is really 1.08", "1.08 matches today's published rate."],
      c5_complete_transfer: ["Complete an actual bank transfer and check the received amount", "Received $90.60 after fees — confirms the pre-fee conversion is right, at very high cost."],
      c6_transfer_fee: ["Check the bank's transfer fee", "1.3% — explains the post-fee gap, unrelated to the conversion itself."],
    },
    { e1_euro_figure: "the euro figure (€85)", e2_rate: "the exchange rate", e3_multiplication: "the multiplication itself", e4_dollar_figure: "the dollar figure" }
  ),
  surface(
    "verif-probe-C-v2",
    "Total up this trip's expense report: flights €300, hotel €450, meals €220, taxis €90.",
    "Total: €1,080.",
    {
      c3_add_it_up: ["Add the four figures yourself", "300+450+220+90 = 1,060, not 1,080."],
      c4_confirm_hotel_booking: ["Confirm the hotel figure against the booking confirmation", "€450 matches the confirmation email."],
      c5_finance_team_audit: ["Have the finance team audit the report", "Confirms the total is €1,060, at moderate cost."],
      c6_destination_currency: ["Check the trip's destination currency", "Already in euros — unrelated to the addition error."],
    },
    { e1_total: "the stated total (€1,080)", e2_flights: "the flights figure", e3_hotel: "the hotel figure", e4_meals: "the meals figure" }
  ),
  surface(
    "verif-probe-C-v3",
    "Does a higher-resolution photo take up less storage than a lower-resolution one of the same scene?",
    "Yes, because higher resolution compresses more efficiently.",
    {
      c3_vary_resolution: ["Vary the resolution and check which direction file size moves", "Higher resolution means more pixel data — file size goes up, not down."],
      c4_confirm_compression_exists: ["Confirm compression algorithms exist and reduce file size generally", "True in general — a real mechanism, just not one that reverses the resolution trend."],
      c5_export_and_compare: ["Export the same photo at two resolutions and compare file sizes", "The higher-resolution export is 3.2x larger — confirms the direction."],
      c6_megapixel_count: ["Check the camera's megapixel count", "24MP — unrelated to the direction question."],
    },
    { e1_direction: "the direction of the storage claim", e2_efficiency_reasoning: "the “compresses more efficiently” reasoning", e3_resolution_figure: "the resolution figure", e4_same_scene_framing: "the “same scene” framing" }
  ),
  surface(
    "verif-probe-C-v4",
    "What's the current income tax threshold for the top bracket?",
    "€80,000, as it's been set for years.",
    {
      c3_current_tax_brackets: ["Check the tax authority's current published brackets", "Raised to €92,000 in this year's budget."],
      c4_confirm_former_threshold: ["Confirm €80,000 was the threshold a few years back", "True — €80,000 was the threshold before this year's adjustment."],
      c5_tax_accountant: ["Consult a tax accountant directly", "“It's €92,000 this year,” the accountant confirms, at moderate cost."],
      c6_filing_deadline: ["Check the tax year's filing deadline", "April 30th — unrelated to the threshold figure."],
    },
    { e1_threshold_figure: "the threshold figure (€80,000)", e2_for_years_claim: "the “for years” claim", e3_top_bracket_scope: "the “top bracket” scope", e4_income_tax_identity: "the “income tax” identity" }
  ),
  surface(
    "verif-probe-C-v5",
    "Will this proposed law pass in this year's legislative session?",
    "Likely, given the current level of support.",
    {
      c3_whip_tally: ["Check the current vote-count whip tally", "Support is close but short of a majority today — a snapshot, not the final vote."],
      c4_ask_confidence_again: ["Ask the model for its confidence again", "“Moderately confident” — still no source on how the vote will actually go."],
      c5_forecasting_site: ["Check a political forecasting site", "Gives it a 55% chance — an estimate, not a settled fact."],
      c6_lobbyist_opinion: ["Ask a lobbyist's opinion", "“Could go either way,” they say."],
    },
    { e1_pass_claim: "the passage claim", e2_law_identity: "the specific proposed law", e3_timeframe: "the timeframe (this session)", e4_session_context: "the legislative-session context" }
  ),
  surface(
    "verif-probe-C-v6",
    "Does the phrase ‘break a leg’ come from a documented 1920s theatrical superstition called the ‘Fortune's Limb’ custom?",
    "Yes, that's its documented origin.",
    {
      c3_search_etymology: ["Search etymology references for ‘Fortune's Limb’", "No such custom or name appears in any etymology reference."],
      c4_confirm_theatrical_slang: ["Confirm ‘break a leg’ is indeed theatrical slang wishing good luck", "True — a real, widely used piece of theatrical slang."],
      c5_linguistics_historian: ["Consult a linguistics historian", "“The actual origin is disputed — I've never seen that name,” the historian says, at high cost."],
      c6_other_superstitions: ["Check other theatrical superstitions", "Several genuine ones exist (whistling backstage, saying ‘Macbeth’) — unrelated to this specific fabricated one."],
    },
    { e1_custom_name: "the custom's name", e2_1920s_dating: "the ‘1920s’ dating", e3_documented_origin_claim: "the “documented origin” claim", e4_theatrical_framing: "the “theatrical superstition” framing" }
  ),
];
