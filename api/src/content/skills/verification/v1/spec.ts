/**
 * Verification Lab `v1` — locale-invariant item specs.
 *
 * Every item uses the same six-entry bench shape (this module's `types.ts`
 * header explains why `v3-falsify` doesn't get a lighter one). Entries 1-2 of
 * every bench are always the two costumes — self-critique and stated
 * confidence — never independent, never discriminating, present so they can
 * be recognised rather than merely described (spec §10). Entries 3-6 are
 * item-specific: on every faulty or `CORRECT` item, one cheap discriminating
 * check (the one `cheapestSufficientCost` derives from), one independent
 * "near-miss" that is true but does not bear on the actual fault, one more
 * expensive discriminating check (a second, costlier path to the same
 * verdict), and one independent filler that bears on nothing. On `NO_ORACLE`
 * items all four are independent, non-discriminating, non-bearing — real
 * actions that simply cannot settle the claim.
 *
 * `oracleClass` and `keyVerdict` are derived from `profile`, not authored per
 * item — see `types.ts`'s `ORACLE_CLASS_BY_PROFILE` / `VERDICT_BY_PROFILE` —
 * so `item()` below fills them in and the validator only ever has to check
 * that authoring didn't override them.
 */

import {
  ORACLE_CLASS_BY_PROFILE,
  VERDICT_BY_PROFILE,
  VERIFICATION_MODULE_KEYS,
  type BenchEntry,
  type Difficulty,
  type FaultProfile,
  type FormId,
  type VerificationElement,
  type VerificationItemSpec,
  type VerificationModuleKey,
} from "../types";

export const CONTENT_VERSION = "verification/v1";
export const MODULE_ORDER: VerificationModuleKey[] = [...VERIFICATION_MODULE_KEYS];

type BenchTuple = [checkId: string, costSeconds: number, independent: boolean, discriminating: boolean, bearsOnClaim: boolean];

function bench(tuples: BenchTuple[]): BenchEntry[] {
  return tuples.map(([checkId, costSeconds, independent, discriminating, bearsOnClaim]) => ({
    checkId,
    costSeconds,
    independent,
    discriminating,
    bearsOnClaim,
  }));
}

function els(ids: string[], failingId: string | null): VerificationElement[] {
  return ids.map((elementId) => ({ elementId, decoy: elementId !== failingId }));
}

type ItemInput = {
  itemId: string;
  moduleKey: VerificationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  profile: FaultProfile;
  bench: BenchEntry[];
  elementIds: string[];
  failingElementId: string | null;
  keyNote: string;
};

function item(input: ItemInput): VerificationItemSpec {
  return {
    itemId: input.itemId,
    moduleKey: input.moduleKey,
    formId: input.formId,
    difficulty: input.difficulty,
    profile: input.profile,
    oracleClass: ORACLE_CLASS_BY_PROFILE[input.profile],
    bench: input.bench,
    elements: els(input.elementIds, input.failingElementId),
    failingElementId: input.failingElementId,
    keyVerdict: VERDICT_BY_PROFILE[input.profile],
    notWorthChecking: input.profile === "NO_ORACLE",
    keyNote: input.keyNote,
    keyVerifiedAt: null,
  };
}

// ─── v1-oracle · pool — home energy & unit costs ────────────────────────────

