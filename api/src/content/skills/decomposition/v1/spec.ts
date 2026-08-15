/**
 * Decomposition Lab — locale-invariant item specs, content version `decomposition/v1`.
 *
 * General-audience, everyday-life scenarios throughout (the subject-matter rule
 * inherited from Evidence `v2`, D-17): nothing here needs specialist background
 * to feel the problem. Every key is an authoring assertion until a human
 * re-checks it — `keyVerifiedAt: null` blocks probe use (validate.ts).
 *
 * Builder functions below exist only to keep 54 items readable; they assemble
 * the same `DecompositionItemSpec` shape by hand-authoring would produce.
 */

import {
  CRITERION_BY_FAULT,
  type DecompositionCriterionId,
  type DecompositionItemSpec,
  type DecompositionKey,
  type DecompositionModuleKey,
  type DecompositionPiece,
  type Difficulty,
  type FaultTag,
  type FormId,
  type SuppliedNodeSpec,
} from "../types";

export const CONTENT_VERSION = "decomposition/v1";

export const MODULE_ORDER: DecompositionModuleKey[] = [
  "d1-frame",
  "d2-breadth",
  "d3-seams",
  "d4-size",
  "d5-order",
  "d6-recompose",
];

const EMPTY_KEY: DecompositionKey = {
  pieces: [],
  requiredPieceIds: [],
  overlapPairs: [],
  blockingEdges: [],
  independentPairs: [],
};

/** A task that is already one checkable piece — the control, every module. */
function control(opts: {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  keyNote: string;
}): DecompositionItemSpec {
  return {
    itemId: opts.itemId,
    moduleKey: opts.moduleKey,
    formId: opts.formId,
    difficulty: opts.difficulty,
    type: "control",
    focusCriteria: ["D4"],
    key: EMPTY_KEY,
    keyNote: opts.keyNote,
    keyVerifiedAt: null,
  };
}

type RequiredPieceOpt = { id: string; atomic?: boolean; depth?: 1 | 2 };
type DecoyOpt = { id: string; depth?: 1 | 2 };

/** A palette of candidate pieces the learner selects and arranges — the probe instrument. */
function arrangementItem(opts: {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  focusCriteria: DecompositionCriterionId[];
  required: RequiredPieceOpt[];
  decoys: DecoyOpt[];
  overlapPairs?: [string, string][];
  blockingEdges?: [string, string][];
  independentPairs?: [string, string][];
  keyNote: string;
}): DecompositionItemSpec {
  const pieces: DecompositionPiece[] = [
    ...opts.required.map((r) => ({
      id: r.id,
      intendedDepth: r.depth ?? 1,
      atomic: r.atomic ?? true,
      decoy: false,
    })),
    ...opts.decoys.map((d) => ({ id: d.id, intendedDepth: d.depth ?? 1, atomic: false, decoy: true })),
  ];
  return {
    itemId: opts.itemId,
    moduleKey: opts.moduleKey,
    formId: opts.formId,
    difficulty: opts.difficulty,
    type: "arrangement",
    focusCriteria: opts.focusCriteria,
    key: {
      pieces,
      requiredPieceIds: opts.required.map((r) => r.id),
      overlapPairs: opts.overlapPairs ?? [],
      blockingEdges: opts.blockingEdges ?? [],
      independentPairs: opts.independentPairs ?? [],
    },
    keyNote: opts.keyNote,
    keyVerifiedAt: null,
  };
}

/** Free authoring from a scenario and a hidden required-element key. */
function breakdownItem(opts: {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  focusCriteria: DecompositionCriterionId[];
  required: RequiredPieceOpt[];
  overlapPairs?: [string, string][];
  blockingEdges?: [string, string][];
  independentPairs?: [string, string][];
  keyNote: string;
}): DecompositionItemSpec {
  const pieces: DecompositionPiece[] = opts.required.map((r) => ({
    id: r.id,
    intendedDepth: r.depth ?? 1,
    atomic: r.atomic ?? false,
    decoy: false,
  }));
  return {
    itemId: opts.itemId,
    moduleKey: opts.moduleKey,
    formId: opts.formId,
    difficulty: opts.difficulty,
    type: "breakdown",
    focusCriteria: opts.focusCriteria,
    key: {
      pieces,
      requiredPieceIds: opts.required.map((r) => r.id),
      overlapPairs: opts.overlapPairs ?? [],
      blockingEdges: opts.blockingEdges ?? [],
      independentPairs: opts.independentPairs ?? [],
    },
    keyNote: opts.keyNote,
    keyVerifiedAt: null,
  };
}

