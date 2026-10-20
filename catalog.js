// GreenLoop simulated configuration.
// All numbers live here so they can be tweaked live during a demo.
//
// Note: internally the reward unit is stored as `tokens*` for historical
// reasons, but it is labelled "Green Points (GP)" everywhere in the UI.

// Fixed demo conversion rate: 1 Green Point is worth this many RM.
export const TOKEN_TO_RM = 0.1 // 10 GP = RM 1.00

// Default monthly township maintenance fee a resident can offset (RM).
export const DEFAULT_MAINTENANCE_FEE = 350

// Estimated CO2 avoided per kg of material diverted from landfill (kg CO2e/kg).
// Rough blended factor for narrative purposes.
export const CO2_PER_KG = 1.8

// ---------------------------------------------------------------------------
// How Green Points are granted (transparent model).
//
// Real reward schemes (reverse vending machines, Malaysia's KITARecycle, etc.)
// pay by MATERIAL and WEIGHT. We mirror that: each material has a GP-per-kg
// rate, and an item's reward = round(gpPerKg * unitWeight * quantity).
//
// `bulkRmPerKg` is the price the developer earns selling that material in bulk.
// These are tuned to realistic Malaysian buyback ranges (indicative, 2024):
//   aluminium cans ~RM 3–5/kg, PET ~RM 0.70–1.30/kg, paper/cardboard
//   ~RM 0.30–0.70/kg, e-waste high & variable. Ordering: Aluminium > PET >
//   Paper/Cardboard; e-waste highest.
//
// IMPORTANT — reward sustainability: at TOKEN_TO_RM = 0.1, gpPerKg × 0.1 is the
// RM the hub pays a resident per kg. That reward must stay WELL BELOW the hub's
// total benefit per kg (commodity sale + avoided haulage + carbon) or the hub
// loses money. We target the resident reward at roughly a third of that benefit
// so recycling feels worthwhile while the operation still runs a surplus.
// Sources (indicative): KITARecycle (kitarecycle.com), Malaysian junk-shop /
// buyback price lists, World Bank "Plastics Market Study for Malaysia".
// ---------------------------------------------------------------------------
export const MATERIAL_RATES = {
  //                 gpPerKg  bulkRmPerKg  (reward RM/kg = gpPerKg * 0.1)
  Aluminum:   { gpPerKg: 15, bulkRmPerKg: 4.2 }, // reward RM1.50 vs ~RM4.6 benefit
  EWaste:     { gpPerKg: 40, bulkRmPerKg: 12.0 }, // reward RM4.00 vs ~RM12.4 benefit
  PET:        { gpPerKg: 5, bulkRmPerKg: 1.1 }, // reward RM0.50 vs ~RM1.5 benefit
  Paper:      { gpPerKg: 3, bulkRmPerKg: 0.55 }, // reward RM0.30 vs ~RM0.9 benefit
  Cardboard:  { gpPerKg: 2.5, bulkRmPerKg: 0.45 }, // reward RM0.25 vs ~RM0.8 benefit
  Appliance:  { gpPerKg: 7, bulkRmPerKg: 2.0 }, // reward RM0.70 vs ~RM2.4 benefit
}

// Material categories with display colors (used across charts and badges).
export const CATEGORIES = {
  PET: { label: 'PET Plastic', color: '#3b82f6' },
  Aluminum: { label: 'Aluminum', color: '#64748b' },
  Paper: { label: 'Paper / Carton', color: '#f59e0b' },
  Cardboard: { label: 'Cardboard', color: '#b45309' },
  EWaste: { label: 'E-Waste', color: '#8b5cf6' },
  Appliance: { label: 'Appliances', color: '#ef4444' },
}

// Two sorting streams per the concept pillars.
export const STREAMS = {
  AI: { label: 'AI Stream', description: 'Automated computer vision', color: '#16a34a' },
  Human: { label: 'Human Stream', description: 'Manual operator drop-off', color: '#0ea5e9' },
}