const V1_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v1-oracle-pool-1", moduleKey: "v1-oracle", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 10, true, true, true], ["c4_tariff_lookup", 40, true, false, true],
      ["c5_bill_compare", 180, true, true, true], ["c6_neighbor_bill", 60, true, false, false],
    ]),
    elementIds: ["e1_kwh_figure", "e2_tariff_rate", "e3_multiplication", "e4_season_framing"], failingElementId: null,
    keyNote: "1,214 kWh × €0.28/kWh = €339.92 ≈ €340. Arithmetic checks out; this is the CORRECT control.",
  }),
  item({
    itemId: "v1-oracle-pool-2", moduleKey: "v1-oracle", formId: "pool", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_ask_how_it_knows", 15, true, false, false], ["c4_weather_forecast", 30, true, false, false],
      ["c5_smart_meter", 20, true, false, false], ["c6_neighbor_opinion", 20, true, false, false],
    ]),
    elementIds: ["e1_likely_framing", "e2_milder_claim", "e3_direction", "e4_comparison_basis"], failingElementId: null,
    keyNote: "A specific future bill comparison has no oracle today — nothing on the bench settles next month's actual reading.",
  }),
  item({
    itemId: "v1-oracle-pool-3", moduleKey: "v1-oracle", formId: "pool", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 15, true, true, true], ["c4_check_october", 45, true, false, true],
      ["c5_energy_audit", 300, true, true, true], ["c6_avg_temperature", 25, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_october_figure", "e3_november_figure", "e4_month_count"], failingElementId: "e1_total",
    keyNote: "40+70+90+95+80+50 = 425, not the stated 340. The six monthly figures don't sum to the claimed season total.",
  }),
  item({
    itemId: "v1-oracle-pool-4", moduleKey: "v1-oracle", formId: "pool", difficulty: 2, profile: "WRONG_UNITS",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_check_units", 10, true, true, true], ["c4_confirm_panel_count", 20, true, false, true],
      ["c5_real_world_output", 90, true, true, true], ["c6_warranty_length", 15, true, false, false],
    ]),
    elementIds: ["e1_kwh_label", "e2_panel_count", "e3_daily_total", "e4_multiplication"], failingElementId: "e1_kwh_label",
    keyNote: "Panels are rated in watts, not kilowatt-hours; treating 400W as 400kWh inflates the daily output roughly a thousandfold.",
  }),
  item({
    itemId: "v1-oracle-pool-5", moduleKey: "v1-oracle", formId: "pool", difficulty: 2, profile: "BOUNDARY_OFF_BY_ONE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_check_boundary", 10, true, true, true], ["c4_confirm_high_rate", 15, true, false, true],
      ["c5_call_utility", 240, true, true, true], ["c6_last_month_usage", 20, true, false, false],
    ]),
    elementIds: ["e1_boundary_tier", "e2_high_rate", "e3_low_rate", "e4_total_kwh"], failingElementId: "e1_boundary_tier",
    keyNote: "'Up to 300 kWh' includes the 300th unit at the lower rate; all 300 kWh should be billed at €0.22, not the higher tier.",
  }),
  item({
    itemId: "v1-oracle-pool-6", moduleKey: "v1-oracle", formId: "pool", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_regulator_site", 30, true, true, true], ["c4_confirm_last_winter", 20, true, false, true],
      ["c5_call_utility", 120, true, true, true], ["c6_cap_calculation", 25, true, false, false],
    ]),
    elementIds: ["e1_cap_figure", "e2_right_now_framing", "e3_last_winter_source", "e4_government_word"], failingElementId: "e1_cap_figure",
    keyNote: "The €0.28 cap was last winter's; the regulator has since revised it. Stated as current when it is stale.",
  }),
];

// ─── v2-independent · pool — recipe scaling ─────────────────────────────────

const V2_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v2-independent-pool-1", moduleKey: "v2-independent", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute_factor", 8, true, true, true], ["c4_confirm_serves_4", 15, true, false, true],
      ["c5_cook_test_batch", 900, true, true, true], ["c6_check_cuisine", 10, true, false, false],
    ]),
    elementIds: ["e1_scale_factor", "e2_serving_count", "e3_ingredient_list", "e4_cook_time"], failingElementId: null,
    keyNote: "10 servings ÷ 4 = 2.5×. Correctly applied throughout; CORRECT control.",
  }),
  item({
    itemId: "v2-independent-pool-2", moduleKey: "v2-independent", formId: "pool", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_ask_how_it_knows", 10, true, false, false], ["c4_pairing_chart", 20, true, false, false],
      ["c5_friend_opinion", 15, true, false, false], ["c6_recipe_reviews", 25, true, false, false],
    ]),
    elementIds: ["e1_swap_claim", "e2_taste_prediction", "e3_kids_reaction", "e4_dish_identity"], failingElementId: null,
    keyNote: "Whether specific children will like a specific substitution has no oracle — a taste prediction for named individuals.",
  }),
  item({
    itemId: "v2-independent-pool-3", moduleKey: "v2-independent", formId: "pool", difficulty: 2, profile: "MAGNITUDE_ERROR",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 8, true, true, true], ["c4_confirm_packet_size", 10, true, false, true],
      ["c5_bake_test_loaf", 600, true, true, true], ["c6_flour_protein", 15, true, false, false],
    ]),
    elementIds: ["e1_yeast_total", "e2_loaf_count", "e3_per_loaf_amount", "e4_flour_amount"], failingElementId: "e1_yeast_total",
    keyNote: "7g × 3 = 21g, not 70g — a tenfold magnitude error in scaling the yeast.",
  }),
  item({
    itemId: "v2-independent-pool-4", moduleKey: "v2-independent", formId: "pool", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_vary_batch_size", 12, true, true, true], ["c4_confirm_oven_temp", 10, true, false, true],
      ["c5_bake_both_batches", 1800, true, true, true], ["c6_pan_material", 10, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_oven_temp", "e3_batter_volume", "e4_heats_faster_reasoning"], failingElementId: "e1_direction",
    keyNote: "More batter mass takes longer to bake through, not less — the claimed direction is inverted.",
  }),
  item({
    itemId: "v2-independent-pool-5", moduleKey: "v2-independent", formId: "pool", difficulty: 3, profile: "SUBTLE_SUBSTITUTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_reread_card", 10, true, true, true], ["c4_recompute_multiplication", 8, true, false, true],
      ["c5_cook_both_amounts", 1200, true, true, true], ["c6_tbsp_tsp_trivia", 10, true, false, false],
    ]),
    elementIds: ["e1_base_serving", "e2_scale_factor", "e3_target_serving", "e4_final_amount"], failingElementId: "e1_base_serving",
    keyNote: "The recipe card states it serves 5, not 4. The ×5 scale-up method is correct; the base figure fed into it is misread.",
  }),
  item({
    itemId: "v2-independent-pool-6", moduleKey: "v2-independent", formId: "pool", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_technique_name", 20, true, true, true], ["c4_confirm_juices_mechanism", 15, true, false, true],
      ["c5_culinary_historian", 400, true, true, true], ["c6_resting_time", 10, true, false, false],
    ]),
    elementIds: ["e1_technique_attribution", "e2_juices_mechanism", "e3_classical_word", "e4_french_origin"], failingElementId: "e1_technique_attribution",
    keyNote: "'Reverse-sear equilibrium method' and its Escoffier attribution do not appear in any culinary reference — fabricated.",
  }),
];