/** A supplied faulty breakdown with one seeded fault; the learner diagnoses, then fixes it. */
function repairItem(opts: {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  seededFault: FaultTag;
  suppliedTree: SuppliedNodeSpec[];
  required: RequiredPieceOpt[];
  blockingEdges?: [string, string][];
  independentPairs?: [string, string][];
  keyNote: string;
}): DecompositionItemSpec {
  const pieces: DecompositionPiece[] = opts.required.map((r) => ({
    id: r.id,
    intendedDepth: r.depth ?? 1,
    atomic: r.atomic ?? false,
    decoy: false,
  }));
  return {
    itemId: opts.itemId,
    moduleKey: opts.moduleKey,
    formId: opts.formId,
    difficulty: opts.difficulty,
    type: "repair",
    focusCriteria: [CRITERION_BY_FAULT[opts.seededFault]],
    key: {
      pieces,
      requiredPieceIds: opts.required.map((r) => r.id),
      overlapPairs: [],
      blockingEdges: opts.blockingEdges ?? [],
      independentPairs: opts.independentPairs ?? [],
    },
    suppliedTree: opts.suppliedTree,
    seededFault: opts.seededFault,
    keyNote: opts.keyNote,
    keyVerifiedAt: null,
  };
}

const sn = (id: string, parentId: string | null = null, depth: 1 | 2 = 1): SuppliedNodeSpec => ({
  id,
  parentId,
  depth,
});