// Raw item definitions. GP and bulk value are DERIVED from MATERIAL_RATES so
// the point logic is transparent and consistent, not a hand-tuned per-item
// magic number.
const RAW_ITEMS = [
  { id: 'pet-bottle', name: 'PET Plastic Bottle', category: 'PET', stream: 'AI', unitWeight: 0.03, grade: 'A — Clean / Clear', emoji: '🍶' },
  { id: 'aluminum-can', name: 'Aluminum Beverage Can', category: 'Aluminum', stream: 'AI', unitWeight: 0.015, grade: 'A — High Purity', emoji: '🥫' },
  { id: 'paper-carton', name: 'Clean Paper Carton', category: 'Paper', stream: 'AI', unitWeight: 0.05, grade: 'B — Dry / Uncoated', emoji: '🧃' },
  { id: 'cardboard-box', name: 'Cardboard Box', category: 'Cardboard', stream: 'Human', unitWeight: 0.4, grade: 'B — Flattened', emoji: '📦' },
  { id: 'ewaste-small', name: 'Small E-Waste (phone/charger)', category: 'EWaste', stream: 'Human', unitWeight: 0.25, grade: 'A — Recoverable Metals', emoji: '📱' },
  { id: 'appliance-microwave', name: 'Used Microwave', category: 'Appliance', stream: 'Human', unitWeight: 12, grade: 'C — Mixed Materials', emoji: '🔌' },
]

// Derive gpPerKg / bulkRmPerKg / tokensPerUnit from the material rate table.
export const ITEM_CATALOG = RAW_ITEMS.map((it) => {
  const rate = MATERIAL_RATES[it.category]
  return {
    ...it,
    gpPerKg: rate.gpPerKg,
    bulkRmPerKg: rate.bulkRmPerKg,
    tokensPerUnit: Math.round(rate.gpPerKg * it.unitWeight),
  }
})

export function getItem(itemId) {
  return ITEM_CATALOG.find((i) => i.id === itemId) || null
}

// ---------------------------------------------------------------------------
// Realistic per-drop-off quantity caps by account type.
//
// A household recycling trip is tens of items — the UK "Big Plastic Count"
// found ~60 pieces of plastic packaging per household PER WEEK — not thousands.
// A commercial F&B / retail tenant generates far more (bags of cans/bottles,
// stacks of flattened cardboard), so its caps are much higher.
// These bound a SINGLE drop-off, keeping residents believable while allowing
// tenants to submit bulk.
// ---------------------------------------------------------------------------
export const DROPOFF_CAPS = {
  residence: {
    'pet-bottle': 30,
    'aluminum-can': 30,
    'paper-carton': 20,
    'cardboard-box': 5,
    'ewaste-small': 5,
    'appliance-microwave': 1,
  },
  tenant: {
    'pet-bottle': 600,
    'aluminum-can': 800,
    'paper-carton': 300,
    'cardboard-box': 150,
    'ewaste-small': 40,
    'appliance-microwave': 5,
  },
}

export function dropoffCap(accountType, itemId) {
  const table = DROPOFF_CAPS[accountType] || DROPOFF_CAPS.residence
  return table[itemId] ?? 50
}

// ---------------------------------------------------------------------------
// Computer-vision pre-check (simulated).
// The resident "scans" an item before dropping it. Recyclable items map to a
// catalog item id and are accepted; non-recyclable items are rejected with a
// reason. Confidence is a preset range so the demo looks like a real model.
// ---------------------------------------------------------------------------
export const SCAN_TARGETS = [
  // Recyclable — accepted, mapped to a catalog item.
  {
    id: 'scan-pet',
    label: 'PET Plastic Bottle',
    emoji: '🍶',
    recyclable: true,
    itemId: 'pet-bottle',
    confidence: [95, 99],
  },
  {
    id: 'scan-can',
    label: 'Aluminum Can',
    emoji: '🥫',
    recyclable: true,
    itemId: 'aluminum-can',
    confidence: [96, 99],
  },
  {
    id: 'scan-carton',
    label: 'Paper Carton',
    emoji: '🧃',
    recyclable: true,
    itemId: 'paper-carton',
    confidence: [88, 95],
  },
  {
    id: 'scan-cardboard',
    label: 'Cardboard Box',
    emoji: '📦',
    recyclable: true,
    itemId: 'cardboard-box',
    confidence: [90, 97],
  },
  {
    id: 'scan-ewaste',
    label: 'Small E-Waste',
    emoji: '📱',
    recyclable: true,
    itemId: 'ewaste-small',
    confidence: [85, 94],
  },
  // Not recyclable — rejected with a reason.
  {
    id: 'scan-greasy',
    label: 'Greasy Food Container',
    emoji: '🍔',
    recyclable: false,
    reason: 'Food contamination detected — residue prevents recycling.',
    confidence: [82, 93],
  },
  {
    id: 'scan-styro',
    label: 'Polystyrene Foam',
    emoji: '🧊',
    recyclable: false,
    reason: 'Polystyrene (EPS) is not accepted at this hub.',
    confidence: [80, 90],
  },
  {
    id: 'scan-bag',
    label: 'Plastic Bag / Film',
    emoji: '🛍️',
    recyclable: false,
    reason: 'Soft plastic film jams sorting — not accepted.',
    confidence: [78, 88],
  },
  {
    id: 'scan-mixed',
    label: 'Mixed-Material Pouch',
    emoji: '🥡',
    recyclable: false,
    reason: 'Multi-layer material cannot be separated.',
    confidence: [75, 86],
  },
]