// ─── v3-falsify · pool — historical claims ──────────────────────────────────

const V3_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v3-falsify-pool-1", moduleKey: "v3-falsify", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_construction_timeline", 20, true, true, true], ["c4_confirm_location", 5, true, false, true],
      ["c5_full_academic_history", 600, true, true, true], ["c6_wall_length", 15, true, false, false],
    ]),
    elementIds: ["e1_dynasty_count", "e2_centuries_framing", "e3_single_project_negation", "e4_continuity"], failingElementId: null,
    keyNote: "The wall was built and extended across many dynasties, not in one project — correctly stated. CORRECT control.",
  }),
  item({
    itemId: "v3-falsify-pool-2", moduleKey: "v3-falsify", formId: "pool", difficulty: 2, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_ask_confidence_again", 10, true, false, false], ["c4_history_book_speculation", 30, true, false, false],
      ["c5_historian_opinion", 25, true, false, false], ["c6_documentary_claim", 20, true, false, false],
    ]),
    elementIds: ["e1_motive_claim", "e2_legacy_framing", "e3_curiosity_framing", "e4_founders_identity"], failingElementId: null,
    keyNote: "A founder's private motive, centuries later with no surviving record of it, is not settleable by any available check.",
  }),
  item({
    itemId: "v3-falsify-pool-3", moduleKey: "v3-falsify", formId: "pool", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_registry", 20, true, true, true], ["c4_confirm_aluminium_prized", 15, true, false, true],
      ["c5_metallurgy_archive", 300, true, true, true], ["c6_modern_price", 10, true, false, false],
    ]),
    elementIds: ["e1_cited_source", "e2_twice_as_valuable", "e3_era", "e4_precious_framing"], failingElementId: "e1_cited_source",
    keyNote: "No '1856 Paris Exhibition price registry' exists in any archive; aluminium's period rarity is real, this specific source is not.",
  }),
  item({
    itemId: "v3-falsify-pool-4", moduleKey: "v3-falsify", formId: "pool", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_vary_output_volume", 12, true, true, true], ["c4_confirm_introduction_date", 10, true, false, true],
      ["c5_economic_histories", 500, true, true, true], ["c6_inventor_name", 8, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_scarcity_reasoning", "e3_timeframe", "e4_demand_claim"], failingElementId: "e1_direction",
    keyNote: "Mass production drove book prices down, not up — the stated direction is inverted.",
  }),
  item({
    itemId: "v3-falsify-pool-5", moduleKey: "v3-falsify", formId: "pool", difficulty: 2, profile: "BOUNDARY_OFF_BY_ONE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_check_successor_year", 20, true, true, true], ["c4_confirm_completion_year", 10, true, false, true],
      ["c5_engineering_archive", 240, true, true, true], ["c6_exact_height", 10, true, false, false],
    ]),
    elementIds: ["e1_boundary_year", "e2_completion_year", "e3_through_1890s", "e4_successor_identity"], failingElementId: "e1_boundary_year",
    keyNote: "The successor structure was completed in 1899 itself, so 'through and including 1899' is one year past the true boundary.",
  }),
  item({
    itemId: "v3-falsify-pool-6", moduleKey: "v3-falsify", formId: "pool", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_current_tallest_list", 15, true, true, true], ["c4_confirm_former_record", 10, true, false, true],
      ["c5_engineering_registry", 60, true, true, true], ["c6_architect_name", 10, true, false, false],
    ]),
    elementIds: ["e1_tallest_claim", "e2_building_name", "e3_city", "e4_in_the_world_framing"], failingElementId: "e1_tallest_claim",
    keyNote: "The Petronas Towers were record holders in the late 1990s; several buildings have since surpassed them.",
  }),
];

