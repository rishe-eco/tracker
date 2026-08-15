/**
 * Decomposition Lab — English surface for `decomposition/v1`.
 *
 * Module `model` text is a subgoal-labelled contrast (spec §2): the same
 * fragment decomposed once with named chunks and once without, because the
 * labels are what the literature says does the work — an unlabelled good
 * example is the weak intervention.
 */

import type { CostumeAside, DecompositionItemSurface, DecompositionModuleSurface } from "../types";

export const MODULES_EN: DecompositionModuleSurface[] = [
  {
    moduleKey: "d1-frame",
    title: "State the whole before the parts",
    concept:
      "Before you touch a single piece, say what the whole undivided thing is — in your own words — and how you'll know it's done. This sounds like a formality. It isn't: you cannot check that your pieces cover the job if you never wrote down what the job was.\n\nA restated prompt doesn't count. \"Move to the new city\" is the prompt; \"everything we own is in the new apartment and both jobs still start on time\" is a whole with a done condition — something a third party could check without asking you what you meant.\n\nThis is also where premature decomposition gets caught. A learner who starts naming pieces before stating the whole is usually solving the first piece that occurred to them, not the actual problem.",
    model:
      "**No whole:** starts listing \"book movers, pack boxes, change address\" straight away — three real pieces, no stated job.\n\n**Whole first:** \"Everything we own is moved into the new place and both of us can work from day one — done when the last box is unpacked and both home offices are set up.\" *Then* the pieces get named against that.\n\nSame pieces, different order — and only the second version has anything to check the pieces against.",
  },
  {
    moduleKey: "d2-breadth",
    title: "All the pieces before any one piece",
    concept:
      "Experts decompose breadth-first: name every major piece at one level of abstraction before developing any single one. Novices decompose depth-first: grab the first piece that seems tractable and finish it completely before naming a second.\n\nDepth-first feels productive — you're making visible progress on something — which is exactly why it's a trap. You can polish one piece for an hour and still not know whether you've named the other four.\n\nThe fix is a discipline, not a talent: list every top-level piece first, even roughly, before deepening any of them. If you can't tell whether you've named everything, you haven't finished this step.",
    model:
      "**Depth-first:** fully plans the food and drinks for a reunion — menu, quantities, a shopping list — before naming lodging, activities, or invitations at all.\n\n**Breadth-first:** names all five top-level pieces (venue, invites, food, activities, lodging) in one pass, *then* goes back to develop each.\n\nThe second learner can tell you, ten minutes in, whether anything major is still unnamed. The first can't.",
  },
  {
    moduleKey: "d3-seams",
    title: "Cut where the seams are",
    concept:
      "Two pieces should never do the same work. When they do, it's usually because one piece was named at too coarse a level (\"pack the kitchen\") and a second was named to catch something the first should have already covered (\"pack fragile items\") — the kitchen's glassware is fragile, so now two pieces are fighting over the same boxes.\n\nThe fix — borrowed as vocabulary, not as science — is to make pieces mutually exclusive and collectively exhaustive: no piece's work sits inside another's, and work that would otherwise be repeated in several places gets factored into one named piece instead.\n\nWhen you notice an overlap, the fix is almost never \"keep both, sort it out later\" — it's naming the piece that was actually needed and deleting the one that was standing in for it.",
    model:
      "**Overlapping:** \"pack the kitchen\" and \"pack fragile items\" as two separate pieces — both include the same glassware.\n\n**One seam:** \"pack all belongings by room\" as a single piece. Nothing is claimed twice, and nothing was lost.",
  },
  {
    moduleKey: "d4-size",
    title: "Right-sized pieces",
    concept:
      "A piece is the right size when you can state a yes/no condition for its being done — not a feeling, a fact someone else could check. \"Handle the paperwork\" fails that test. \"Signed lease returned to the landlord\" passes.\n\nThis cuts both directions. A piece with no checkable done condition is too big — a monolith wearing the costume of a plan. But a piece that's already checkable and atomic can also be split needlessly: \"mail a card\" doesn't need seven steps, each with its own done condition, to be one honest unit of work.\n\nThe refusal matters as much as the split: sometimes the right answer is that a piece doesn't need dividing at all, and shattering it anyway isn't rigor — it's a different failure with a similar shape.",
    model:
      "**Monolith:** \"do the renovation\" — no way to check it's done short of standing in the finished room.\n\n**Right-sized:** \"demo the old fixtures,\" \"rough-in plumbing and electrical,\" \"install new fixtures,\" \"paint and finish\" — each one a third party could check off without asking you anything.\n\n**Also wrong, the other direction:** splitting \"mail a card\" into buy / find a pen / write / sign / envelope / stamp / walk to the mailbox. Nothing there needed its own done condition.",
  },
  {
    moduleKey: "d5-order",
    title: "Dependencies, not just order",
    concept:
      "Three relationships get blended constantly, and the blend is a documented novice failure: containment (this piece is part of that whole), sequence (I happened to write this one first), and dependency (this piece genuinely cannot start until that one finishes).\n\nOnly dependency has teeth. Writing pieces down in some order doesn't make that order load-bearing — plenty of pieces can run in either order, or in parallel, and marking them as blocking each other when they don't is its own kind of error.\n\nAsk of every pair: if I did these in the other order, would anything actually break? If yes, that's a real dependency — name which one blocks which. If no, they're independent, and pretending otherwise just adds false constraints.",
    model:
      "**Blended:** a to-do list where \"set the table\" appears before \"buy the groceries,\" as if list order were a real constraint.\n\n**Untangled:** buying groceries blocks cooking; cooking and setting the table don't block each other at all — either can happen first, or at the same time.",
  },
  {
    moduleKey: "d6-recompose",
    title: "Does it add back up?",
    concept:
      "The last step is checking coverage, not assuming it. Reassemble the pieces against the whole you stated in step one: does everything the job needs appear somewhere, exactly once? Published studies of real decomposition diagrams find this fails constantly — in the closest one, 51 of 55 diagrams were missing something the task genuinely needed.\n\nThe habit worth building is specific: after you think you're done, go back to your own whole-statement and check every piece of it is covered by *something* in your structure. Don't check the structure against your memory of the problem — check it against the sentence you wrote down.\n\nOne honesty note: this app models containment (goal → milestone → project → action) and sequence (an order number), but has no dependency edge at all. So while this module teaches the distinction, exporting a real structure into your own Goals and Projects will flatten dependency information — the export screen says so.",
    model:
      "**Assumed complete:** a move-out plan with packing, movers, and address changes — feels thorough, and never mentions cleaning the empty apartment before handing back the keys.\n\n**Checked against the whole:** the same three pieces, checked against \"the lease obligations are fully closed out\" — which surfaces the missing cleaning step immediately.",
  },
];