export function getScanTarget(id) {
  return SCAN_TARGETS.find((s) => s.id === id) || null
}

// Mall-tenant vouchers residents can redeem with Green Points.
export const VOUCHERS = [
  { id: 'cafe-10', name: 'Greenview Mall Café', value: 10, costTokens: 100, emoji: '☕' },
  { id: 'fnb-25', name: 'Riverside F&B Credit', value: 25, costTokens: 240, emoji: '🍜' },
  { id: 'grocery-50', name: 'Township Grocer Voucher', value: 50, costTokens: 460, emoji: '🛒' },
  { id: 'cinema-15', name: 'Township Cineplex Ticket', value: 15, costTokens: 150, emoji: '🎬' },
]

// ---------------------------------------------------------------------------
// Collection hubs across the township (Greenview township area).
// `fill` is the current fill fraction (0..1). `fillRate` is the simulated
// fraction filled per hour, used to predict time-to-full for AI dispatch.
// `capacityKg` is the physical bin capacity used to estimate collected load.
// ---------------------------------------------------------------------------
export const HUBS = [
  { id: 'hub-a', name: 'Central Hub', lat: 3.1725, lng: 101.5035, fill: 0.45, fillRate: 0.06, capacityKg: 1200 },
  { id: 'hub-b', name: 'Northgate Point', lat: 3.1962, lng: 101.5361, fill: 0.72, fillRate: 0.05, capacityKg: 900 },
  { id: 'hub-c', name: 'Lakeside Node', lat: 3.1588, lng: 101.5497, fill: 0.34, fillRate: 0.03, capacityKg: 800 },
  { id: 'hub-d', name: 'West Hub', lat: 3.1521, lng: 101.4848, fill: 0.63, fillRate: 0.04, capacityKg: 1000 },
  { id: 'hub-e', name: 'East Node', lat: 3.1844, lng: 101.5102, fill: 0.19, fillRate: 0.02, capacityKg: 700 },
  { id: 'hub-f', name: 'Parkview Point', lat: 3.1402, lng: 101.5240, fill: 0.81, fillRate: 0.055, capacityKg: 950 },
  { id: 'hub-depot', name: 'Collection Depot', lat: 3.1668, lng: 101.5215, fill: 0, fillRate: 0, capacityKg: 0, isDepot: true },
]

// Hub is flagged for pickup when its fill reaches this fraction.
export const PICKUP_THRESHOLD = 0.8

// The resident's local hub — their drop-offs fill this hub's bin.
export const HOME_HUB_ID = 'hub-a'

// Collection hubs excluding the depot.
export const COLLECTION_HUBS = HUBS.filter((h) => !h.isDepot)

export function getHub(hubId) {
  return HUBS.find((h) => h.id === hubId) || null
}

// Build the initial per-hub load (kg) from each hub's starting fill fraction.
export function initialHubLoads() {
  const loads = {}
  for (const h of COLLECTION_HUBS) {
    loads[h.id] = Math.round(h.capacityKg * h.fill)
  }
  return loads
}

// Two-truck fleet for AI dispatch. Each truck starts/ends at the depot.
export const TRUCKS = [
  { id: 'truck-1', name: 'Lorry Alpha', color: '#16a34a' },
  { id: 'truck-2', name: 'Lorry Bravo', color: '#2563eb' },
]