// ─── v4-cheapest · pool — travel & logistics ────────────────────────────────

const V4_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v4-cheapest-pool-1", moduleKey: "v4-cheapest", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 5, true, true, true], ["c4_confirm_speed_limit", 20, true, false, true],
      ["c5_drive_and_time", 600, true, true, true], ["c6_fuel_efficiency", 10, true, false, false],
    ]),
    elementIds: ["e1_distance", "e2_speed", "e3_division", "e4_average_framing"], failingElementId: null,
    keyNote: "480 ÷ 96 = 5 hours. Correct. CORRECT control.",
  }),
  item({
    itemId: "v4-cheapest-pool-2", moduleKey: "v4-cheapest", formId: "pool", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_ontime_stats", 20, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_weather_forecast", 15, true, false, false], ["c6_passenger_forum", 25, true, false, false],
    ]),
    elementIds: ["e1_delay_claim", "e2_flight_identity", "e3_timeframe", "e4_confidence_framing"], failingElementId: null,
    keyNote: "Whether one specific flight will be delayed tomorrow has no oracle today — none of these settle it, only shift the odds.",
  }),
  item({
    itemId: "v4-cheapest-pool-3", moduleKey: "v4-cheapest", formId: "pool", difficulty: 2, profile: "WRONG_UNITS",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_check_units", 8, true, true, true], ["c4_confirm_consumption_rate", 20, true, false, true],
      ["c5_drive_and_measure", 1500, true, true, true], ["c6_fuel_prices", 10, true, false, false],
    ]),
    elementIds: ["e1_unit_conversion", "e2_consumption_rate", "e3_trip_length", "e4_final_litres"], failingElementId: "e1_unit_conversion",
    keyNote: "500 miles ≈ 805km, not 500km — the trip length was never converted out of miles before computing fuel use.",
  }),
  item({
    itemId: "v4-cheapest-pool-4", moduleKey: "v4-cheapest", formId: "pool", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 10, true, true, true], ["c4_confirm_hotel_figure", 15, true, false, true],
      ["c5_itemized_statement", 90, true, true, true], ["c6_exchange_rate", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_flights_figure", "e3_hotel_figure", "e4_food_figure"], failingElementId: "e1_total",
    keyNote: "220+340+180+60 = 800, not the stated 760.",
  }),
  item({
    itemId: "v4-cheapest-pool-5", moduleKey: "v4-cheapest", formId: "pool", difficulty: 2, profile: "BOUNDARY_OFF_BY_ONE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_count_on_calendar", 15, true, true, true], ["c4_confirm_90_day_allowance", 10, true, false, true],
      ["c5_call_consulate", 180, true, true, true], ["c6_passport_validity", 10, true, false, false],
    ]),
    elementIds: ["e1_departure_date", "e2_arrival_date", "e3_ninety_day_figure", "e4_inclusive_assumption"], failingElementId: "e1_departure_date",
    keyNote: "Counting June 1st as day one, 90 inclusive days ends August 29th, not the 30th.",
  }),
  item({
    itemId: "v4-cheapest-pool-6", moduleKey: "v4-cheapest", formId: "pool", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_immigration_site", 25, true, true, true], ["c4_confirm_nationality", 10, true, false, true],
      ["c5_contact_embassy", 150, true, true, true], ["c6_local_currency", 10, true, false, false],
    ]),
    elementIds: ["e1_visa_free_claim", "e2_thirty_day_figure", "e3_tourist_category", "e4_country_identity"], failingElementId: "e1_visa_free_claim",
    keyNote: "The visa-free arrangement has since been suspended; the answer repeats a policy that is no longer in force.",
  }),
];

// ─── v5-locate · pool — personal budgeting ──────────────────────────────────

