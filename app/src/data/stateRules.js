// Bottle deposit rules for all 10 deposit-law states
// Source: bottlebill.org, NCSL, state statutes

export const STATE_RULES = {
  CA: {
    state_code: 'CA',
    state_name: 'California',
    deposit_rates: {
      standard: 0.05,        // <24oz
      large: 0.10,           // >=24oz
      wine_pouch: 0.25,      // boxed wine/pouches
    },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'wine coolers', 'distilled spirits coolers',
      'carbonated water', 'soda', 'fruit juice', 'vegetable juice',
      'coffee', 'tea', 'kombucha', 'sports drinks', 'energy drinks', 'water'
    ],
    exclusions: ['milk', 'infant formula', 'medical food', '100% fruit juice >46oz'],
    size_limits: { min_oz: 0, max_oz: null },
    special_rates: {
      threshold_oz: 24,
      large_rate: 0.10,
      wine_pouch_rate: 0.25,
    },
    notes: 'CRV (California Redemption Value). Broadest beverage coverage of any state.',
  },

  CT: {
    state_code: 'CT',
    state_name: 'Connecticut',
    deposit_rates: { standard: 0.10 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'seltzer', 'water',
      'kombucha', 'energy drinks', 'sports drinks', 'hard cider'
    ],
    exclusions: ['milk', 'dairy', 'wine', 'spirits', 'juice'],
    size_limits: { min_oz: 0, max_oz: 128 },
    special_rates: null,
    notes: 'Increased from 5¢ to 10¢ in January 2024.',
  },

  HI: {
    state_code: 'HI',
    state_name: 'Hawaii',
    deposit_rates: {
      standard: 0.05,
      handling_fee: 0.01,    // non-refundable processing fee
    },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'soda', 'water', 'juice', 'tea', 'coffee',
      'sports drinks', 'energy drinks', 'wine', 'spirits'
    ],
    exclusions: ['milk', 'dairy', 'infant formula'],
    size_limits: { min_oz: 0, max_oz: 68 },
    special_rates: null,
    notes: 'HI-5 program. 1¢ non-refundable fee funds the program.',
  },

  IA: {
    state_code: 'IA',
    state_name: 'Iowa',
    deposit_rates: { standard: 0.05 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'mineral water',
      'wine coolers', 'carbonated water'
    ],
    exclusions: ['non-carbonated beverages', 'wine', 'spirits', 'juice', 'water (still)'],
    size_limits: { min_oz: 0, max_oz: null },
    special_rates: null,
    notes: 'Carbonated beverages + alcohol only. No still water or juice.',
  },

  ME: {
    state_code: 'ME',
    state_name: 'Maine',
    deposit_rates: {
      standard: 0.05,
      wine_liquor: 0.15,
    },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'soda', 'water', 'juice', 'tea', 'coffee',
      'sports drinks', 'energy drinks', 'wine', 'spirits', 'hard cider'
    ],
    exclusions: ['milk', 'dairy', 'infant formula'],
    size_limits: { min_oz: 0, max_oz: 128 },
    special_rates: {
      wine_liquor_rate: 0.15,
    },
    notes: 'Most comprehensive bottle bill. Wine and liquor containers get 15¢.',
  },

  MA: {
    state_code: 'MA',
    state_name: 'Massachusetts',
    deposit_rates: { standard: 0.05 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'mineral water',
      'carbonated water'
    ],
    exclusions: ['non-carbonated beverages', 'wine', 'spirits', 'juice', 'still water'],
    size_limits: { min_oz: 0, max_oz: null },
    special_rates: null,
    notes: 'Carbonated beverages only. Lowest redemption rate nationally (~43%).',
  },

  MI: {
    state_code: 'MI',
    state_name: 'Michigan',
    deposit_rates: { standard: 0.10 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'carbonated water',
      'mineral water', 'wine coolers'
    ],
    exclusions: ['non-carbonated beverages', 'wine', 'spirits', 'juice'],
    size_limits: { min_oz: 0, max_oz: 128 },
    special_rates: null,
    notes: 'Highest single deposit rate. 97% return rate — best in the nation.',
  },

  NY: {
    state_code: 'NY',
    state_name: 'New York',
    deposit_rates: { standard: 0.05 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'carbonated water',
      'seltzer', 'water', 'wine coolers'
    ],
    exclusions: ['wine', 'spirits', 'juice', 'dairy', 'non-carbonated (except water)'],
    size_limits: { min_oz: 0, max_oz: 128 },
    special_rates: null,
    notes: 'Carbonated beverages + water. Containers under 1 gallon.',
  },

  OR: {
    state_code: 'OR',
    state_name: 'Oregon',
    deposit_rates: { standard: 0.10 },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'water',
      'kombucha', 'hard cider', 'wine (canned)', 'coffee'
    ],
    exclusions: ['spirits', 'wine (glass)', 'dairy', 'infant formula'],
    size_limits: { min_oz: 4, max_oz: 128 },
    special_rates: null,
    notes: 'Includes canned wine. BottleDrop return system. 87% return rate.',
  },

  VT: {
    state_code: 'VT',
    state_name: 'Vermont',
    deposit_rates: {
      standard: 0.05,
      liquor: 0.15,
    },
    eligible_containers: ['glass', 'plastic', 'aluminum', 'bi-metal'],
    eligible_beverages: [
      'beer', 'malt', 'carbonated soda', 'water',
      'spirits', 'wine coolers', 'hard cider'
    ],
    exclusions: ['wine', 'juice', 'dairy'],
    size_limits: { min_oz: 0, max_oz: 128 },
    special_rates: {
      liquor_rate: 0.15,
    },
    notes: 'First bottle bill state (1953). Spirits containers get 15¢.',
  },
}

// All 50 US states for the dropdown
export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

// Quick lookup: does this state have a bottle deposit law?
export const DEPOSIT_STATES = new Set(Object.keys(STATE_RULES))

export function hasDepositLaw(stateCode) {
  return DEPOSIT_STATES.has(stateCode)
}