export const ITEM_SPECS: DecompositionItemSpec[] = [
  // ── Probe form A ─────────────────────────────────────────────────────────
  arrangementItem({
    itemId: "dc-a1",
    moduleKey: "d1-frame",
    formId: "A",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [
      { id: "demo_old_fixtures" },
      { id: "buy_new_fixtures" },
      { id: "install_new_fixtures" },
      { id: "paint_and_finish" },
    ],
    decoys: [{ id: "monolith_renovate" }, { id: "clear_out_old_bathroom" }, { id: "repaint_hallway" }],
    overlapPairs: [["demo_old_fixtures", "clear_out_old_bathroom"]],
    blockingEdges: [
      ["demo_old_fixtures", "install_new_fixtures"],
      ["buy_new_fixtures", "install_new_fixtures"],
      ["install_new_fixtures", "paint_and_finish"],
    ],
    independentPairs: [["demo_old_fixtures", "buy_new_fixtures"]],
    keyNote:
      "Probe form A, d1 slot. Demo and buying fixtures don't depend on each other; both block installation, which blocks paint. The overlap decoy restates demo as a second piece.",
  }),
  arrangementItem({
    itemId: "dc-a2",
    moduleKey: "d2-breadth",
    formId: "A",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "get_permits" },
      { id: "advertise_the_event" },
      { id: "arrange_course_and_supplies" },
      { id: "recruit_volunteers" },
    ],
    decoys: [{ id: "monolith_run_event" }, { id: "make_flyers" }, { id: "order_new_jerseys" }],
    overlapPairs: [["advertise_the_event", "make_flyers"]],
    blockingEdges: [["get_permits", "advertise_the_event"]],
    independentPairs: [["arrange_course_and_supplies", "recruit_volunteers"]],
    keyNote: "Probe form A, d2 slot. Four co-equal top-level pieces; permits block advertising, nothing else is ordered.",
  }),
  control({
    itemId: "dc-a3",
    moduleKey: "d3-seams",
    formId: "A",
    difficulty: 1,
    keyNote: "Probe form A, d3 slot (control). One phone call, already checkable.",
  }),
  control({
    itemId: "dc-a4",
    moduleKey: "d4-size",
    formId: "A",
    difficulty: 1,
    keyNote: "Probe form A, d4 slot (control). One email, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-a5",
    moduleKey: "d5-order",
    formId: "A",
    difficulty: 3,
    focusCriteria: ["D5"],
    required: [
      { id: "renew_passport" },
      { id: "book_flights" },
      { id: "book_lodging" },
      { id: "pack_for_the_trip" },
    ],
    decoys: [{ id: "monolith_plan_trip" }, { id: "check_passport_expiration" }, { id: "buy_new_luggage" }],
    overlapPairs: [["renew_passport", "check_passport_expiration"]],
    blockingEdges: [
      ["renew_passport", "book_flights"],
      ["book_flights", "pack_for_the_trip"],
    ],
    independentPairs: [["book_lodging", "renew_passport"]],
    keyNote:
      "Probe form A, d5 slot. The passport clock is the real constraint: nothing about flights is safe to lock in before it clears. Lodging is genuinely independent.",
  }),
  arrangementItem({
    itemId: "dc-a6",
    moduleKey: "d6-recompose",
    formId: "A",
    difficulty: 3,
    focusCriteria: ["D6"],
    required: [
      { id: "find_a_place_to_live" },
      { id: "book_movers_or_truck" },
      { id: "pack_belongings" },
      { id: "transfer_utilities_and_address" },
    ],
    decoys: [{ id: "monolith_move_city" }, { id: "browse_apartment_listings" }, { id: "buy_new_furniture" }],
    overlapPairs: [["find_a_place_to_live", "browse_apartment_listings"]],
    blockingEdges: [["find_a_place_to_live", "book_movers_or_truck"]],
    independentPairs: [["pack_belongings", "transfer_utilities_and_address"]],
    keyNote:
      "The spec's own worked example (03-decomposition-lab.md §5.1): moving two people to another city in five weeks. Probe form A, d6 slot.",
  }),

  // ── Probe form B ─────────────────────────────────────────────────────────
  arrangementItem({
    itemId: "dc-b1",
    moduleKey: "d1-frame",
    formId: "B",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [
      { id: "remove_old_cabinets" },
      { id: "buy_new_cabinets_and_counters" },
      { id: "install_new_cabinets" },
      { id: "paint_and_finish" },
    ],
    decoys: [{ id: "monolith_remodel" }, { id: "clear_out_old_cabinets" }, { id: "replace_dining_light" }],
    overlapPairs: [["remove_old_cabinets", "clear_out_old_cabinets"]],
    blockingEdges: [
      ["remove_old_cabinets", "install_new_cabinets"],
      ["buy_new_cabinets_and_counters", "install_new_cabinets"],
      ["install_new_cabinets", "paint_and_finish"],
    ],
    independentPairs: [["remove_old_cabinets", "buy_new_cabinets_and_counters"]],
    keyNote: "Probe form B, d1 slot — matched to dc-a1 (same structure, kitchen instead of bathroom).",
  }),
  arrangementItem({
    itemId: "dc-b2",
    moduleKey: "d2-breadth",
    formId: "B",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "get_street_permit" },
      { id: "advertise_to_neighbors" },
      { id: "arrange_food_and_tables" },
      { id: "recruit_helpers" },
    ],
    decoys: [{ id: "monolith_block_party" }, { id: "put_up_flyers" }, { id: "repave_driveway" }],
    overlapPairs: [["advertise_to_neighbors", "put_up_flyers"]],
    blockingEdges: [["get_street_permit", "advertise_to_neighbors"]],
    independentPairs: [["arrange_food_and_tables", "recruit_helpers"]],
    keyNote: "Probe form B, d2 slot — matched to dc-a2 (block party instead of fun-run).",
  }),
  control({
    itemId: "dc-b3",
    moduleKey: "d3-seams",
    formId: "B",
    difficulty: 1,
    keyNote: "Probe form B, d3 slot (control) — matched to dc-a3.",
  }),
  control({
    itemId: "dc-b4",
    moduleKey: "d4-size",
    formId: "B",
    difficulty: 1,
    keyNote: "Probe form B, d4 slot (control) — matched to dc-a4.",
  }),
  arrangementItem({
    itemId: "dc-b5",
    moduleKey: "d5-order",
    formId: "B",
    difficulty: 3,
    focusCriteria: ["D5"],
    required: [{ id: "renew_id_card" }, { id: "book_flights" }, { id: "book_hotel" }, { id: "pack_for_the_trip" }],
    decoys: [{ id: "monolith_plan_trip" }, { id: "check_id_expiration" }, { id: "buy_travel_bag" }],
    overlapPairs: [["renew_id_card", "check_id_expiration"]],
    blockingEdges: [
      ["renew_id_card", "book_flights"],
      ["book_flights", "pack_for_the_trip"],
    ],
    independentPairs: [["book_hotel", "renew_id_card"]],
    keyNote: "Probe form B, d5 slot — matched to dc-a5 (work trip instead of international trip).",
  }),
  arrangementItem({
    itemId: "dc-b6",
    moduleKey: "d6-recompose",
    formId: "B",
    difficulty: 3,
    focusCriteria: ["D6"],
    required: [
      { id: "find_a_place_to_live" },
      { id: "book_moving_truck" },
      { id: "pack_belongings" },
      { id: "transfer_utilities_and_records" },
    ],
    decoys: [{ id: "monolith_move_state" }, { id: "browse_rental_listings" }, { id: "buy_new_furniture" }],
    overlapPairs: [["find_a_place_to_live", "browse_rental_listings"]],
    blockingEdges: [["find_a_place_to_live", "book_moving_truck"]],
    independentPairs: [["pack_belongings", "transfer_utilities_and_records"]],
    keyNote: "Probe form B, d6 slot — matched to dc-a6 (a family of two, another state).",
  }),

  // ── Probe form C ─────────────────────────────────────────────────────────
  arrangementItem({
    itemId: "dc-c1",
    moduleKey: "d1-frame",
    formId: "C",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [
      { id: "clear_out_garage" },
      { id: "install_flooring_and_mirrors" },
      { id: "buy_the_equipment" },
      { id: "set_up_lighting_and_power" },
    ],
    decoys: [{ id: "monolith_convert_garage" }, { id: "haul_out_old_stuff" }, { id: "repaint_exterior" }],
    overlapPairs: [["clear_out_garage", "haul_out_old_stuff"]],
    blockingEdges: [
      ["clear_out_garage", "install_flooring_and_mirrors"],
      ["install_flooring_and_mirrors", "set_up_lighting_and_power"],
    ],
    independentPairs: [["buy_the_equipment", "clear_out_garage"]],
    keyNote: "Probe form C, d1 slot — matched to dc-a1/dc-b1 (garage-to-gym conversion).",
  }),
  arrangementItem({
    itemId: "dc-c2",
    moduleKey: "d2-breadth",
    formId: "C",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "get_permits" },
      { id: "advertise_the_walk" },
      { id: "arrange_route_and_supplies" },
      { id: "recruit_volunteers" },
    ],
    decoys: [{ id: "monolith_run_walk" }, { id: "design_a_flyer" }, { id: "order_staff_shirts" }],
    overlapPairs: [["advertise_the_walk", "design_a_flyer"]],
    blockingEdges: [["get_permits", "advertise_the_walk"]],
    independentPairs: [["arrange_route_and_supplies", "recruit_volunteers"]],
    keyNote: "Probe form C, d2 slot — matched to dc-a2/dc-b2 (a charity walk).",
  }),
  control({
    itemId: "dc-c3",
    moduleKey: "d3-seams",
    formId: "C",
    difficulty: 1,
    keyNote: "Probe form C, d3 slot (control) — matched to dc-a3/dc-b3.",
  }),
  control({
    itemId: "dc-c4",
    moduleKey: "d4-size",
    formId: "C",
    difficulty: 1,
    keyNote: "Probe form C, d4 slot (control) — matched to dc-a4/dc-b4.",
  }),
  arrangementItem({
    itemId: "dc-c5",
    moduleKey: "d5-order",
    formId: "C",
    difficulty: 3,
    focusCriteria: ["D5"],
    required: [
      { id: "renew_drivers_license" },
      { id: "book_rental_car" },
      { id: "book_lodging_along_route" },
      { id: "pack_for_the_trip" },
    ],
    decoys: [{ id: "monolith_plan_road_trip" }, { id: "check_license_expiration" }, { id: "get_car_detailed" }],
    overlapPairs: [["renew_drivers_license", "check_license_expiration"]],
    blockingEdges: [
      ["renew_drivers_license", "book_rental_car"],
      ["book_rental_car", "pack_for_the_trip"],
    ],
    independentPairs: [["book_lodging_along_route", "renew_drivers_license"]],
    keyNote: "Probe form C, d5 slot — matched to dc-a5/dc-b5 (a road trip instead of flying).",
  }),
  arrangementItem({
    itemId: "dc-c6",
    moduleKey: "d6-recompose",
    formId: "C",
    difficulty: 3,
    focusCriteria: ["D6"],
    required: [
      { id: "find_a_place_to_live" },
      { id: "book_movers_or_truck" },
      { id: "pack_belongings" },
      { id: "transfer_utilities_and_address" },
    ],
    decoys: [{ id: "monolith_move_city" }, { id: "browse_apartment_listings" }, { id: "buy_new_furniture" }],
    overlapPairs: [["find_a_place_to_live", "browse_apartment_listings"]],
    blockingEdges: [["find_a_place_to_live", "book_movers_or_truck"]],
    independentPairs: [["pack_belongings", "transfer_utilities_and_address"]],
    keyNote: "Probe form C, d6 slot — matched to dc-a6/dc-b6 (two roommates, same five-week window).",
  }),

  // ── Practice pool: d1-frame ──────────────────────────────────────────────
  control({
    itemId: "dc-p1",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 1,
    keyNote: "Returning a book is already one checkable action.",
  }),
  control({
    itemId: "dc-p2",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 1,
    keyNote: "A text reply, already checkable — sent or not.",
  }),
  arrangementItem({
    itemId: "dc-p3",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [{ id: "price_items" }, { id: "advertise" }, { id: "setup_tables" }, { id: "handle_money" }],
    decoys: [{ id: "monolith_have_the_sale" }, { id: "sort_through_belongings" }, { id: "repaint_garage_door" }],
    overlapPairs: [["price_items", "sort_through_belongings"]],
    blockingEdges: [["price_items", "setup_tables"]],
    independentPairs: [["advertise", "handle_money"]],
    keyNote: "Sorting-and-pricing is one job; the decoy restates it as a second piece.",
  }),
  arrangementItem({
    itemId: "dc-p4",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [
      { id: "clear_the_room" },
      { id: "buy_desk_and_chair" },
      { id: "set_up_equipment" },
      { id: "organize_cables_and_storage" },
    ],
    decoys: [{ id: "monolith_set_up_office" }, { id: "arrange_furniture" }, { id: "repaint_hallway" }],
    overlapPairs: [["buy_desk_and_chair", "arrange_furniture"]],
    blockingEdges: [["buy_desk_and_chair", "set_up_equipment"]],
    independentPairs: [["clear_the_room", "buy_desk_and_chair"]],
    keyNote: "'Arranging furniture' is the same job as buying and placing the desk; the decoy restates it.",
  }),
  breakdownItem({
    itemId: "dc-p5",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 3,
    focusCriteria: ["D1"],
    required: [
      { id: "flights", atomic: true },
      { id: "entry_requirements" },
      { id: "rough_itinerary" },
      { id: "first_lodging" },
      { id: "pack_gear", atomic: true },
    ],
    blockingEdges: [["entry_requirements", "flights"]],
    independentPairs: [["rough_itinerary", "pack_gear"]],
    keyNote: "Visa/entry timelines can force a flight-date change, so they gate booking.",
  }),
  breakdownItem({
    itemId: "dc-p6",
    moduleKey: "d1-frame",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D1"],
    required: [
      { id: "pick_sunny_spot" },
      { id: "prep_the_soil" },
      { id: "choose_what_to_plant" },
      { id: "buy_seeds_or_starts", atomic: true },
      { id: "plant_and_water_schedule" },
    ],
    blockingEdges: [["prep_the_soil", "plant_and_water_schedule"]],
    independentPairs: [["choose_what_to_plant", "buy_seeds_or_starts"]],
    keyNote: "A first vegetable garden — five pieces, none of them a monolith.",
  }),

  // ── Practice pool: d2-breadth ────────────────────────────────────────────
  control({
    itemId: "dc-p7",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 1,
    keyNote: "One phone call, already checkable.",
  }),
  control({
    itemId: "dc-p8",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 1,
    keyNote: "One pharmacy pickup, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-p9",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "get_permission" },
      { id: "advertise" },
      { id: "arrange_bakers" },
      { id: "setup_table_day_of" },
    ],
    decoys: [{ id: "monolith_run_sale" }, { id: "make_a_flyer" }, { id: "order_new_uniforms" }],
    overlapPairs: [["advertise", "make_a_flyer"]],
    blockingEdges: [["get_permission", "advertise"]],
    independentPairs: [["arrange_bakers", "advertise"]],
    keyNote: "Permission has to clear before advertising names a date the school hasn't approved.",
  }),
  arrangementItem({
    itemId: "dc-p10",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "stop_mail" },
      { id: "arrange_pet_or_plant_care" },
      { id: "unplug_appliances" },
      { id: "tell_a_neighbor" },
    ],
    decoys: [{ id: "monolith_get_house_ready" }, { id: "ask_someone_to_check_in" }, { id: "clean_out_garage" }],
    overlapPairs: [["tell_a_neighbor", "ask_someone_to_check_in"]],
    blockingEdges: [["tell_a_neighbor", "arrange_pet_or_plant_care"]],
    independentPairs: [["stop_mail", "unplug_appliances"]],
    keyNote: "Whether the neighbor is the plant-and-pet-sitter has to be settled before that piece is 'done'.",
  }),
  breakdownItem({
    itemId: "dc-p11",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D2"],
    required: [
      { id: "decide_product_line" },
      { id: "source_supplies", atomic: true },
      { id: "make_initial_inventory" },
      { id: "set_up_shop_page" },
      { id: "price_and_list_items" },
    ],
    blockingEdges: [
      ["source_supplies", "make_initial_inventory"],
      ["make_initial_inventory", "price_and_list_items"],
    ],
    independentPairs: [["decide_product_line", "set_up_shop_page"]],
    keyNote: "Five co-equal top-level pieces for a first small shop.",
  }),
  breakdownItem({
    itemId: "dc-p12",
    moduleKey: "d2-breadth",
    formId: "pool",
    difficulty: 3,
    focusCriteria: ["D2"],
    required: [
      { id: "pick_date_and_venue" },
      { id: "invite_the_family" },
      { id: "plan_food_and_drinks" },
      { id: "organize_activities" },
      { id: "arrange_lodging_for_out_of_towners" },
    ],
    blockingEdges: [["pick_date_and_venue", "invite_the_family"]],
    independentPairs: [["plan_food_and_drinks", "organize_activities"]],
    keyNote: "Five top-level pieces; a depth-first learner typically nails food-and-drinks completely before naming the other four.",
  }),

  // ── Practice pool: d3-seams ──────────────────────────────────────────────
  control({
    itemId: "dc-p13",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 1,
    keyNote: "One online payment, already checkable.",
  }),
  control({
    itemId: "dc-p14",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 1,
    keyNote: "One confirmation call, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-p15",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D3"],
    required: [
      { id: "pick_date_and_venue" },
      { id: "invite_guests" },
      { id: "order_cake_and_food" },
      { id: "keep_it_secret" },
    ],
    decoys: [{ id: "monolith_throw_party" }, { id: "book_a_place" }, { id: "buy_a_new_car" }],
    overlapPairs: [["pick_date_and_venue", "book_a_place"]],
    blockingEdges: [["pick_date_and_venue", "invite_guests"]],
    independentPairs: [["order_cake_and_food", "keep_it_secret"]],
    keyNote: "'Book a place' restates picking the venue; keeping it secret cuts across every other piece rather than depending on one.",
  }),
  breakdownItem({
    itemId: "dc-p16",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D3"],
    required: [
      { id: "choose_color_and_style" },
      { id: "buy_paint_and_supplies", atomic: true },
      { id: "prep_the_room" },
      { id: "paint_the_walls" },
      { id: "restyle_with_new_decor" },
    ],
    blockingEdges: [
      ["buy_paint_and_supplies", "paint_the_walls"],
      ["prep_the_room", "paint_the_walls"],
    ],
    independentPairs: [["choose_color_and_style", "buy_paint_and_supplies"]],
    keyNote: "'prep_the_room' factors moving furniture and covering floors into one piece rather than two overlapping ones.",
  }),
  repairItem({
    itemId: "dc-p17",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 2,
    seededFault: "overlap",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3"), sn("n4")],
    required: [{ id: "pack_belongings" }, { id: "book_moving_truck", atomic: true }, { id: "update_address_and_utilities", atomic: true }],
    independentPairs: [["book_moving_truck", "update_address_and_utilities"]],
    keyNote:
      "Supplied tree lists 'pack the kitchen' and 'pack fragile items' as separate pieces — the kitchen's glassware is fragile, so the two overlap. The fix factors packing into one piece.",
  }),
  repairItem({
    itemId: "dc-p18",
    moduleKey: "d3-seams",
    formId: "pool",
    difficulty: 2,
    seededFault: "overlap",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3"), sn("n4")],
    required: [{ id: "book_venue_and_confirm_headcount" }, { id: "arrange_catering" }, { id: "plan_agenda" }],
    blockingEdges: [["book_venue_and_confirm_headcount", "arrange_catering"]],
    independentPairs: [["arrange_catering", "plan_agenda"]],
    keyNote:
      "Supplied tree lists 'book the venue' and 'confirm headcount with the venue' separately — confirming headcount is part of booking, not a second piece.",
  }),

  // ── Practice pool: d4-size ───────────────────────────────────────────────
  control({
    itemId: "dc-p19",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 1,
    keyNote: "One watering pass, already checkable.",
  }),
  control({
    itemId: "dc-p20",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 1,
    keyNote: "Turning on one auto-reply, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-p21",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 1,
    focusCriteria: ["D4"],
    required: [
      { id: "clear_counters" },
      { id: "wash_dishes" },
      { id: "wipe_surfaces" },
      { id: "sweep_and_mop_floor" },
    ],
    decoys: [{ id: "monolith_clean_kitchen" }, { id: "tidy_up" }, { id: "reorganize_pantry" }],
    overlapPairs: [["clear_counters", "tidy_up"]],
    blockingEdges: [
      ["clear_counters", "wipe_surfaces"],
      ["wipe_surfaces", "sweep_and_mop_floor"],
    ],
    independentPairs: [["wash_dishes", "clear_counters"]],
    keyNote: "'Reorganize the pantry' is a real task and genuinely out of scope for tonight — it does not belong in this structure at all.",
  }),
  breakdownItem({
    itemId: "dc-p22",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D4"],
    required: [
      { id: "get_a_training_plan" },
      { id: "build_up_weekly_mileage" },
      { id: "buy_running_shoes", atomic: true },
      { id: "register_for_the_race", atomic: true },
      { id: "taper_before_race_day" },
    ],
    blockingEdges: [
      ["get_a_training_plan", "build_up_weekly_mileage"],
      ["build_up_weekly_mileage", "taper_before_race_day"],
    ],
    independentPairs: [["buy_running_shoes", "register_for_the_race"]],
    keyNote: "Buying shoes and registering are each one action; the risk here is a learner splitting either into steps that don't need their own done condition.",
  }),
  repairItem({
    itemId: "dc-p23",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 1,
    seededFault: "monolith",
    suppliedTree: [sn("n1")],
    required: [
      { id: "demo_old_fixtures" },
      { id: "plumbing_and_electrical_work" },
      { id: "install_new_fixtures" },
      { id: "paint_and_finish" },
    ],
    blockingEdges: [
      ["demo_old_fixtures", "plumbing_and_electrical_work"],
      ["plumbing_and_electrical_work", "install_new_fixtures"],
      ["install_new_fixtures", "paint_and_finish"],
    ],
    keyNote: "Supplied tree is a single node, 'do the renovation', with no done condition — the textbook monolith.",
  }),
  repairItem({
    itemId: "dc-p24",
    moduleKey: "d4-size",
    formId: "pool",
    difficulty: 1,
    seededFault: "premature_split",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3"), sn("n4"), sn("n5"), sn("n6"), sn("n7")],
    required: [{ id: "mail_the_card", atomic: true }],
    keyNote: "Supplied tree splits one atomic errand — mail a card — into seven steps. Nothing here needed its own done condition.",
  }),

  // ── Practice pool: d5-order ──────────────────────────────────────────────
  control({
    itemId: "dc-p25",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 1,
    keyNote: "One post-office drop-off, already checkable.",
  }),
  control({
    itemId: "dc-p26",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 1,
    keyNote: "One overnight charge, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-p27",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D5"],
    required: [
      { id: "get_it_cleaned" },
      { id: "gather_paperwork" },
      { id: "take_photos" },
      { id: "list_it_for_sale" },
    ],
    decoys: [{ id: "monolith_sell_car" }, { id: "get_title_ready" }, { id: "replace_the_tires" }],
    overlapPairs: [["gather_paperwork", "get_title_ready"]],
    blockingEdges: [
      ["gather_paperwork", "list_it_for_sale"],
      ["get_it_cleaned", "take_photos"],
      ["take_photos", "list_it_for_sale"],
    ],
    independentPairs: [["gather_paperwork", "get_it_cleaned"]],
    keyNote: "Two independent chains — cleaning-then-photos, and paperwork — both have to finish before the listing goes up.",
  }),
  breakdownItem({
    itemId: "dc-p28",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 3,
    focusCriteria: ["D5"],
    required: [
      { id: "set_the_budget" },
      { id: "pick_date_and_venue" },
      { id: "book_key_vendors" },
      { id: "choose_outfits", atomic: true },
      { id: "send_invitations" },
      { id: "finalize_details_week_of" },
    ],
    blockingEdges: [
      ["set_the_budget", "pick_date_and_venue"],
      ["pick_date_and_venue", "book_key_vendors"],
      ["book_key_vendors", "send_invitations"],
    ],
    independentPairs: [["book_key_vendors", "choose_outfits"]],
    keyNote: "A budget-first chain of four; choosing outfits sits off to the side, unordered against the vendor chain.",
  }),
  repairItem({
    itemId: "dc-p29",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 2,
    seededFault: "inverted_dependency",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3")],
    required: [{ id: "buy_groceries" }, { id: "cook_the_meal" }, { id: "set_the_table", atomic: true }],
    blockingEdges: [["buy_groceries", "cook_the_meal"]],
    independentPairs: [
      ["set_the_table", "buy_groceries"],
      ["set_the_table", "cook_the_meal"],
    ],
    keyNote:
      "Supplied tree marks 'set the table' as blocking 'buy the groceries' — backwards, and table-setting doesn't depend on either of the other two at all.",
  }),
  repairItem({
    itemId: "dc-p30",
    moduleKey: "d5-order",
    formId: "pool",
    difficulty: 3,
    seededFault: "inverted_dependency",
    suppliedTree: [sn("n1"), sn("n2")],
    required: [{ id: "renew_passport" }, { id: "book_flights" }],
    blockingEdges: [["renew_passport", "book_flights"]],
    keyNote: "Supplied tree marks the two pieces independent — no edge at all — when renewal genuinely gates booking a usable flight.",
  }),

  // ── Practice pool: d6-recompose ──────────────────────────────────────────
  control({
    itemId: "dc-p31",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 1,
    keyNote: "One library-card renewal, already checkable.",
  }),
  control({
    itemId: "dc-p32",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 1,
    keyNote: "One thank-you email, already checkable.",
  }),
  arrangementItem({
    itemId: "dc-p33",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 2,
    focusCriteria: ["D6"],
    required: [
      { id: "pack_belongings" },
      { id: "book_moving_help" },
      { id: "notify_landlord_and_utilities" },
      { id: "clean_the_empty_apartment" },
    ],
    decoys: [{ id: "monolith_move_out" }, { id: "get_boxes_and_supplies" }, { id: "buy_new_furniture" }],
    overlapPairs: [["pack_belongings", "get_boxes_and_supplies"]],
    blockingEdges: [["pack_belongings", "clean_the_empty_apartment"]],
    independentPairs: [["book_moving_help", "notify_landlord_and_utilities"]],
    keyNote: "Studio move-out — four pieces cover the whole obligation; missing 'clean the empty apartment' is the most common real-world gap this item catches.",
  }),
  breakdownItem({
    itemId: "dc-p34",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 3,
    focusCriteria: ["D6"],
    required: [
      { id: "outline_the_story" },
      { id: "write_the_first_draft" },
      { id: "revise_and_edit" },
      { id: "get_cover_designed", atomic: true },
      { id: "format_and_publish" },
    ],
    blockingEdges: [
      ["outline_the_story", "write_the_first_draft"],
      ["write_the_first_draft", "revise_and_edit"],
      ["revise_and_edit", "format_and_publish"],
    ],
    independentPairs: [["get_cover_designed", "revise_and_edit"]],
    keyNote: "The cover can be commissioned any time after the outline settles the book's shape — it doesn't gate or get gated by the editing pass.",
  }),
  repairItem({
    itemId: "dc-p35",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 2,
    seededFault: "missing_element",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3")],
    required: [
      { id: "gather_income_documents" },
      { id: "claim_eligible_deductions" },
      { id: "fill_out_the_forms" },
      { id: "submit_the_return" },
    ],
    blockingEdges: [
      ["gather_income_documents", "claim_eligible_deductions"],
      ["gather_income_documents", "fill_out_the_forms"],
      ["fill_out_the_forms", "submit_the_return"],
    ],
    keyNote: "Supplied tree has no piece for claiming deductions at all — present in neither name nor substance.",
  }),
  repairItem({
    itemId: "dc-p36",
    moduleKey: "d6-recompose",
    formId: "pool",
    difficulty: 2,
    seededFault: "missing_element",
    suppliedTree: [sn("n1"), sn("n2"), sn("n3")],
    required: [
      { id: "book_flight" },
      { id: "book_hotel" },
      { id: "arrange_ground_transportation" },
      { id: "print_resume_copies", atomic: true },
      { id: "pick_interview_outfit", atomic: true },
    ],
    blockingEdges: [["book_flight", "book_hotel"]],
    independentPairs: [["print_resume_copies", "pick_interview_outfit"]],
    keyNote: "Supplied tree covers the flight and the interview prep but never mentions where the interviewee sleeps or how they get from the airport.",
  }),
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((s) => [s.itemId, s]));
