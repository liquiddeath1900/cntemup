// Deposit tips — general + state-specific advice
// Free feature for all users
// Written from real-world bottle redemption experience

export const GENERAL_TIPS = [
  {
    title: 'Finding the Deposit Mark',
    tips: [
      'On CANS: check the top of the can — the deposit info is printed on the lid area',
      'On PLASTIC & GLASS: look near the barcode — that\'s where the deposit mark lives',
      'The container MUST have a label — the material and label are married. If the label is ripped off, the bottle is now trash to the machine',
      'Learn which containers carry a deposit — not everything does. Rule of thumb: beer, soda, water, seltzer in deposit states',
      'A "5¢ deposit" stamp does NOT mean you can redeem it anywhere — it must be returned in the STATE where the deposit was paid (NY deposit = redeem in NY, CT deposit = redeem in CT)',
    ],
  },
  {
    title: 'Sorting & Storage',
    tips: [
      'NEVER crush containers — they need to go through a machine to get scanned and counted. Crushed = rejected',
      'Sort by material type — aluminum cans, plastic bottles, glass bottles separately',
      'Rinse containers before storing — this prevents bugs, insects, and flies from building up',
      'Use clear/transparent bags — helps a lot when sorting and at redemption centers',
      'Keep labels intact — a bottle without a label cannot be scanned and will be rejected',
    ],
  },
  {
    title: 'Maximizing Returns',
    tips: [
      'Count before you go — use CNTEM\'UP so you know your expected payout',
      'Keep track of your deposits — check your state\'s requirements if you\'re redeeming large amounts',
      'Go during off-peak hours (weekday mornings) for shorter waits',
      'Know which beverages qualify in YOUR state — it varies. NY covers water, MA doesn\'t',
    ],
  },
  {
    title: 'Where to Redeem',
    tips: [
      'Reverse vending machines at stores are convenient but have LIMITS on how many you can return at once — caps exist so everyone gets a turn',
      'Redemption centers allow you to return LARGER amounts — better for serious collectors',
      'Know the limits before you go — some machines cap at 120-240 containers per visit',
      'Supermarkets are required to accept returns if they sell those beverages (in most deposit states)',
      'Some states have dedicated systems (Oregon BottleDrop, Michigan retailer returns) — learn your state\'s system',
    ],
  },
]

export const STATE_TIPS = {
  CA: {
    state_name: 'California',
    rate_info: '5¢ under 24oz, 10¢ for 24oz+',
    tips: [
      'CRV applies to almost everything — beer, soda, water, juice, coffee, tea',
      'Containers 24oz+ get 10¢ each — sort large bottles separately for more money',
      'Wine/liquor pouches are 25¢ each',
      'Recycling centers may pay by weight as an option — compare to see which pays more for your load',
      'Use CalRecycle.ca.gov to find your nearest certified recycling center',
      'CA has one of the broadest lists of eligible beverages — most drinks count',
    ],
  },
  CT: {
    state_name: 'Connecticut',
    rate_info: '10¢ per container',
    tips: [
      'Connecticut doubled to 10¢ in 2024 — every container is worth more now',
      'Covers beer, soda, seltzer, water, kombucha, energy drinks, sports drinks',
      'Wine, spirits, and juice are NOT included',
      'Most grocery stores accept returns via reverse vending machines',
      'Only redeem CT-deposit containers in CT — other states\' deposits won\'t scan',
    ],
  },
  HI: {
    state_name: 'Hawaii',
    rate_info: '5¢ per container (plus 1¢ fee)',
    tips: [
      'HI-5 program covers almost everything including wine and spirits containers',
      'The 1¢ non-refundable fee funds the program — you get 5¢ back per container',
      'Max container size is 68oz',
      'Certified redemption centers available on all major islands',
      'Look for the HI-5 mark on containers — if it\'s there, it\'s redeemable',
    ],
  },
  IA: {
    state_name: 'Iowa',
    rate_info: '5¢ per container',
    tips: [
      'Iowa only covers carbonated beverages and alcohol containers',
      'No still water, juice, or non-carbonated drinks qualify',
      'Retailers are required to accept returns during business hours',
      'No size limit on eligible containers',
      'Return containers to where you bought them — retailers must accept what they sell',
    ],
  },
  ME: {
    state_name: 'Maine',
    rate_info: '5¢ standard, 15¢ wine/liquor',
    tips: [
      'Maine has the most comprehensive bottle bill — almost everything qualifies',
      'Wine and liquor containers get 15¢ each — keep those separate, they\'re worth triple!',
      'Covers juice, coffee, tea, sports drinks, and more',
      'Check out CLYNK bag drop locations — fill a bag, drop it off, get credited automatically',
      'Maine covers more beverage types than any other state',
    ],
  },
  MA: {
    state_name: 'Massachusetts',
    rate_info: '5¢ per container',
    tips: [
      'Massachusetts only covers carbonated beverages — no water, juice, or non-carbonated',
      'Has the lowest redemption rate nationally (~43%) — that means more uncollected deposits out there',
      'Reverse vending machines at most major grocery stores',
      'Only carbonated soda, beer, malt, mineral water, and carbonated water qualify',
    ],
  },
  MI: {
    state_name: 'Michigan',
    rate_info: '10¢ per container',
    tips: [
      'Michigan has the highest single deposit rate at 10¢ — every container counts',
      '97% return rate — the best in the nation, so competition for finding containers is high',
      'NEVER crush cans — machines need to read the barcode on every container',
      'Only carbonated beverages qualify (beer, soda, carbonated water)',
      'Retailers must accept returns if they sell those beverages — it\'s the law',
      'Know the machine limits at stores — there are caps per visit',
    ],
  },
  NY: {
    state_name: 'New York',
    rate_info: '5¢ per container',
    tips: [
      'Covers carbonated beverages AND water (still water included since 2009)',
      'Wine, spirits, juice, and dairy are NOT covered',
      'Containers must be under 1 gallon (128oz)',
      'NYC has many independent redemption centers — great for large volumes with minimal wait',
      'Supermarkets are required to accept returns if they sell those beverages',
      'Only redeem containers with NY deposit marks — out-of-state deposits won\'t work',
      'Redemption centers are better for large amounts, machines are better for quick small loads',
    ],
  },
  OR: {
    state_name: 'Oregon',
    rate_info: '10¢ per container',
    tips: [
      'Oregon\'s BottleDrop system is very efficient — sign up for a free account',
      'BottleDrop bags: fill a bag, drop it off at a location, get credited to your account automatically',
      'Includes canned wine (but not glass wine bottles)',
      'Min 4oz, max 128oz containers',
      '87% return rate — one of the best programs nationally',
      'BottleDrop Plus gives you 20% extra credit at participating retailers',
    ],
  },
  VT: {
    state_name: 'Vermont',
    rate_info: '5¢ standard, 15¢ liquor',
    tips: [
      'Vermont was the first bottle bill state (1953) — the OG',
      'Spirits containers get 15¢ each — save those separately',
      'Covers beer, soda, water, hard cider, and spirits',
      'Wine and juice are NOT covered',
      'Many small stores accept returns — support local redemption',
    ],
  },
}

// Non-deposit states get general guidance
export const NON_DEPOSIT_STATE_TIP = {
  title: 'No Bottle Deposit Law',
  message: 'Your state doesn\'t have a bottle deposit law yet, but you can still recycle! Check local recycling programs for curbside pickup or drop-off locations. Some scrap yards buy aluminum cans by weight — it\'s not as much per can but it adds up.',
}