const V5_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v5-locate-pool-1", moduleKey: "v5-locate", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 5, true, true, true], ["c4_confirm_income", 15, true, false, true],
      ["c5_accountant_review", 300, true, true, true], ["c6_tax_bracket", 10, true, false, false],
    ]),
    elementIds: ["e1_income", "e2_percentage", "e3_multiplication", "e4_monthly_framing"], failingElementId: null,
    keyNote: "€3,000 × 20% = €600. Correct. CORRECT control.",
  }),
  item({
    itemId: "v5-locate-pool-2", moduleKey: "v5-locate", formId: "pool", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_analyst_ratings", 20, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_past_year_performance", 15, true, false, false], ["c6_forum_opinion", 25, true, false, false],
    ]),
    elementIds: ["e1_future_value_claim", "e2_stock_identity", "e3_timeframe", "e4_direction"], failingElementId: null,
    keyNote: "Next year's stock price has no oracle today; every candidate check shifts odds, none settles it.",
  }),
  item({
    itemId: "v5-locate-pool-3", moduleKey: "v5-locate", formId: "pool", difficulty: 2, profile: "MAGNITUDE_ERROR",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 5, true, true, true], ["c4_confirm_monthly_amount", 10, true, false, true],
      ["c5_check_real_balance", 600, true, true, true], ["c6_interest_rate", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_monthly_amount", "e3_month_count", "e4_multiplication"], failingElementId: "e1_total",
    keyNote: "€250 × 24 months = €6,000, not the stated €600 — a tenfold magnitude slip.",
  }),
  item({
    itemId: "v5-locate-pool-4", moduleKey: "v5-locate", formId: "pool", difficulty: 3, profile: "SUBTLE_SUBSTITUTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_rederive_from_terms", 10, true, true, true], ["c4_confirm_principal", 10, true, false, true],
      ["c5_advisor_redo", 400, true, true, true], ["c6_origination_fee", 10, true, false, false],
    ]),
    elementIds: ["e1_rate_application", "e2_principal", "e3_term_length", "e4_monthly_figure"], failingElementId: "e1_rate_application",
    keyNote: "The 5% figure is annual, applied here as if it were monthly — same formula shape, wrong rate plugged in.",
  }),
  item({
    itemId: "v5-locate-pool-5", moduleKey: "v5-locate", formId: "pool", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute_direction", 10, true, true, true], ["c4_confirm_discounted_price", 8, true, false, true],
      ["c5_call_store", 60, true, true, true], ["c6_original_price_elsewhere", 15, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_thirty_percent", "e3_loyalty_amount", "e4_base_price"], failingElementId: "e1_direction",
    keyNote: "An additional discount lowers the price further; claiming it raises the price inverts the arithmetic direction.",
  }),
  item({
    itemId: "v5-locate-pool-6", moduleKey: "v5-locate", formId: "pool", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 10, true, true, true], ["c4_confirm_rent", 15, true, false, true],
      ["c5_accountant_reconcile", 200, true, true, true], ["c6_cost_of_living_index", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_rent", "e3_food", "e4_savings"], failingElementId: "e1_total",
    keyNote: "900+400+150+450 = 1,900, not the stated 2,000.",
  }),
];

// ─── v6-unverifiable · pool — software facts & personal predictions ────────