export const COSTUME_ASIDE_EN: CostumeAside = {
  title: "Why this isn't about prompting a model",
  body:
    "\"Least-to-most prompting\" and \"decomposed prompting\" are real techniques: breaking a problem into ordered steps and handing them to a model one at a time measurably beats asking it everything at once. That's genuine, and it's also decaying — newer reasoning models already decompose internally, so handing one a fixed step-by-step script increasingly gets in its way rather than helping it.\n\nThat's the costume. What's underneath survives every model change: decomposing so *you* know what you're actually asking for, so each piece has a done condition you can check, and so a wrong answer to one piece is something you'd notice instead of something that dissolves into a plausible-looking whole. That's the skill this tool trains — and it's exactly as useful with no AI in the loop at all.",
};

const P = (id: string, label: string): [string, string] => [id, label];

export const ITEM_SURFACES_EN: DecompositionItemSurface[] = [
  // ── Probe form A ─────────────────────────────────────────────────────────
  {
    itemId: "dc-a1",
    scenario: "Renovate a bathroom over the next two weeks.",
    pieceLabels: Object.fromEntries([
      P("demo_old_fixtures", "Demo the old fixtures"),
      P("buy_new_fixtures", "Buy the new fixtures"),
      P("install_new_fixtures", "Install the new fixtures"),
      P("paint_and_finish", "Paint and finish"),
      P("monolith_renovate", "Renovate the bathroom"),
      P("clear_out_old_bathroom", "Clear out the old bathroom"),
      P("repaint_hallway", "Repaint the hallway"),
    ]),
  },
  {
    itemId: "dc-a2",
    scenario: "Organize a community fun-run for 100 participants.",
    pieceLabels: Object.fromEntries([
      P("get_permits", "Get the necessary permits"),
      P("advertise_the_event", "Advertise the event"),
      P("arrange_course_and_supplies", "Arrange the course and supplies"),
      P("recruit_volunteers", "Recruit volunteers"),
      P("monolith_run_event", "Run the event"),
      P("make_flyers", "Make flyers"),
      P("order_new_jerseys", "Order new team jerseys"),
    ]),
  },
  {
    itemId: "dc-a3",
    scenario: "Confirm a haircut appointment for Saturday morning.",
    pieceLabels: {},
  },
  {
    itemId: "dc-a4",
    scenario: "Forward a work email to a colleague who's covering for you.",
    pieceLabels: {},
  },
  {
    itemId: "dc-a5",
    scenario: "Renew a passport and book an international trip six weeks out.",
    pieceLabels: Object.fromEntries([
      P("renew_passport", "Renew the passport"),
      P("book_flights", "Book the flights"),
      P("book_lodging", "Book lodging"),
      P("pack_for_the_trip", "Pack for the trip"),
      P("monolith_plan_trip", "Plan the trip"),
      P("check_passport_expiration", "Check the passport's expiration date"),
      P("buy_new_luggage", "Buy new luggage"),
    ]),
  },
  {
    itemId: "dc-a6",
    scenario: "Move two people to another city in five weeks.",
    pieceLabels: Object.fromEntries([
      P("find_a_place_to_live", "Find a place to live"),
      P("book_movers_or_truck", "Book movers or a truck"),
      P("pack_belongings", "Pack belongings"),
      P("transfer_utilities_and_address", "Transfer utilities and change of address"),
      P("monolith_move_city", "Move to the new city"),
      P("browse_apartment_listings", "Browse apartment listings"),
      P("buy_new_furniture", "Buy new furniture for the new place"),
    ]),
  },

  // ── Probe form B ─────────────────────────────────────────────────────────
  {
    itemId: "dc-b1",
    scenario: "Remodel a kitchen over the next two weeks.",
    pieceLabels: Object.fromEntries([
      P("remove_old_cabinets", "Remove the old cabinets"),
      P("buy_new_cabinets_and_counters", "Buy new cabinets and counters"),
      P("install_new_cabinets", "Install the new cabinets"),
      P("paint_and_finish", "Paint and finish"),
      P("monolith_remodel", "Remodel the kitchen"),
      P("clear_out_old_cabinets", "Clear out the old cabinets"),
      P("replace_dining_light", "Replace the dining room light fixture"),
    ]),
  },
  {
    itemId: "dc-b2",
    scenario: "Organize a neighborhood block party for 100 people.",
    pieceLabels: Object.fromEntries([
      P("get_street_permit", "Get a street permit"),
      P("advertise_to_neighbors", "Advertise to the neighborhood"),
      P("arrange_food_and_tables", "Arrange food and tables"),
      P("recruit_helpers", "Recruit helpers"),
      P("monolith_block_party", "Throw the block party"),
      P("put_up_flyers", "Put up flyers"),
      P("repave_driveway", "Repave the driveway"),
    ]),
  },
  {
    itemId: "dc-b3",
    scenario: "Confirm a haircut appointment for next Tuesday.",
    pieceLabels: {},
  },
  {
    itemId: "dc-b4",
    scenario: "Forward a school email to your co-parent.",
    pieceLabels: {},
  },
  {
    itemId: "dc-b5",
    scenario: "Renew an ID card and book a work trip six weeks out.",
    pieceLabels: Object.fromEntries([
      P("renew_id_card", "Renew the ID card"),
      P("book_flights", "Book the flights"),
      P("book_hotel", "Book a hotel"),
      P("pack_for_the_trip", "Pack for the trip"),
      P("monolith_plan_trip", "Plan the work trip"),
      P("check_id_expiration", "Check the ID card's expiration date"),
      P("buy_travel_bag", "Buy a new travel bag"),
    ]),
  },
  {
    itemId: "dc-b6",
    scenario: "Move a family of two to another state in six weeks.",
    pieceLabels: Object.fromEntries([
      P("find_a_place_to_live", "Find a place to live"),
      P("book_moving_truck", "Book a moving truck"),
      P("pack_belongings", "Pack belongings"),
      P("transfer_utilities_and_records", "Transfer utilities and records"),
      P("monolith_move_state", "Move to the new state"),
      P("browse_rental_listings", "Browse rental listings"),
      P("buy_new_furniture", "Buy new furniture for the new place"),
    ]),
  },

  // ── Probe form C ─────────────────────────────────────────────────────────
  {
    itemId: "dc-c1",
    scenario: "Convert the garage into a home gym over two weeks.",
    pieceLabels: Object.fromEntries([
      P("clear_out_garage", "Clear out the garage"),
      P("install_flooring_and_mirrors", "Install flooring and mirrors"),
      P("buy_the_equipment", "Buy the equipment"),
      P("set_up_lighting_and_power", "Set up lighting and power"),
      P("monolith_convert_garage", "Convert the garage"),
      P("haul_out_old_stuff", "Haul out the old stuff"),
      P("repaint_exterior", "Repaint the house exterior"),
    ]),
  },
  {
    itemId: "dc-c2",
    scenario: "Organize a charity 5k walk for 100 participants.",
    pieceLabels: Object.fromEntries([
      P("get_permits", "Get the necessary permits"),
      P("advertise_the_walk", "Advertise the walk"),
      P("arrange_route_and_supplies", "Arrange the route and supplies"),
      P("recruit_volunteers", "Recruit volunteers"),
      P("monolith_run_walk", "Run the charity walk"),
      P("design_a_flyer", "Design a flyer"),
      P("order_staff_shirts", "Order new staff t-shirts"),
    ]),
  },
  {
    itemId: "dc-c3",
    scenario: "Confirm a car service appointment for next Monday.",
    pieceLabels: {},
  },
  {
    itemId: "dc-c4",
    scenario: "Forward a client email to a teammate covering your desk.",
    pieceLabels: {},
  },
  {
    itemId: "dc-c5",
    scenario: "Renew a driver's license and book a road trip six weeks out.",
    pieceLabels: Object.fromEntries([
      P("renew_drivers_license", "Renew the driver's license"),
      P("book_rental_car", "Book the rental car"),
      P("book_lodging_along_route", "Book lodging along the route"),
      P("pack_for_the_trip", "Pack for the trip"),
      P("monolith_plan_road_trip", "Plan the road trip"),
      P("check_license_expiration", "Check the license's expiration date"),
      P("get_car_detailed", "Get the car detailed"),
    ]),
  },
  {
    itemId: "dc-c6",
    scenario: "Move two roommates to another city in five weeks.",
    pieceLabels: Object.fromEntries([
      P("find_a_place_to_live", "Find a place to live"),
      P("book_movers_or_truck", "Book movers or a truck"),
      P("pack_belongings", "Pack belongings"),
      P("transfer_utilities_and_address", "Transfer utilities and change of address"),
      P("monolith_move_city", "Move to the new city"),
      P("browse_apartment_listings", "Browse apartment listings"),
      P("buy_new_furniture", "Buy new furniture for the new place"),
    ]),
  },

  // ── Practice pool: d1-frame ──────────────────────────────────────────────
  { itemId: "dc-p1", scenario: "Return a library book that's due tomorrow.", pieceLabels: {} },
  { itemId: "dc-p2", scenario: "Reply to a friend's text about weekend plans.", pieceLabels: {} },
  {
    itemId: "dc-p3",
    scenario: "Plan and run a weekend garage sale.",
    pieceLabels: Object.fromEntries([
      P("price_items", "Price the items"),
      P("advertise", "Advertise the sale"),
      P("setup_tables", "Set up the tables"),
      P("handle_money", "Handle the money on the day"),
      P("monolith_have_the_sale", "Have the sale"),
      P("sort_through_belongings", "Sort through belongings"),
      P("repaint_garage_door", "Repaint the garage door"),
    ]),
  },
  {
    itemId: "dc-p4",
    scenario: "Set up a home office in the spare room.",
    pieceLabels: Object.fromEntries([
      P("clear_the_room", "Clear out the room"),
      P("buy_desk_and_chair", "Buy a desk and chair"),
      P("set_up_equipment", "Set up the computer and equipment"),
      P("organize_cables_and_storage", "Organize cables and storage"),
      P("monolith_set_up_office", "Set up the office"),
      P("arrange_furniture", "Arrange the furniture"),
      P("repaint_hallway", "Repaint the hallway"),
    ]),
  },
  {
    itemId: "dc-p5",
    scenario: "Plan a two-week solo backpacking trip through three countries.",
    pieceLabels: Object.fromEntries([
      P("flights", "Book flights"),
      P("entry_requirements", "Sort out visas or entry requirements"),
      P("rough_itinerary", "Rough out the itinerary"),
      P("first_lodging", "Book the first few nights' lodging"),
      P("pack_gear", "Pack the gear"),
    ]),
  },
  {
    itemId: "dc-p6",
    scenario: "Set up a vegetable garden in the backyard this spring.",
    pieceLabels: Object.fromEntries([
      P("pick_sunny_spot", "Pick a sunny spot"),
      P("prep_the_soil", "Prep the soil"),
      P("choose_what_to_plant", "Choose what to plant"),
      P("buy_seeds_or_starts", "Buy seeds or starts"),
      P("plant_and_water_schedule", "Plant, and set a watering schedule"),
    ]),
  },

  // ── Practice pool: d2-breadth ────────────────────────────────────────────
  { itemId: "dc-p7", scenario: "Call the dentist to reschedule Thursday's appointment.", pieceLabels: {} },
  { itemId: "dc-p8", scenario: "Pick up a prescription that's ready at the pharmacy.", pieceLabels: {} },
  {
    itemId: "dc-p9",
    scenario: "Organize a school fundraiser bake sale.",
    pieceLabels: Object.fromEntries([
      P("get_permission", "Get permission from the school"),
      P("advertise", "Advertise the sale"),
      P("arrange_bakers", "Arrange who's baking what"),
      P("setup_table_day_of", "Set up the table the day of"),
      P("monolith_run_sale", "Run the bake sale"),
      P("make_a_flyer", "Make a flyer"),
      P("order_new_uniforms", "Order new uniforms"),
    ]),
  },
  {
    itemId: "dc-p10",
    scenario: "Prepare the house for a week away.",
    pieceLabels: Object.fromEntries([
      P("stop_mail", "Stop the mail"),
      P("arrange_pet_or_plant_care", "Arrange pet or plant care"),
      P("unplug_appliances", "Unplug the appliances"),
      P("tell_a_neighbor", "Tell a neighbor you'll be away"),
      P("monolith_get_house_ready", "Get the house ready"),
      P("ask_someone_to_check_in", "Ask someone to check in"),
      P("clean_out_garage", "Clean out the garage"),
    ]),
  },
  {
    itemId: "dc-p11",
    scenario: "Launch a small Etsy shop selling handmade candles.",
    pieceLabels: Object.fromEntries([
      P("decide_product_line", "Decide the product line"),
      P("source_supplies", "Source supplies"),
      P("make_initial_inventory", "Make the initial inventory"),
      P("set_up_shop_page", "Set up the shop page"),
      P("price_and_list_items", "Price and list the items"),
    ]),
  },
  {
    itemId: "dc-p12",
    scenario: "Plan a family reunion for 25 people next summer.",
    pieceLabels: Object.fromEntries([
      P("pick_date_and_venue", "Pick a date and venue"),
      P("invite_the_family", "Invite the family"),
      P("plan_food_and_drinks", "Plan food and drinks"),
      P("organize_activities", "Organize activities"),
      P("arrange_lodging_for_out_of_towners", "Arrange lodging for out-of-towners"),
    ]),
  },

  // ── Practice pool: d3-seams ──────────────────────────────────────────────
  { itemId: "dc-p13", scenario: "Pay this month's electricity bill online.", pieceLabels: {} },
  { itemId: "dc-p14", scenario: "Confirm a Friday dinner reservation by phone.", pieceLabels: {} },
  {
    itemId: "dc-p15",
    scenario: "Plan a surprise 40th birthday party for a friend.",
    pieceLabels: Object.fromEntries([
      P("pick_date_and_venue", "Pick a date and venue"),
      P("invite_guests", "Invite the guests"),
      P("order_cake_and_food", "Order the cake and food"),
      P("keep_it_secret", "Keep it a secret"),
      P("monolith_throw_party", "Throw the party"),
      P("book_a_place", "Book a place"),
      P("buy_a_new_car", "Buy a new car"),
    ]),
  },
  {
    itemId: "dc-p16",
    scenario: "Redesign and repaint the living room.",
    pieceLabels: Object.fromEntries([
      P("choose_color_and_style", "Choose a color and style"),
      P("buy_paint_and_supplies", "Buy paint and supplies"),
      P("prep_the_room", "Move furniture out and protect the floors"),
      P("paint_the_walls", "Paint the walls"),
      P("restyle_with_new_decor", "Restyle with new decor"),
    ]),
  },
  {
    itemId: "dc-p17",
    scenario: "Move to a new apartment across town.",
    pieceLabels: Object.fromEntries([
      P("n1", "Pack all belongings by room"),
      P("n2", "Pack fragile items"),
      P("n3", "Book a moving truck"),
      P("n4", "Update your address and utilities"),
    ]),
    suppliedWhole: { statement: "Move everything to the new apartment by the 1st.", doneWhen: "All belongings and utilities are transferred by the 1st." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Pack the kitchen"),
      P("n2", "Pack fragile items"),
      P("n3", "Book a moving truck"),
      P("n4", "Update your address with utilities and the post office"),
    ]),
  },
  {
    itemId: "dc-p18",
    scenario: "Plan a two-day company off-site retreat.",
    pieceLabels: Object.fromEntries([
      P("n1", "Book the venue and confirm headcount"),
      P("n2", "Confirm headcount with the venue"),
      P("n3", "Arrange catering"),
      P("n4", "Plan the agenda"),
    ]),
    suppliedWhole: { statement: "Organize the two-day off-site for the team.", doneWhen: "Venue, food, and agenda are locked in before the retreat date." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Book the venue"),
      P("n2", "Confirm headcount with the venue"),
      P("n3", "Arrange catering"),
      P("n4", "Plan the agenda"),
    ]),
  },

  // ── Practice pool: d4-size ───────────────────────────────────────────────
  { itemId: "dc-p19", scenario: "Water the houseplants before leaving for the weekend.", pieceLabels: {} },
  { itemId: "dc-p20", scenario: "Set an out-of-office reply before a day off.", pieceLabels: {} },
  {
    itemId: "dc-p21",
    scenario: "Deep-clean the kitchen before guests arrive tonight.",
    pieceLabels: Object.fromEntries([
      P("clear_counters", "Clear the counters"),
      P("wash_dishes", "Wash the dishes"),
      P("wipe_surfaces", "Wipe down surfaces"),
      P("sweep_and_mop_floor", "Sweep and mop the floor"),
      P("monolith_clean_kitchen", "Clean the kitchen"),
      P("tidy_up", "Tidy up"),
      P("reorganize_pantry", "Reorganize the pantry shelves"),
    ]),
  },
  {
    itemId: "dc-p22",
    scenario: "Train for and run a first 10k race in three months.",
    pieceLabels: Object.fromEntries([
      P("get_a_training_plan", "Get a training plan"),
      P("build_up_weekly_mileage", "Build up weekly mileage"),
      P("buy_running_shoes", "Buy proper running shoes"),
      P("register_for_the_race", "Register for the race"),
      P("taper_before_race_day", "Taper before race day"),
    ]),
  },
  {
    itemId: "dc-p23",
    scenario: "Renovate a bathroom.",
    pieceLabels: Object.fromEntries([
      P("demo_old_fixtures", "Demo the old fixtures"),
      P("plumbing_and_electrical_work", "Rough in plumbing and electrical"),
      P("install_new_fixtures", "Install the new fixtures"),
      P("paint_and_finish", "Paint and finish"),
    ]),
    suppliedWhole: { statement: "Get the bathroom renovated.", doneWhen: "New fixtures installed and painted by end of month." },
    suppliedNodeLabels: Object.fromEntries([P("n1", "Do the renovation")]),
  },
  {
    itemId: "dc-p24",
    scenario: "Mail a signed birthday card to a coworker.",
    pieceLabels: Object.fromEntries([P("mail_the_card", "Mail the card")]),
    suppliedWhole: { statement: "Get a card in the mail to arrive by their birthday.", doneWhen: "Card arrives by their birthday." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Buy a card"),
      P("n2", "Find a pen"),
      P("n3", "Write a message"),
      P("n4", "Sign your name"),
      P("n5", "Put it in an envelope"),
      P("n6", "Add a stamp"),
      P("n7", "Walk to the mailbox"),
    ]),
  },

  // ── Practice pool: d5-order ──────────────────────────────────────────────
  { itemId: "dc-p25", scenario: "Drop off a package at the post office.", pieceLabels: {} },
  { itemId: "dc-p26", scenario: "Charge the car overnight before tomorrow's commute.", pieceLabels: {} },
  {
    itemId: "dc-p27",
    scenario: "Get a car ready to sell privately.",
    pieceLabels: Object.fromEntries([
      P("get_it_cleaned", "Get it cleaned"),
      P("gather_paperwork", "Gather the paperwork"),
      P("take_photos", "Take photos"),
      P("list_it_for_sale", "List it for sale"),
      P("monolith_sell_car", "Sell the car"),
      P("get_title_ready", "Get the title ready"),
      P("replace_the_tires", "Replace the tires"),
    ]),
  },
  {
    itemId: "dc-p28",
    scenario: "Plan a wedding on a modest budget.",
    pieceLabels: Object.fromEntries([
      P("set_the_budget", "Set the budget"),
      P("pick_date_and_venue", "Pick a date and venue"),
      P("book_key_vendors", "Book key vendors"),
      P("choose_outfits", "Choose outfits"),
      P("send_invitations", "Send invitations"),
      P("finalize_details_week_of", "Finalize details the week of"),
    ]),
  },
  {
    itemId: "dc-p29",
    scenario: "Host a dinner party.",
    pieceLabels: Object.fromEntries([P("n1", "Buy the groceries"), P("n2", "Cook the meal"), P("n3", "Set the table")]),
    suppliedWhole: { statement: "Have the dinner ready when guests arrive at 7.", doneWhen: "Food served and table set by 7." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Buy the groceries"),
      P("n2", "Cook the meal"),
      P("n3", "Set the table"),
    ]),
  },
  {
    itemId: "dc-p30",
    scenario: "Renew a passport and book an international flight.",
    pieceLabels: Object.fromEntries([P("n1", "Renew the passport"), P("n2", "Book the flights")]),
    suppliedWhole: { statement: "Be ready to travel internationally in 6 weeks.", doneWhen: "Passport renewed and flights booked before the trip." },
    suppliedNodeLabels: Object.fromEntries([P("n1", "Renew the passport"), P("n2", "Book the flights")]),
  },

  // ── Practice pool: d6-recompose ──────────────────────────────────────────
  { itemId: "dc-p31", scenario: "Renew a library card that expired last week.", pieceLabels: {} },
  { itemId: "dc-p32", scenario: "Send a thank-you email after a job interview.", pieceLabels: {} },
  {
    itemId: "dc-p33",
    scenario: "Move out of a studio apartment at the end of the month.",
    pieceLabels: Object.fromEntries([
      P("pack_belongings", "Pack belongings"),
      P("book_moving_help", "Book moving help"),
      P("notify_landlord_and_utilities", "Notify the landlord and utilities"),
      P("clean_the_empty_apartment", "Clean the empty apartment"),
      P("monolith_move_out", "Move out"),
      P("get_boxes_and_supplies", "Get boxes and packing supplies"),
      P("buy_new_furniture", "Buy new furniture for the next place"),
    ]),
  },
  {
    itemId: "dc-p34",
    scenario: "Write and self-publish a 200-page novel.",
    pieceLabels: Object.fromEntries([
      P("outline_the_story", "Outline the story"),
      P("write_the_first_draft", "Write the first draft"),
      P("revise_and_edit", "Revise and edit"),
      P("get_cover_designed", "Get a cover designed"),
      P("format_and_publish", "Format and publish"),
    ]),
  },
  {
    itemId: "dc-p35",
    scenario: "Prepare and file a tax return.",
    pieceLabels: Object.fromEntries([
      P("n1", "Gather income documents"),
      P("claim_eligible_deductions", "Claim eligible deductions"),
      P("n2", "Fill out the forms"),
      P("n3", "Submit the return"),
    ]),
    suppliedWhole: { statement: "Get the tax return filed before the deadline.", doneWhen: "Return filed and confirmation received before the deadline." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Gather income documents"),
      P("n2", "Fill out the tax forms"),
      P("n3", "Submit the return"),
    ]),
  },
  {
    itemId: "dc-p36",
    scenario: "Plan an out-of-town job interview trip.",
    pieceLabels: Object.fromEntries([
      P("n1", "Book a flight"),
      P("book_hotel", "Book a hotel"),
      P("arrange_ground_transportation", "Arrange transportation from the airport"),
      P("n2", "Print copies of your resume"),
      P("n3", "Pick out interview clothes"),
    ]),
    suppliedWhole: { statement: "Be at the interview on time, prepared.", doneWhen: "Arrive on time with everything needed for the interview." },
    suppliedNodeLabels: Object.fromEntries([
      P("n1", "Book a flight"),
      P("n2", "Print copies of your resume"),
      P("n3", "Pick out interview clothes"),
    ]),
  },
];