// Operating parameters for the live dispatch simulation.
export const DISPATCH_CONFIG = {
  dayStartMin: 9 * 60, // 09:00 — depot/fleet start of operations
  dayEndMin: 17 * 60, // 17:00 — end of operations
  cutoffMin: 15 * 60, // 15:00 — after this, pickups roll to next morning
  truckCapacityKg: 1000, // a lorry can carry this much before it must empty
  serviceMinPerHub: 25, // minutes spent loading at a hub
  avgSpeedKmh: 26, // average collection-truck speed (km/h) for travel-time estimates
  unloadMin: 20, // minutes to empty the truck at the depot
  dispatchNoticeMin: 20, // time for ops to notice a full hub and ready a truck
}

// Pickup is TRIGGERED at this fill, but the bin keeps filling while the truck
// is en route — so by the time it arrives the hub looks genuinely full. This
// stops the "collected the instant it hit 80%" feeling.
export const DISPATCH_TRIGGER = 0.8

// ---------------------------------------------------------------------------
// Operations economics (ROI model).
//
// The hub's return is NOT just scrap sales. The biggest driver is AVOIDED
// landfill/haulage cost: the township already pays a contractor to haul and
// tip waste, so every kg diverted is a kg they no longer pay to dump. Add
// commodity sales and carbon/ESG value, subtract operating cost and the GP
// that residents actually redeem, and the hub runs a surplus that pays back
// its one-time setup — proving it is a continuous operation, not a one-off
// campaign.
//
// Figures are indicative (Malaysian context, 2024) and tweakable live.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Monthly seasonality (Malaysia). Multipliers applied on top of the growth
// trend so volumes swing realistically through the year rather than following a
// perfectly smooth curve. Drivers (approximate, indicative — not official):
//  - Festive high-consumption periods lift packaging/can/bottle volume:
//    Chinese New Year (Jan/Feb), Ramadan & Hari Raya (approx Mar–Apr),
//    year-end holidays (Dec).
//  - Year-end northeast monsoon (Nov–Dec) dampens turnout/collection, partly
//    offsetting the December festive lift.
// Index 0 = January ... 11 = December.
// ---------------------------------------------------------------------------
export const MALAYSIA_SEASONALITY = [
  1.12, // Jan — CNY build-up
  1.08, // Feb — CNY
  1.05, // Mar — Ramadan build-up
  1.15, // Apr — Hari Raya peak
  0.98, // May
  0.95, // Jun — school holidays, quieter
  1.0, // Jul
  1.02, // Aug — Merdeka
  0.97, // Sep
  1.03, // Oct — Deepavali season
  0.9, // Nov — monsoon dip
  1.06, // Dec — year-end holidays vs monsoon (net lift)
]

export const ECONOMICS = {
  // Avoided cost of landfilling waste: tipping fee + haulage, per tonne.
  avoidedHaulageRmPerTonne: 230, // ~RM 0.23/kg diverted from landfill
  // Carbon value of avoided emissions (voluntary market, per tonne CO2e).
  carbonRmPerTonneCo2: 90,
  // Monthly hub operating cost (operator wages, utilities, upkeep).
  hubOpexPerMonth: 4200,
  // One-time setup cost (AI vision unit, bins, app integration, install).
  hubCapex: 85000,
  // Share of issued GP that residents actually redeem (the real cash cost).
  gpRedemptionRate: 0.65,
  // Assumed month-on-month growth in recycling volume as engagement compounds.
  monthlyGrowthRate: 0.08,
}

// ---------------------------------------------------------------------------
// Account types. Residents and mall tenants use the SAME engine — this only
// changes labels/copy so the one flow serves both personas.
// ---------------------------------------------------------------------------
export const ACCOUNT_TYPES = {
  residence: {
    id: 'residence',
    label: 'Residence',
    icon: '🏠',
    account: 'Greenview Residence · A-12-3',
    feeLabel: 'Township Maintenance Fee',
    feeShort: 'maintenance fee',
    feeAmount: DEFAULT_MAINTENANCE_FEE,
    hint: 'Recycle household waste to earn Green Points, spend them at mall tenants, or offset your maintenance fee.',
  },
  tenant: {
    id: 'tenant',
    label: 'Mall Tenant',
    icon: '🏬',
    account: 'Greenview Mall · Café Lot G-08',
    feeLabel: 'Mall Service Charge',
    feeShort: 'service charge',
    feeAmount: 980, // commercial outlets pay a higher monthly service charge
    hint: 'Outlets recycle their packaging waste (cardboard, PET) to earn Green Points and offset the monthly mall service charge.',
  },
}