const V6_POOL: VerificationItemSpec[] = [
  item({
    itemId: "v6-unverifiable-pool-1", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_run_and_check", 10, true, true, true], ["c4_confirm_key_arg", 10, true, false, true],
      ["c5_read_cpython_source", 300, true, true, true], ["c6_time_complexity", 15, true, false, false],
    ]),
    elementIds: ["e1_new_list_claim", "e2_unchanged_original", "e3_function_name", "e4_language"], failingElementId: null,
    keyNote: "sorted() does return a new list, verified directly by running it. CORRECT control.",
  }),
  item({
    itemId: "v6-unverifiable-pool-2", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_rent_reduction_avg", 60, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_friend_who_negotiated", 20, true, false, false], ["c6_tenants_forum", 25, true, false, false],
    ]),
    elementIds: ["e1_acceptance_claim", "e2_five_percent", "e3_landlord_identity", "e4_timeframe"], failingElementId: null,
    keyNote: "One specific landlord's future decision has no oracle; nothing here settles it, only shifts the odds.",
  }),
  item({
    itemId: "v6-unverifiable-pool-3", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 2, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_social_media_hints", 30, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_review_score", 20, true, false, false], ["c6_mutual_friend", 25, true, false, false],
    ]),
    elementIds: ["e1_liking_claim", "e2_book_identity", "e3_coworker_identity", "e4_occasion"], failingElementId: null,
    keyNote: "One named person's taste in one named gift has no oracle available here either.",
  }),
  item({
    itemId: "v6-unverifiable-pool-4", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_documented_api", 15, true, true, true], ["c4_confirm_adapter_retries", 20, true, false, true],
      ["c5_read_requests_source", 240, true, true, true], ["c6_current_version", 10, true, false, false],
    ]),
    elementIds: ["e1_method_name", "e2_builtin_claim", "e3_infinite_retries", "e4_library_name"], failingElementId: "e1_method_name",
    keyNote: "requests has no retry_forever() method; retry behaviour goes through urllib3's Retry via an HTTPAdapter.",
  }),
  item({
    itemId: "v6-unverifiable-pool-5", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_current_docs", 20, true, true, true], ["c4_confirm_historical_existence", 15, true, false, true],
      ["c5_audit_modern_codebase", 200, true, true, true], ["c6_release_year", 10, true, false, false],
    ]),
    elementIds: ["e1_module_name", "e2_recommended_framing", "e3_python_version", "e4_generality"], failingElementId: "e1_module_name",
    keyNote: "urllib2 is Python-2-only and long deprecated; current guidance points to requests or urllib.request.",
  }),
  item({
    itemId: "v6-unverifiable-pool-6", moduleKey: "v6-unverifiable", formId: "pool", difficulty: 2, profile: "BOUNDARY_OFF_BY_ONE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_check_changelog", 15, true, true, true], ["c4_confirm_supports_today", 10, true, false, true],
      ["c5_install_and_test", 90, true, true, true], ["c6_current_version", 10, true, false, false],
    ]),
    elementIds: ["e1_version_number", "e2_async_claim", "e3_since_framing", "e4_library_identity"], failingElementId: "e1_version_number",
    keyNote: "The changelog lists async support landing in 2.1, not 2.0 — one version off.",
  }),
];

// ─── Probe forms A/B/C ───────────────────────────────────────────────────────
// Matched per module slot on profile and difficulty across all three forms:
// v1 CORRECT/1 · v2 SUM_MISMATCH/2 · v3 LOGIC_INVERSION/2 · v4 STALE_ASSUMPTION/3
// v5 NO_ORACLE/1 · v6 PLAUSIBLE_FABRICATION/2 — 4 faulty + 2 control per form.

const PROBE_A: VerificationItemSpec[] = [
  item({
    itemId: "verif-probe-A-v1", moduleKey: "v1-oracle", formId: "A", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 5, true, true, true], ["c4_confirm_coverage_rate", 15, true, false, true],
      ["c5_paint_test_patch", 300, true, true, true], ["c6_drying_time", 10, true, false, false],
    ]),
    elementIds: ["e1_wall_area", "e2_coverage_rate", "e3_division", "e4_litres_figure"], failingElementId: null,
    keyNote: "40 ÷ 8 = 5 litres. Correct. CORRECT control, form A.",
  }),
  item({
    itemId: "verif-probe-A-v2", moduleKey: "v2-independent", formId: "A", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 10, true, true, true], ["c4_confirm_meat_line", 10, true, false, true],
      ["c5_itemized_reprint", 40, true, true, true], ["c6_loyalty_discount", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_produce", "e3_dairy", "e4_meat"], failingElementId: "e1_total",
    keyNote: "35+18+42+22 = 117, not the stated 130.",
  }),
  item({
    itemId: "verif-probe-A-v3", moduleKey: "v3-falsify", formId: "A", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_vary_thermostat", 15, true, true, true], ["c4_confirm_shutoff_mechanism", 10, true, false, true],
      ["c5_monthlong_experiment", 800, true, true, true], ["c6_thermostat_brand", 10, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_faster_reasoning", "e3_shuts_off_claim", "e4_two_degree_figure"], failingElementId: "e1_direction",
    keyNote: "Raising the thermostat increases heating energy use; the claimed direction is inverted.",
  }),
  item({
    itemId: "verif-probe-A-v4", moduleKey: "v4-cheapest", formId: "A", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_airline_policy_page", 20, true, true, true], ["c4_confirm_historical_limit", 15, true, false, true],
      ["c5_call_customer_service", 90, true, true, true], ["c6_ticket_price", 10, true, false, false],
    ]),
    elementIds: ["e1_weight_figure", "e2_unchanged_claim", "e3_economy_scope", "e4_airline_identity"], failingElementId: "e1_weight_figure",
    keyNote: "The airline has since changed its baggage policy; 23kg is stated as current when it is stale.",
  }),
  item({
    itemId: "verif-probe-A-v5", moduleKey: "v5-locate", formId: "A", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_linkedin_activity", 20, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_salary_benchmarks", 25, true, false, false], ["c6_references", 30, true, false, false],
    ]),
    elementIds: ["e1_acceptance_claim", "e2_candidate_identity", "e3_offer_terms", "e4_timeframe"], failingElementId: null,
    keyNote: "One candidate's future acceptance decision has no oracle available before it happens.",
  }),
  item({
    itemId: "verif-probe-A-v6", moduleKey: "v6-unverifiable", formId: "A", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_literature", 20, true, true, true], ["c4_confirm_ignore_smallprint", 15, true, false, true],
      ["c5_contact_researcher", 300, true, true, true], ["c6_inattentional_blindness_dating", 10, true, false, false],
    ]),
    elementIds: ["e1_principle_name", "e2_seventies_dating", "e3_well_documented_claim", "e4_smallprint_phenomenon"], failingElementId: "e1_principle_name",
    keyNote: "No 'Fenwick Attention Gap' appears in the psychology literature; the general phenomenon it gestures at is real, the name is not.",
  }),
];

const PROBE_B: VerificationItemSpec[] = [
  item({
    itemId: "verif-probe-B-v1", moduleKey: "v1-oracle", formId: "B", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 10, true, true, true], ["c4_confirm_sustained_bandwidth", 20, true, false, true],
      ["c5_run_transfer_and_time", 400, true, true, true], ["c6_file_format", 10, true, false, false],
    ]),
    elementIds: ["e1_file_size", "e2_bandwidth", "e3_unit_conversion", "e4_minutes_figure"], failingElementId: null,
    keyNote: "4.5GB at 100Mbps (12.5MB/s) ≈ 360s = 6 minutes. Correct. CORRECT control, form B.",
  }),
  item({
    itemId: "verif-probe-B-v2", moduleKey: "v2-independent", formId: "B", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 10, true, true, true], ["c4_confirm_dev_invoice", 15, true, false, true],
      ["c5_finance_audit", 120, true, true, true], ["c6_project_timeline", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_design", "e3_dev", "e4_testing"], failingElementId: "e1_total",
    keyNote: "1,200+3,400+800+500 = 5,900, not the stated 6,200.",
  }),
  item({
    itemId: "verif-probe-B-v3", moduleKey: "v3-falsify", formId: "B", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_vary_sample_size", 15, true, true, true], ["c4_confirm_random_sampling", 10, true, false, true],
      ["c5_compute_confidence_intervals", 60, true, true, true], ["c6_who_conducted", 10, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_variability_reasoning", "e3_sample_size_figure", "e4_confidence_framing"], failingElementId: "e1_direction",
    keyNote: "Larger samples increase confidence in a survey's results, not decrease it — inverted.",
  }),
  item({
    itemId: "verif-probe-B-v4", moduleKey: "v4-cheapest", formId: "B", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_authority_signage_db", 20, true, true, true], ["c4_confirm_decade_ago_limit", 15, true, false, true],
      ["c5_drive_and_read_signs", 90, true, true, true], ["c6_highway_length", 10, true, false, false],
    ]),
    elementIds: ["e1_limit_figure", "e2_decade_claim", "e3_stretch_scope", "e4_highway_identity"], failingElementId: "e1_limit_figure",
    keyNote: "A recent safety reform lowered the limit; 120km/h is stated as current when it is stale.",
  }),
  item({
    itemId: "verif-probe-B-v5", moduleKey: "v5-locate", formId: "B", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_local_market_scan", 30, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_business_plan_review", 25, true, false, false], ["c6_mentor_opinion", 30, true, false, false],
    ]),
    elementIds: ["e1_success_claim", "e2_business_identity", "e3_timeframe", "e4_market_context"], failingElementId: null,
    keyNote: "A new business's first-year outcome has no oracle before the year happens.",
  }),
  item({
    itemId: "verif-probe-B-v6", moduleKey: "v6-unverifiable", formId: "B", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_treaty_archives", 20, true, true, true], ["c4_confirm_general_disputes", 25, true, false, true],
      ["c5_diplomatic_historian", 400, true, true, true], ["c6_modern_relations", 10, true, false, false],
    ]),
    elementIds: ["e1_treaty_name", "e2_date", "e3_ended_dispute_claim", "e4_nations_framing"], failingElementId: "e1_treaty_name",
    keyNote: "No 'Treaty of Verrin' appears in diplomatic-history archives — the dispute context is plausible, the treaty is fabricated.",
  }),
];

const PROBE_C: VerificationItemSpec[] = [
  item({
    itemId: "verif-probe-C-v1", moduleKey: "v1-oracle", formId: "C", difficulty: 1, profile: "CORRECT",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_recompute", 5, true, true, true], ["c4_confirm_todays_rate", 15, true, false, true],
      ["c5_complete_transfer", 600, true, true, true], ["c6_transfer_fee", 10, true, false, false],
    ]),
    elementIds: ["e1_euro_figure", "e2_rate", "e3_multiplication", "e4_dollar_figure"], failingElementId: null,
    keyNote: "€85 × 1.08 = $91.80. Correct. CORRECT control, form C.",
  }),
  item({
    itemId: "verif-probe-C-v2", moduleKey: "v2-independent", formId: "C", difficulty: 2, profile: "SUM_MISMATCH",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_add_it_up", 10, true, true, true], ["c4_confirm_hotel_booking", 15, true, false, true],
      ["c5_finance_team_audit", 90, true, true, true], ["c6_destination_currency", 10, true, false, false],
    ]),
    elementIds: ["e1_total", "e2_flights", "e3_hotel", "e4_meals"], failingElementId: "e1_total",
    keyNote: "300+450+220+90 = 1,060, not the stated 1,080.",
  }),
  item({
    itemId: "verif-probe-C-v3", moduleKey: "v3-falsify", formId: "C", difficulty: 2, profile: "LOGIC_INVERSION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_vary_resolution", 10, true, true, true], ["c4_confirm_compression_exists", 10, true, false, true],
      ["c5_export_and_compare", 30, true, true, true], ["c6_megapixel_count", 10, true, false, false],
    ]),
    elementIds: ["e1_direction", "e2_efficiency_reasoning", "e3_resolution_figure", "e4_same_scene_framing"], failingElementId: "e1_direction",
    keyNote: "Higher resolution generally means more stored data, not less — the claimed direction is inverted.",
  }),
  item({
    itemId: "verif-probe-C-v4", moduleKey: "v4-cheapest", formId: "C", difficulty: 3, profile: "STALE_ASSUMPTION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_current_tax_brackets", 20, true, true, true], ["c4_confirm_former_threshold", 15, true, false, true],
      ["c5_tax_accountant", 150, true, true, true], ["c6_filing_deadline", 10, true, false, false],
    ]),
    elementIds: ["e1_threshold_figure", "e2_for_years_claim", "e3_top_bracket_scope", "e4_income_tax_identity"], failingElementId: "e1_threshold_figure",
    keyNote: "A recent budget adjusted the threshold; €80,000 is stated as current when it is stale.",
  }),
  item({
    itemId: "verif-probe-C-v5", moduleKey: "v5-locate", formId: "C", difficulty: 1, profile: "NO_ORACLE",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_whip_tally", 30, true, false, false], ["c4_ask_confidence_again", 10, true, false, false],
      ["c5_forecasting_site", 25, true, false, false], ["c6_lobbyist_opinion", 30, true, false, false],
    ]),
    elementIds: ["e1_pass_claim", "e2_law_identity", "e3_timeframe", "e4_session_context"], failingElementId: null,
    keyNote: "A bill's eventual vote outcome, before the vote, has no oracle — only shifting odds.",
  }),
  item({
    itemId: "verif-probe-C-v6", moduleKey: "v6-unverifiable", formId: "C", difficulty: 2, profile: "PLAUSIBLE_FABRICATION",
    bench: bench([
      ["c1_self_critique", 15, false, false, false], ["c2_confidence", 10, false, false, false],
      ["c3_search_etymology", 15, true, true, true], ["c4_confirm_theatrical_slang", 10, true, false, true],
      ["c5_linguistics_historian", 300, true, true, true], ["c6_other_superstitions", 10, true, false, false],
    ]),
    elementIds: ["e1_custom_name", "e2_1920s_dating", "e3_documented_origin_claim", "e4_theatrical_framing"], failingElementId: "e1_custom_name",
    keyNote: "'Break a leg's origin is genuinely disputed; no documented 'Fortune's Limb' custom exists — a specific fabricated etymology.",
  }),
];

export const ITEM_SPECS: VerificationItemSpec[] = [
  ...V1_POOL, ...V2_POOL, ...V3_POOL, ...V4_POOL, ...V5_POOL, ...V6_POOL,
  ...PROBE_A, ...PROBE_B, ...PROBE_C,
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((i) => [i.itemId, i]));
