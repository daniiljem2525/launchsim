// LaunchSim deterministic simulation engine (Demo Mode).
// Produces structured, explainable estimates from project inputs.
// All outputs are clearly labeled as simulation estimates — never as real market data.
// When AI provider keys are configured (see ai.js), the same pipeline can call
// real models through the same interface; the demo engine is the offline fallback.

// ---------- seeded RNG ----------
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmtMoney = (n) => '$' + (n >= 100 ? Math.round(n) : n.toFixed(2));

// ---------- category knowledge (sample dataset, labeled as such) ----------
const CATEGORIES = {
  pet: {
    key: 'pet', label: 'Pet services',
    match: /dog|cat|pet|puppy|sitter|groom|vet|animal/i,
    demand: 0.78, severity: 0.55, competition: 0.62, retention: 0.55,
    priceFloor: 5, priceCeiling: 60, freq: 'recurring need, often weekly',
    ctrBase: 2.6, signupBase: 7.5, cacNote: 'paid social CAC for consumer apps in this space is typically $15–45',
    pains: [
      'Hard to judge whether a provider is actually trustworthy',
      'Last-minute cancellations leave owners without coverage',
      'Existing marketplaces feel impersonal and slow to match',
      'Fear of leaving an animal with a stranger',
    ],
    customerLanguage: ['“I just need someone I can trust”', '“My dog is family”', '“Last-minute is when it breaks”'],
    competitors: [
      { name: 'Rover', kind: 'direct', price: 'Sitter rates $15–60/visit · platform fee ~15–25%', audience: 'Mass-market US pet owners', positioning: 'Biggest pet-sitting network', features: ['Two-sided booking marketplace', 'Sitter profiles, reviews & badges', 'GPS-tracked walks & photo updates', 'Rover Guarantee + vet support', '24/7 support'], strength: 'Supply density and brand recognition', weakness: 'Commission-driven; sitter quality varies; fees squeeze sitter pay', registrations: 'Multi-million user base; 10M+ services delivered (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Wag!', kind: 'direct', price: 'Walks ~$25–35 · platform fee ~10–20%', audience: 'Urban on-demand dog owners', positioning: 'On-demand dog walking', features: ['On-demand walk booking', 'Lockbox key access', 'Live GPS tracking', 'Sitter ratings'], strength: 'Instant on-demand supply in big cities', weakness: 'High sitter churn; mixed pay reviews; thin trust layer', registrations: 'Millions of walks booked (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Local sitting agencies', kind: 'direct', price: '$30–60 / visit', audience: 'Higher-income urban owners', positioning: 'Premium, vetted', features: ['Manual vetting', 'Recurring same sitter', 'Phone support'], strength: 'Real trust via human vetting', weakness: 'Expensive, limited availability, no app UX', registrations: 'Not enough evidence', evidence: 'no public data' },
      { name: 'Informal network (neighbors, group chats)', kind: 'substitute', price: 'Free–$20', audience: 'Everyone', positioning: 'Free and familiar', features: ['Personal trust', 'No booking flow', 'No accountability'], strength: 'Zero cost, trusted people', weakness: 'Unreliable, no backup, no accountability', registrations: 'Not enough evidence', evidence: 'no public data' },
      { name: 'Boarding kennels', kind: 'substitute', price: '$25–50 / night', audience: 'Traveling owners', positioning: 'Full-service facility', features: ['Physical facility', 'Staff on site', 'Long stays'], strength: 'Capacity for long stays', weakness: 'Stressful for animals; impersonal', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Most competitors compete on convenience and selection. Few make verified trust the core promise.',
  },
  productivity: {
    key: 'productivity', label: 'Productivity / SaaS',
    match: /task|todo|note|productiv|workflow|team|project|calendar|time|focus/i,
    demand: 0.6, severity: 0.45, competition: 0.85, retention: 0.4,
    priceFloor: 4, priceCeiling: 30, freq: 'daily-use category, but crowded',
    ctrBase: 1.9, signupBase: 6.0, cacNote: 'search-driven CAC in this space is typically $30–120 per paying user',
    pains: ['Tool fatigue — too many apps already', 'Setup cost feels higher than the payoff', 'Team members refuse to adopt yet another tool'],
    customerLanguage: ['“I already have 3 tools for this”', '“If it needs onboarding, I quit”'],
    competitors: [
      { name: 'Notion', kind: 'direct', price: 'Free · Plus $8–10 / user / mo', audience: 'Teams and prosumers', positioning: 'All-in-one flexible workspace', features: ['Docs + databases + wiki', 'Templates ecosystem', 'AI add-on ($8–10/mo)', 'Offline-first mobile apps'], strength: 'Ecosystem, habit, community templates', weakness: 'Requires setup discipline; generic out of the box', registrations: '30M+ users (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Todoist', kind: 'direct', price: 'Free · Pro ~$4–5 / mo', audience: 'Personal task management', positioning: 'Fast natural-language tasks', features: ['Natural language input', 'Projects & labels', 'Karma streaks', 'Cross-platform'], strength: 'Speed and habit', weakness: 'Shallow for teams; weak reporting', registrations: 'Tens of millions of installs (store data)', evidence: 'public reference, not verified live' },
      { name: 'Spreadsheets + chat (workaround)', kind: 'substitute', price: 'Free', audience: 'Everyone', positioning: 'Free but fragmented', features: ['Flexible', 'No learning curve', 'Manual sync'], strength: 'Zero switching cost', weakness: 'Error-prone, no automation', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Most tools compete on features. Few win on zero-setup time-to-value.',
  },
  health: {
    key: 'health', label: 'Health & fitness',
    match: /fit|health|workout|gym|diet|nutrition|sleep|mental|therapy|medit/i,
    demand: 0.7, severity: 0.6, competition: 0.7, retention: 0.35,
    priceFloor: 5, priceCeiling: 40, freq: 'motivation-sensitive; weekly usage common, churn high',
    ctrBase: 2.2, signupBase: 8.0, cacNote: 'consumer health CAC is typically $20–60',
    pains: ['Plans are generic, not adapted to the person', 'Motivation collapses after 2–3 weeks', 'Distrust of generic advice'],
    customerLanguage: ['“I know what to do, I just don’t do it”', '“Nothing worked for me before”'],
    competitors: [
      { name: 'MyFitnessPal', kind: 'direct', price: 'Free · Premium ~$19.99 / mo', audience: 'Mass-market calorie trackers', positioning: 'Largest food database', features: ['Food barcode scanning', 'Calorie & macro tracking', 'Huge food database', 'Community'], strength: 'Database size and habit', weakness: 'Generic plans; premium paywall resentment', registrations: '~200M registered users (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Noom', kind: 'direct', price: 'Program ~$40–70 / mo', audience: 'Psychology-driven weight loss', positioning: 'Behavior-change curriculum', features: ['Daily lessons', 'Human + AI coaching', 'Food logging'], strength: 'Perceived depth of program', weakness: 'Expensive; aggressive signup funnels; churn after program', registrations: 'Millions of users (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Strava', kind: 'direct', price: 'Free · $11.99 / mo', audience: 'Serious runners & cyclists', positioning: 'Social fitness network', features: ['Activity tracking', 'Segments & leaderboards', 'Social feed'], strength: 'Athlete community lock-in', weakness: 'Narrow audience; weak for beginners', registrations: '100M+ athletes (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Human coaches', kind: 'substitute', price: '$80–250 / mo', audience: 'High-commitment users', positioning: 'Accountability', features: ['Personal plans', 'Live check-ins', 'Form correction'], strength: 'Real accountability', weakness: 'Expensive, scheduling friction', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Most apps sell content. Accountability and habit design are underserved.',
  },
  education: {
    key: 'education', label: 'Education & learning',
    match: /learn|course|tutor|study|exam|language|school|teach|student/i,
    demand: 0.66, severity: 0.5, competition: 0.72, retention: 0.38,
    priceFloor: 5, priceCeiling: 50, freq: 'goal-based usage; strong seasonal spikes',
    ctrBase: 2.0, signupBase: 7.0, cacNote: 'typical CAC $15–50 depending on exam season',
    pains: ['Generic courses don’t adapt to level', 'Hard to know if it actually works', 'Progress feels invisible'],
    customerLanguage: ['“I tried YouTube first”', '“I need results before {deadline}”'],
    competitors: [
      { name: 'Duolingo', kind: 'direct', price: 'Free · Super ~$12.99 / mo', audience: 'Casual language learners', positioning: 'Gamified daily lessons', features: ['Streaks & leagues', 'Adaptive difficulty', 'Speaking practice', 'Huge course catalog'], strength: 'Habit mechanics and brand', weakness: 'Weak for exam outcomes; shallow depth per lesson', registrations: '500M+ registered users (public reports)', evidence: 'public reference, not verified live' },
      { name: 'Quizlet', kind: 'direct', price: 'Free · Plus ~$7.99 / mo', audience: 'Students cramming', positioning: 'Flashcards & study sets', features: ['User-generated decks', 'Learn mode', 'Practice tests'], strength: 'Content volume from students', weakness: 'Quality varies; AI features feel thin', registrations: '~60M monthly users (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Anki', kind: 'substitute', price: 'Free (desktop) · $24.99 iOS', audience: 'Med students, hardcore learners', positioning: 'Spaced repetition power tool', features: ['True SRS scheduling', 'Shared decks', 'Add-ons'], strength: 'Gold-standard algorithm', weakness: 'Ugly UX; steep learning curve', registrations: 'Tens of millions of downloads (estimates)', evidence: 'public reference, not verified live' },
      { name: 'Human tutors', kind: 'substitute', price: '$20–60 / hour', audience: 'Exam-driven students', positioning: 'Personal attention', features: ['Live sessions', 'Custom explanations', 'Accountability'], strength: 'Outcomes', weakness: 'Cost, scheduling', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Outcome guarantees and adaptive level-matching are underemphasized.',
  },
  food: {
    key: 'food', label: 'Food & meal planning',
    match: /meal|recipe|cook|kitchen|grocery|food|restaurant|menu/i,
    demand: 0.7, severity: 0.42, competition: 0.68, retention: 0.45,
    priceFloor: 4, priceCeiling: 30, freq: 'habit-forming: weekly planning, daily cooking',
    ctrBase: 2.1, signupBase: 6.5, cacNote: 'consumer food-app CAC is typically $15–40',
    pains: ['Weekly planning takes time nobody has', 'Groceries get wasted when plans change', 'Generic recipes ignore dietary goals'],
    customerLanguage: ['“I end up ordering takeout anyway”', '“I need something my kids will eat”'],
    competitors: [
      { name: 'HelloFresh', kind: 'direct', price: '~$9–12 / serving', audience: 'Busy households', positioning: 'Meal-kit delivery', features: ['Weekly box of ingredients', 'Recipe cards', 'Flexible skip weeks'], strength: 'Convenience logistics', weakness: 'Per-meal cost; packaging waste complaints', registrations: '~7–8M active customers (public reports)', evidence: 'public reference, not verified live' },
      { name: 'Free recipe sites & apps', kind: 'substitute', price: 'Free / ads', audience: 'Everyone', positioning: 'Endless recipes', features: ['Huge catalogs', 'Search & filters', 'Reviews'], strength: 'Free, huge catalog', weakness: 'No planning, no adaptation, ad-heavy', registrations: 'Tens of millions of monthly users (category)', evidence: 'public reference, not verified live' },
      { name: 'Grocery store apps (Instacart etc.)', kind: 'substitute', price: 'Basket + fees', audience: 'Online grocery shoppers', positioning: 'Fast grocery delivery', features: ['Instant cart building', 'Delivery slots', 'Deals'], strength: 'Logistics', weakness: 'No meal planning brain', registrations: 'Instacart: millions of monthly orders (public reports)', evidence: 'public reference, not verified live' },
    ],
    whiteSpace: 'Most solutions deliver content (recipes). Few own the full weekly loop: plan → shop → cook → adapt.',
  },
  ai: {
    key: 'ai', label: 'AI-powered tools',
    match: /\bai\b|gpt|llm|chatbot|neural|copywriting|resume|cv|interview|writing assistant/i,
    demand: 0.72, severity: 0.4, competition: 0.9, retention: 0.32,
    priceFloor: 5, priceCeiling: 40, freq: 'trial-heavy; usage drops after first success',
    ctrBase: 2.4, signupBase: 9.0, cacNote: 'AI-tool CAC is volatile; free-tool competition is intense',
    pains: ['“Another AI wrapper” skepticism', 'Output quality is hit-or-miss', 'Unclear what it does better than a chatbot'],
    customerLanguage: ['“Can’t ChatGPT do this?”', '“Show me output quality first”'],
    competitors: [
      { name: 'ChatGPT', kind: 'substitute', price: 'Free · Plus $20 / mo', audience: 'Everyone', positioning: 'General-purpose AI assistant', features: ['Any-task chat', 'File & image input', 'Custom GPTs', 'API'], strength: 'Free/cheap, infinitely flexible', weakness: 'No workflow, no guarantee, prompt fatigue', registrations: '~100M+ weekly users (company claims, 2023+)', evidence: 'public reference, not verified live' },
      { name: 'Grammarly', kind: 'direct', price: 'Free · Pro ~$12 / mo', audience: 'Writers & professionals', positioning: 'Writing assistant everywhere', features: ['Real-time corrections', 'Tone suggestions', 'Browser extension', 'Plagiarism check'], strength: 'Distribution via extension', weakness: 'Generic suggestions; pricing per seat', registrations: '30M+ daily users (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Jasper', kind: 'direct', price: '~$39–49 / mo', audience: 'Marketing teams', positioning: 'Brand-tuned AI copy', features: ['Brand voice', 'Campaign templates', 'Team workflows'], strength: 'Marketing workflow focus', weakness: 'Expensive; output needs editing', registrations: '100k+ customers (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Vertical AI startups', kind: 'direct', price: '$10–30 / mo', audience: 'Niche professionals', positioning: 'Tailored workflow', features: ['Niche templates', 'Integrations', 'Automation'], strength: 'Focus', weakness: 'Crowded niches; shallow moats', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Winners own a verifiable outcome (e.g., “passes screening”), not a generation feature.',
  },
  commerce: {
    key: 'commerce', label: 'E-commerce / marketplace',
    match: /shop|store|market|sell|buy|product|brand|dropship|resale/i,
    demand: 0.6, severity: 0.4, competition: 0.85, retention: 0.42,
    priceFloor: 3, priceCeiling: 60, freq: 'purchase-driven; margin is the constraint',
    ctrBase: 2.1, signupBase: 4.5, cacNote: 'purchase CAC is typically $25–80',
    pains: ['Trust in unknown sellers', 'Shipping cost and time', 'Returns are painful'],
    customerLanguage: ['“Is this legit?”', '“When does it actually arrive?”'],
    competitors: [
      { name: 'Amazon', kind: 'direct', price: 'Product price + Prime', audience: 'Everyone', positioning: 'Everything, fast', features: ['Prime logistics', 'Reviews at scale', 'Easy returns', 'Marketplace sellers'], strength: 'Logistics and delivery trust', weakness: 'Impersonal; counterfeit risk in niches', registrations: '200M+ Prime members (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Etsy', kind: 'direct', price: '6.5% transaction fee', audience: 'Handmade & niche buyers', positioning: 'Unique goods', features: ['Seller shops', 'Reviews', 'Niche search'], strength: 'Niche trust and uniqueness', weakness: 'Fee creep; shipping variance', registrations: '~90M active buyers (company claims)', evidence: 'public reference, not verified live' },
      { name: 'Facebook Marketplace', kind: 'substitute', price: 'Free', audience: 'Local buyers & sellers', positioning: 'Free local commerce', features: ['Local listings', 'Chat', 'No fees'], strength: 'Zero fees, local reach', weakness: 'Scam risk; no guarantees', registrations: '~1B+ monthly users (category-wide)', evidence: 'public reference, not verified live' },
    ],
    whiteSpace: 'Underserved niches with specific quality guarantees.',
  },
  generic: {
    key: 'generic', label: 'General consumer / prosumer software',
    match: /.*/,
    demand: 0.5, severity: 0.4, competition: 0.6, retention: 0.4,
    priceFloor: 4, priceCeiling: 40, freq: 'depends on habit formation',
    ctrBase: 2.0, signupBase: 6.0, cacNote: 'consumer CAC typically $10–50',
    pains: ['Existing solutions are clunky', 'Too expensive for the value', 'Too generic for this specific need'],
    customerLanguage: ['“I do it manually today”'],
    competitors: [
      { name: 'Manual workaround (spreadsheets, chats)', kind: 'substitute', price: 'Free', audience: 'Everyone', positioning: 'Free but painful', features: ['Flexible', 'No learning curve', 'Manual sync'], strength: 'No switching cost', weakness: 'Error-prone, slow', registrations: 'Not enough evidence', evidence: 'no public data' },
      { name: 'Adjacent niche tools', kind: 'direct', price: '$5–20 / mo', audience: 'Power users of the workflow', positioning: 'Partial overlap', features: ['Adjacent features', 'Established workflows'], strength: 'Already installed', weakness: 'Not built for this job', registrations: 'Not enough evidence', evidence: 'no public data' },
    ],
    whiteSpace: 'Not enough evidence to identify a specific gap without real market data.',
  },
};

function detectCategory(text) {
  for (const c of Object.values(CATEGORIES)) {
    if (c.key !== 'generic' && c.match.test(text)) return c;
  }
  return CATEGORIES.generic;
}
export { detectCategory, CATEGORIES };

const CHANNELS = {
  meta: { label: 'Meta Ads', cpm: 11, ctrMult: 1.0, fit: /consumer|owner|parent|student|people|urban|local/i },
  google: { label: 'Google Ads', cpm: 18, ctrMult: 1.25, fit: /b2b|professional|business|software|team|saas/i },
  tiktok: { label: 'TikTok Ads', cpm: 7, ctrMult: 1.35, fit: /young|gen ?z|student|creator|trend/i },
};

// ---------- business model structuring ----------
const STOP = /\b(i|want|to|build|an|a|app|that|helps|help|for|the|my|with|of|and|in|on|it|is|are|users|user|people|make|making|get|getting|be|can|will|should|their|they|our|this|these|those|so|because|when|where|how|what|which|who|would|could|using|use|used|via|by|from|into|about)\b/gi;

function deriveProductName(inputs, rng) {
  if (inputs.name && inputs.name.trim()) return inputs.name.trim().slice(0, 40);
  const words = (inputs.what || '').replace(STOP, ' ').split(/\s+/).filter((w) => w.length > 3);
  const nouns = words.map((w) => w.replace(/[^a-zA-Z]/g, '')).filter(Boolean);
  const base = nouns.length ? nouns[Math.min(1, nouns.length - 1)] : 'Idea';
  const b = base[0].toUpperCase() + base.slice(1).toLowerCase();
  return pick(rng, [b + 'Kit', b + 'Hub', b + 'Flow', b + 'App', b + 'Desk', b + 'Pilot']).slice(0, 40);
}

export function structureIdea(inputs, seed) {
  const rng = mulberry32(seed);
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const price = Number(inputs.price) || 9;
  const model = inputs.model || 'subscription';
  const isSub = model === 'subscription' || model === 'freemium';
  const channels = Object.entries(CHANNELS)
    .filter(([, c]) => c.fit.test(inputs.audience || ''))
    .map(([, c]) => c.label);
  const acquisition = channels.length ? channels.join(' / ') : 'Meta / TikTok';
  return {
    product: deriveProductName(inputs, rng),
    category: cat.label,
    audience: (inputs.audience || 'General consumers').trim(),
    problem: (inputs.problem || 'Unspecified problem').trim(),
    solution: (inputs.what || '').trim().slice(0, 220),
    businessModel: model,
    price: `${fmtMoney(price)}${isSub ? '/month' : ' one-time'}`,
    targetMarket: inputs.market || 'United States',
    acquisition,
    primaryKpi: isSub ? 'Paid conversions per week' : (model === 'marketplace' ? 'Completed transactions per week' : 'Purchases per week'),
  };
}

// ---------- research ----------
export function generateResearch(inputs, structured, seed, depth = 'basic') {
  const rng = mulberry32(seed);
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const SAMPLE = 'Illustrative sample dataset (Demo Mode) — not live market data.';
  const unmet = [
    cat.whiteSpace,
    `Respondents in the sample describe trust and reliability as the deciding factor — price comes second for ${structured.audience.toLowerCase()}.`,
  ];
  const research = {
    disclaimer: SAMPLE,
    evidenceLevel: depth === 'deep' ? 'sample (extended)' : 'sample',
    marketOverview: [
      `Assumed category: ${cat.label}. The idea targets ${structured.audience.toLowerCase()} in ${structured.targetMarket}.`,
      `Usage pattern in this category: ${cat.freq}.`,
      'Live market sizing is unavailable in Demo Mode: Not enough evidence for TAM/SAM/SAM figures.',
    ],
    pricingLandscape: [
      `Sample price range for similar offers: ${fmtMoney(cat.priceFloor)}–${fmtMoney(cat.priceCeiling)}. Your planned price: ${structured.price}.`,
      cat.key === 'generic' ? 'Not enough evidence for precise competitor pricing.' : `Sample competitors cluster in the mid-range; premium positioning is possible but must be earned with proof.`,
    ],
    painPoints: cat.pains.map((p, i) => ({ id: `P${i + 1}`, text: p })),
    customerLanguage: cat.customerLanguage,
    unmetNeeds: unmet,
    marketRisks: [
      competitionRisk(cat, structured),
      'Demo Mode: no live demand signals. Not enough evidence for search/ad volume in this niche.',
    ],
    opportunities: [
      cat.whiteSpace,
      `Narrow positioning for a specific segment of ${structured.audience.toLowerCase()} can beat generic incumbents on relevance.`,
    ],
    trends: depth === 'deep'
      ? ['Deep research in Demo Mode reuses the same sample dataset with more exhaustive checks — no live trend data available.']
      : ['Not enough evidence: trend data requires a connected research API.'],
  };
  return research;
}
function competitionRisk(cat, structured) {
  const level = cat.competition;
  if (level > 0.8) return 'Very crowded category: differentiation must be specific and provable, not cosmetic.';
  if (level > 0.6) return 'Established competitors exist; expect skepticism and higher acquisition costs.';
  return 'Competitive intensity is moderate in the sample dataset.';
}

// ---------- hypotheses ----------
export function generateHypotheses(inputs, structured, seed) {
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const price = Number(inputs.price) || 9;
  const isSub = structured.businessModel === 'subscription' || structured.businessModel === 'freemium';
  const H = [
    { code: 'A1', text: `${structured.audience} experience this problem frequently enough to look for a solution.`, importance: 90, confidence: 'MEDIUM', evidence: `Category usage pattern: ${cat.freq}.`, status: 'UNKNOWN', why: 'Core demand assumption — if false, nothing else matters.' },
    { code: 'A2', text: 'Current solutions leave them dissatisfied.', importance: 75, confidence: cat.competition > 0.7 ? 'MEDIUM' : 'LOW', evidence: `Sample competitors: ${cat.competitors.length}. Sample pain points listed in research.`, status: cat.competition > 0.7 ? 'UNKNOWN' : 'WEAK', why: 'Dissatisfaction is the entry wedge.' },
    { code: 'A3', text: `They are willing to pay ${structured.price} for this.`, importance: 85, confidence: 'LOW', evidence: `Sample price range in category: ${fmtMoney(cat.priceFloor)}–${fmtMoney(cat.priceCeiling)}.`, status: Number(inputs.price) > cat.priceCeiling ? 'RISK' : 'UNKNOWN', why: 'Price is the sharpest test of value.' },
    { code: 'A4', text: 'They will switch from their current workaround to try it.', importance: 70, confidence: 'LOW', evidence: 'Switching cost is the hidden tax on every new product.', status: 'UNKNOWN', why: 'Trying is the first real commitment.' },
    { code: 'A5', text: `Customer acquisition via ${structured.acquisition} can be economically viable (CAC < 3–6 months of revenue).`, importance: 80, confidence: 'LOW', evidence: cat.cacNote + '.', status: 'RISK', why: 'Unit economics decide survival.' },
    { code: 'A6', text: isSub ? 'Subscribers stay long enough (3+ months) to justify CAC.' : 'Buyers return or refer others.', importance: 65, confidence: 'LOW', evidence: `Category retention in sample: ${Math.round(cat.retention * 100)}% (illustrative).`, status: isSub ? 'RISK' : 'UNKNOWN', why: 'Retention turns purchases into a business.' },
    { code: 'A7', text: `Differentiation is real: "${cat.whiteSpace}"`, importance: 60, confidence: cat.key === 'generic' ? 'LOW' : 'MEDIUM', evidence: 'Derived from sample competitor positioning, not verified.', status: cat.key === 'generic' ? 'WEAK' : 'UNKNOWN', why: 'Without a wedge, this is a feature of someone else’s product.' },
  ];
  if ((inputs.validate || []).length) {
    H.forEach((h) => {
      const v = (inputs.validate || []).join(' ');
      if (/willingness to pay|pricing/i.test(v) && h.code === 'A3') { h.why = 'You marked this as a validation goal — treat as primary.'; h.importance = Math.min(95, h.importance + 5); }
      if (/acquisition/i.test(v) && h.code === 'A5') { h.why = 'You marked this as a validation goal — treat as primary.'; h.importance = Math.min(95, h.importance + 5); }
    });
  }
  return H;
}

// ---------- product simulator ----------
export function generateLanding(structured, seed, overrides = {}) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const prob = shortProblem(structured.problem);
  const audience = structured.audience.toLowerCase();
  return {
    headline: overrides.headline || pick(rng, [
      `${prob} — solved.`,
      `${structured.product}: built for ${audience}.`,
      `Stop ${shortProblem(structured.problem).toLowerCase()}. Start ${firstPhrase(structured.solution) || 'moving'}.`,
    ]),
    subheadline: overrides.subheadline || `${structured.solution} For ${structured.audience.toLowerCase()} in ${structured.targetMarket}. ${structured.price}.`,
    cta: overrides.cta || pick(rng, ['Start free', 'Try it now', 'Get early access']),
    benefits: [
      `Removes the core friction: ${prob}`,
      `Designed for ${audience}`,
      `Fair pricing: ${structured.price}`,
      'Cancel anytime — no lock-in',
    ],
    features: [
      { name: 'Fast setup', text: 'Works in under 5 minutes, no configuration.' },
      { name: 'Core workflow', text: firstPhrase(structured.solution) || 'One clear primary action.' },
      { name: 'Trust layer', text: 'Verification and transparency built in.' },
      { name: 'Progress tracking', text: 'See results and history at a glance.' },
    ],
    pricing: { plan: 'Core', price: structured.price, note: 'Single plan to start. No feature paywalls.' },
    faq: [
      { q: 'How is this different from existing options?', a: `It focuses on one job: ${prob}. No bloat.` },
      { q: 'What does it cost?', a: `${structured.price}. Cancel anytime.` },
      { q: 'Is my data safe?', a: 'Data is encrypted and never sold.' },
      { q: 'Can I cancel?', a: 'Yes, in one click from settings.' },
    ],
  };
}
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function firstPhrase(s) {
  if (!s) return '';
  const m = s.replace(/^(i want to build|build|create)\s+(an?|the)?\s*/i, '').split(/[.,;]/)[0];
  return m.length > 4 ? m.toLowerCase() : '';
}
// Short punchy problem phrase for headlines: first clause, capped at 8 words.
function shortProblem(problem) {
  const firstClause = String(problem || '').replace(/\.$/, '').split(/[,;:—]/)[0].trim();
  const words = firstClause.split(/\s+/);
  const cut = (words.length > 8 ? words.slice(0, 8).join(' ') : firstClause).replace(/[.,]$/, '');
  return capitalize(cut.toLowerCase());
}

export function generateProductConcept(structured, seed) {
  return {
    valueProposition: `For ${structured.audience.toLowerCase()} who ${structured.problem.toLowerCase()}, ${structured.product} is a ${structured.businessModel} product that ${firstPhrase(structured.solution) || 'solves it directly'}. Unlike workarounds, it is built around a single primary action.`,
    onboarding: [
      'Step 1 — Sign up with email (no card required)',
      'Step 2 — One question that personalizes the experience',
      'Step 3 — Land on the primary action immediately',
    ],
    coreWorkflow: [
      'User states the goal in one sentence',
      'System produces the result in one screen',
      'User saves/shares or repeats',
    ],
    primaryAction: 'One prominent button per screen; everything else is secondary.',
  };
}

export function generateAdConcepts(structured, seed) {
  const prob = shortProblem(structured.problem);
  const sol = firstPhrase(structured.solution) || 'get it done';
  return [
    { angle: 'Problem-focused', headline: `${prob}? You’re not the only one.`, body: `See how ${structured.audience.toLowerCase()} are solving it today.` },
    { angle: 'Benefit-focused', headline: `Get the result without the hassle.`, body: `${capitalize(sol)} — in minutes, not weeks.` },
    { angle: 'Speed-focused', headline: `From problem to solved in 10 minutes.`, body: `No setup. No calls. Just ${sol}.` },
    { angle: 'Trust-focused', headline: `The option ${structured.audience.toLowerCase()} actually trust.`, body: 'Verified, transparent, no surprises.' },
    { angle: 'Price-focused', headline: `All of this for ${structured.price}.`, body: 'One plan. No hidden fees. Cancel anytime.' },
  ];
}

// ---------- virtual customers ----------
const ARCHETYPES = [
  { name: 'The Time-Poor Core User', pain: 0.85, priceSens: 0.3, urgency: 0.8, skepticism: 0.35, inc: 0.4 },
  { name: 'The Skeptical Comparer', pain: 0.55, priceSens: 0.5, urgency: 0.3, skepticism: 0.85, inc: 0.5 },
  { name: 'The Happy Competitor User', pain: 0.4, priceSens: 0.45, urgency: 0.4, skepticism: 0.6, inc: 0.6 },
  { name: 'The Early Adopter', pain: 0.7, priceSens: 0.25, urgency: 0.7, skepticism: 0.2, inc: 0.75 },
  { name: 'The Price-Sensitive Shopper', pain: 0.6, priceSens: 0.9, urgency: 0.5, skepticism: 0.55, inc: 0.25 },
  { name: 'The Burned Before', pain: 0.75, priceSens: 0.5, urgency: 0.6, skepticism: 0.9, inc: 0.35 },
  { name: 'The Occasional Need', pain: 0.35, priceSens: 0.7, urgency: 0.25, skepticism: 0.5, inc: 0.3 },
  { name: 'The Advocate-in-Waiting', pain: 0.9, priceSens: 0.4, urgency: 0.85, skepticism: 0.3, inc: 0.7 },
];
const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Avery', 'Blake'];

export function generatePersonas(inputs, structured, seed, count = 8) {
  const rng = mulberry32(seed ^ 0x1234);
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const price = Number(inputs.price) || 9;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = ARCHETYPES[i % ARCHETYPES.length];
    const jitter = (v) => clamp(v + (rng() - 0.5) * 0.16, 0.05, 0.98);
    const pain = jitter(a.pain), ps = jitter(a.priceSens), urg = jitter(a.urgency), sk = jitter(a.skepticism);
    const adoption = clamp(0.15 + pain * 0.4 - ps * 0.25 - sk * 0.25 + (0.9 - a.priceSens) * 0.08, 0.03, 0.92);
    const useCase = pick(rng, ['regular weekly need', 'occasional urgent need', 'planning a bigger event', 'trying to replace a workaround']);
    const current = pick(rng, cat.competitors.map((c) => c.name));
    const age = 22 + Math.floor(rng() * 34);
    const reaction = reactionFor(adoption, ps, price, sk, rng);
    out.push({
      label: `${String.fromCharCode(65 + (i % 26))}${i + 1}`,
      name: `${pick(rng, FIRST)} (${a.name})`,
      age,
      location: pick(rng, ['US metro area', 'EU metro area', 'Large city', 'Suburb']),
      income: a.inc > 0.6 ? '$80k+' : a.inc > 0.35 ? '$40–80k' : '<$40k',
      useCase,
      currentSolution: current,
      painIntensity: Math.round(pain * 100),
      priceSensitivity: Math.round(ps * 100),
      urgency: Math.round(urg * 100),
      skepticism: Math.round(sk * 100),
      adoptionProbability: Math.round(adoption * 100),
      reaction,
      confidence: sk > 0.7 || ps > 0.8 ? 'LOW' : adoption > 0.6 ? 'MEDIUM' : 'LOW',
    });
  }
  return out;
}
function reactionFor(adoption, ps, price, sk, rng) {
  if (adoption > 0.65) return pick(rng, [
    `“Finally — I’d pay ${fmtMoney(price)} for this today.”`,
    `“This is exactly what I was looking for. Where do I sign up?”`,
  ]);
  if (ps > 0.75) return `“Interesting, but I wouldn’t pay ${fmtMoney(price)} for it.”`;
  if (sk > 0.75) return pick(rng, [
    `“Sounds like every other app. Prove it works first.”`,
    `“I’ve been burned before — I’d need to see real reviews.”`,
  ]);
  if (adoption > 0.4) return pick(rng, [
    `“Would try it if the first month is free or cheap.”`,
    `“Looks useful, but I already use something similar.”`,
  ]);
  return pick(rng, [
    `“Not really my problem, honestly.”`,
    `“I handle this manually. It’s fine, most of the time.”`,
  ]);
}

// ---------- funnel ----------
export function runFunnel(inputs, structured, seed, mode = 'quick', angleFit = 1.0, priceAcceptance = 0.3, wtpScore = 55) {
  const rng = mulberry32(seed ^ 0x51ce);
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const budget = Number(inputs.budget) || 50;
  const channel = CHANNELS.meta; // default projection channel
  const impressions = Math.round((budget / channel.cpm) * 1000 * (0.85 + rng() * 0.3));
  const ctr = clamp((cat.ctrBase / 100) * angleFit * (0.85 + rng() * 0.3), 0.004, 0.09);
  const visits = Math.round(impressions * ctr);
  const signupRate = clamp((cat.signupBase / 100) * (0.8 + rng() * 0.4), 0.015, 0.22);
  const signups = Math.round(visits * signupRate);
  const pricingIntent = clamp(0.25 + (wtpScore / 100) * 0.35 + (rng() - 0.5) * 0.1, 0.1, 0.7);
  const pricingViews = Math.round(signups * pricingIntent);
  const purchaseIntent = clamp(priceAcceptance * (0.7 + rng() * 0.6), 0.02, 0.9);
  const purchaseRate = pricingIntent * purchaseIntent * 0.35;
  const purchasesMid = Math.max(1, Math.round(signups * purchaseRate));
  const spread = mode === 'advanced' ? 0.12 : mode === 'standard' ? 0.18 : 0.3;
  const purchasesLow = Math.max(0, Math.round(purchasesMid * (1 - spread)));
  const purchasesHigh = Math.round(purchasesMid * (1 + spread));
  const price = Number(inputs.price) || 9;
  const isSub = structured.businessModel === 'subscription' || structured.businessModel === 'freemium';
  const estRevenueMid = purchasesMid * price * (isSub ? 2.4 : 1.15); // ~2.4 months avg life for subs (estimate assumption)
  return {
    disclaimer: 'Simulation estimate — not a guarantee of real-world performance.',
    profileCount: mode === 'advanced' ? 1000 : mode === 'standard' ? 500 : 100,
    impressions, ctr: +(ctr * 100).toFixed(2), visits,
    signupRate: +(signupRate * 100).toFixed(1), signups,
    pricingIntent: +(pricingIntent * 100).toFixed(0), pricingViews,
    purchaseRate: +(purchaseRate * 100).toFixed(2),
    purchases: [purchasesLow, purchasesMid, purchasesHigh],
    estimatedRevenue: [Math.round(estRevenueMid * 0.8), Math.round(estRevenueMid), Math.round(estRevenueMid * 1.25)],
    cac: purchasesMid > 0 ? Math.round(budget / purchasesMid) : null,
    assumptions: [
      `Ad spend ${fmtMoney(budget)} on ${channel.label} at ~$${channel.cpm} CPM (sample estimate).`,
      `CTR base for category ${cat.label}: ~${cat.ctrBase}%.`,
      isSub ? 'Assumes average subscriber lifetime ≈ 2.4 months (estimate assumption).' : 'Assumes single purchase per customer.',
    ],
  };
}

// ---------- A/B ----------
export function runAB(structured, seed) {
  const rng = mulberry32(seed ^ 0xabcd);
  const landing = generateLanding(structured, seed);
  const variants = [
    { label: 'A', angle: 'Problem-focused', headline: landing.headline },
    { label: 'B', angle: 'Benefit-focused', headline: `Get ${firstPhrase(structured.solution) || 'the result'} without the usual hassle.` },
    { label: 'C', angle: 'Trust-focused', headline: `The option ${structured.audience.toLowerCase()} actually trust.` },
    { label: 'D', angle: 'Speed-focused', headline: `From problem to solved in 10 minutes.` },
    { label: 'E', angle: 'Price-focused', headline: `Everything you need, for ${structured.price}.` },
  ];
  const angleWeights = { A: 1.0, B: 0.92, C: 0.96, D: 0.88, E: 0.85 };
  const cat = detectCategory(`${structured.solution} ${structured.problem} ${structured.audience}`);
  const rows = variants.map((v) => {
    const w = angleWeights[v.label];
    const ctr = clamp((cat.ctrBase / 100) * w * (0.9 + rng() * 0.25), 0.004, 0.09);
    const intent = clamp(0.2 + w * 0.25 + (rng() - 0.5) * 0.12, 0.08, 0.6);
    const pa = clamp(0.18 + w * 0.2 + (rng() - 0.5) * 0.12, 0.05, 0.55);
    const overall = Math.round((ctr / 0.035) * 40 + intent * 35 + pa * 25);
    return { ...v, ctr: +(ctr * 100).toFixed(2), intent: +(intent * 100).toFixed(0), priceAcceptance: +(pa * 100).toFixed(0), overall: clamp(overall, 1, 99) };
  });
  rows.sort((a, b) => b.overall - a.overall);
  return { rows, best: rows[0], disclaimer: 'Simulation estimate — not a guarantee of real-world performance.' };
}

// ---------- price simulation ----------
export function runPriceSim(inputs, structured, seed, wtpScore = 55) {
  const rng = mulberry32(seed ^ 0xabc1);
  const base = Number(inputs.price) || 9;
  const isSub = structured.businessModel === 'subscription' || structured.businessModel === 'freemium';
  const toNice = (n) => (n < 3 ? Math.round(n * 100) / 100 : Math.floor(n) + 0.99);
  const ladder = [toNice(base * 0.5), toNice(base * 0.85), toNice(base * 1.1), toNice(base * 1.6), toNice(base * 2.2)];
  const fairPrice = clamp(base * (0.4 + wtpScore / 100 * 0.9), 1, 200);
  const convMax = clamp(0.3 + wtpScore / 250, 0.12, 0.55);
  const rows = ladder.map((p) => {
    const rel = Math.max(0, p - fairPrice) / fairPrice;
    const conv = clamp(convMax * Math.exp(-2.1 * rel), 0.02, 0.9);
    const rev = p * conv * (isSub ? 2.4 : 1.15);
    const resistance = clamp(1 - conv / convMax, 0, 1);
    return { price: +p.toFixed(2), conversion: +(conv * 100).toFixed(1), revenuePerCustomer: +rev.toFixed(2), estimatedRevenueIndex: +rev.toFixed(2), resistance: +(resistance * 100).toFixed(0) };
  });
  const eligible = rows.filter((r) => r.resistance <= 60);
  const best = (eligible.length ? eligible : rows).reduce((a, b) => (b.revenuePerCustomer > a.revenuePerCustomer ? b : a));
  return {
    rows,
    suggested: best,
    rationale: `Suggested price ${fmtMoney(best.price)} balances conversion × price × revenue. The highest-converting price is not automatically best — a cheaper point can win overall by leaving revenue on the table, and a pricier point can collapse conversion. Resistance ≤ 60% keeps adoption viable. (Simulation estimate.)`,
    disclaimer: 'Simulation estimate — not a guarantee of real-world performance.',
  };
}

// ---------- scoring ----------
export function scoreProject(inputs, structured, seed) {
  const rng = mulberry32(seed ^ 0x5c0e);
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const what = (inputs.what || '').toLowerCase();
  const prob = (inputs.problem || '').toLowerCase();
  const aud = (inputs.audience || '').toLowerCase();
  const price = Number(inputs.price) || 9;
  const j = (base, spread = 6) => clamp(Math.round(base + (rng() - 0.5) * spread), 1, 99);
  const specificAudience = aud.split(/\s+/).length >= 2 && !/everyone|all people/.test(aud);
  const freqWords = /daily|weekly|every day|every week|often|regularly|frequent|last.minute|travel|trip/.test(prob + ' ' + what);
  const urgencyWords = /quick|fast|last.minute|urgent|instant|asap|minutes/.test(prob + ' ' + what);
  const severityWords = /frustrat|pain|hate|expensive|risk|fail|waste|lose|stress|anxiet|trust|hard|difficult|impossible/.test(prob);
  const diffWords = /verif|trust|instant|instantly|ai|intelligen|personal|guarantee|only|unique|patent|exclusive|real-time/.test(what);
  const complexWords = /marketplace|two-sided|hardware|crypto|regulated|medical|legal/.test(what);
  const pricePos = clamp((price - cat.priceFloor) / (cat.priceCeiling - cat.priceFloor), 0, 1.3);

  const sub = {};
  sub['Market Demand'] = j(cat.demand * 85 + (specificAudience ? 14 : 0) + (freqWords ? 6 : 0));
  sub['Problem Severity'] = j(cat.severity * 70 + (severityWords ? 24 : 4) + (freqWords ? 4 : 0) + (urgencyWords ? 6 : 0));
  sub['Willingness to Pay'] = j(88 - pricePos * 52);
  sub['Competition'] = j(100 - cat.competition * 70);
  sub['Differentiation'] = j(42 + (diffWords ? 26 : 0) + (cat.key !== 'generic' ? 12 : 0));
  sub['Acquisition Potential'] = j(55 + Math.min(23, (Number(inputs.budget) || 50) / 10) + (specificAudience ? 8 : 0));
  sub['Retention Potential'] = j(cat.retention * 75 + (/subscription|freemium/.test(structured.businessModel) ? 14 : 0) + (freqWords ? 8 : 0));
  sub['Business Model'] = j(/subscription|freemium/.test(structured.businessModel) ? 65 : /marketplace|commission/.test(structured.businessModel) ? 50 : 60);
  sub['Execution Complexity'] = j(complexWords ? 44 : 70);

  const reasons = {
    'Market Demand': specificAudience ? `Audience is specific (${inputs.audience}); category demand in sample data: ${cat.label}.` : 'Audience is broad — demand signal is diluted across segments.',
    'Problem Severity': severityWords ? 'Problem description contains strong pain signals.' : 'Problem reads as a mild inconvenience rather than urgent pain.',
    'Willingness to Pay': `Price ${fmtMoney(price)} vs sample category range ${fmtMoney(cat.priceFloor)}–${fmtMoney(cat.priceCeiling)}.`,
    'Competition': `Sample competitors found: ${cat.competitors.length}. ${competitionRisk(cat, structured)}`,
    'Differentiation': diffWords ? 'Description mentions concrete differentiators (trust/verification/speed).' : 'No clear, provable differentiator stated yet.',
    'Acquisition Potential': cat.cacNote + `; planned test budget ${fmtMoney(Number(inputs.budget) || 50)}.`,
    'Retention Potential': /subscription|freemium/.test(structured.businessModel) ? 'Subscription model supports recurring value if habit forms.' : 'One-off purchases make retention economics harder.',
    'Business Model': 'Model-to-price-to-audience fit assessed against category norms (sample).',
    'Execution Complexity': complexWords ? 'Two-sided or complex scope detected — expect longer build time.' : 'Scope appears buildable by a solo founder.',
  };

  const weights = { 'Market Demand': 1.4, 'Problem Severity': 1.2, 'Willingness to Pay': 1.3, Competition: 1.0, Differentiation: 1.2, 'Acquisition Potential': 1.1, 'Retention Potential': 1.0, 'Business Model': 0.9, 'Execution Complexity': 0.8 };
  let sum = 0, wsum = 0;
  for (const [k, v] of Object.entries(sub)) { sum += v * weights[k]; wsum += weights[k]; }
  const score = clamp(Math.round(sum / wsum), 1, 99);
  const statusLabel = score <= 30 ? 'KILL' : score <= 50 ? 'PIVOT' : score <= 70 ? 'ITERATE' : score <= 85 ? 'TEST' : 'LAUNCH';
  const headline = score >= 71
    ? 'Promising enough to test with real money — after fixing the weakest link.'
    : score >= 51 ? 'There is a signal, but the weakest sub-scores need work before spending on ads.'
    : score >= 31 ? 'Core assumptions look weak — change the idea, not the landing page.'
    : 'Simulation suggests stopping or significantly reshaping this idea.';
  return { score, statusLabel, sub, reasons, headline, disclaimer: 'Score is a simulation estimate based on sample data and model assumptions — not a prediction.' };
}

// ---------- risks & opportunities ----------
export function findRisks(inputs, structured, scores, seed) {
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const entries = Object.entries(scores.sub).sort((a, b) => a[1] - b[1]);
  const riskMap = {
    'Willingness to Pay': { risk: 'Price may exceed perceived value', evidence: `Willingness to Pay sub-score ${entries.find(([k]) => k === 'Willingness to Pay')[1]}/100; planned price ${structured.price}.`, impact: 'High — kills unit economics even if demand exists.', recommendation: 'Test lower entry price or annual plan; lead pricing page with ROI.' },
    'Competition': { risk: 'Strong incumbents dominate attention', evidence: `Competition sub-score ${entries.find(([k]) => k === 'Competition')[1]}/100; ${cat.competitors.length} sample competitors identified.`, impact: 'High — raises CAC and depresses conversion.', recommendation: 'Attack a narrow segment the incumbents underserve; make differentiation provable.' },
    'Retention Potential': { risk: 'Purchase frequency may be too low', evidence: `Retention sub-score ${entries.find(([k]) => k === 'Retention Potential')[1]}/100; category usage: ${cat.freq}.`, impact: 'Medium-high — CAC never pays back if users churn in month 1.', recommendation: 'Design a weekly trigger into the product; measure D30 retention before scaling ads.' },
    'Differentiation': { risk: 'Weak differentiation', evidence: `Differentiation sub-score ${entries.find(([k]) => k === 'Differentiation')[1]}/100.`, impact: 'High — without a wedge this is a feature of someone else’s product.', recommendation: 'Pick one provable advantage and build the whole message around it.' },
    'Acquisition Potential': { risk: 'Acquisition cost may be too high', evidence: `Acquisition sub-score ${entries.find(([k]) => k === 'Acquisition Potential')[1]}/100; ${cat.cacNote}.`, impact: 'High — economics break before scale.', recommendation: 'Test the cheapest channel first with a small budget; track CAC daily.' },
    'Market Demand': { risk: 'Demand is unproven', evidence: `Market Demand sub-score ${entries.find(([k]) => k === 'Market Demand')[1]}/100.`, impact: 'Critical — no demand means no business.', recommendation: 'Run the real test before building anything beyond a landing page.' },
    'Business Model': { risk: 'Model-to-price fit is shaky', evidence: `Business Model sub-score ${entries.find(([k]) => k === 'Business Model')[1]}/100; model: ${structured.businessModel} at ${structured.price}.`, impact: 'Medium-high — even good demand can fail to monetize.', recommendation: 'Test the price ladder and consider the suggested tier; validate willingness to pay directly.' },
  };
  return entries.filter(([k]) => riskMap[k]).slice(0, 3).map(([k, v]) => ({ key: k, subScore: v, ...riskMap[k] }));
}

export function findOpportunities(inputs, structured, seed) {
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const segments = {
    pet: 'Target frequent travelers rather than all dog owners — their need is urgent, recurring and price-insensitive.',
    productivity: 'Target one workflow community (e.g., agency owners) rather than “everyone with tasks”.',
    health: 'Target people with a concrete event deadline (race, wedding) — urgency converts.',
    education: 'Target exam-season users with a deadline guarantee.',
    ai: 'Own one verifiable outcome (“output passes the review”) instead of “AI magic”.',
    commerce: 'Pick one niche with quality guarantees big marketplaces can’t offer.',
    generic: 'Narrow the audience to the most painful segment and expand later.',
  };
  const rec = segments[cat.key] || segments.generic;
  const SEGMENTS = {
    pet: 'Frequent travelers with dogs',
    productivity: 'One workflow community (e.g. agency owners)',
    health: 'People with a concrete deadline (race, wedding)',
    education: 'Exam-season students with a deadline',
    ai: 'Professionals who need a verifiable outcome',
    commerce: 'One niche that values quality guarantees',
    generic: 'The narrowest segment with the most urgent need',
  };
  return {
    biggest: rec,
    current: `${structured.audience} — ${structured.problem}`,
    recommended: rec,
    segment: SEGMENTS[cat.key] || SEGMENTS.generic,
    positioning: cat.whiteSpace,
  };
}

// ---------- improvements ----------
export function proposeImprovements(inputs, structured, scores, seed) {
  const cat = detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const weak = Object.entries(scores.sub).sort((a, b) => a[1] - b[1]).slice(0, 3);
  const opp = findOpportunities(inputs, structured, seed);
  const changes = [];
  const has = (k) => weak.some(([key]) => key === k);
  if (has('Differentiation')) changes.push({
    area: 'Positioning',
    from: structured.solution.slice(0, 120),
    to: `Reposition around trust: “${cat.whiteSpace.replace(/^Most competitors compete on .*?\. /i, '')}”`,
    why: 'Differentiation is the weakest link; a provable wedge beats feature lists.',
    expectedGain: 6,
    patch: { what: `${(inputs.what || '').trim().replace(/\.$/, '')}. Repositioned around verified trust as the core promise.` },
  });
  if (has('Market Demand')) changes.push({
    area: 'Audience',
    from: structured.audience,
    to: opp.segment,
    why: 'Narrow audience sharpens the message and lowers CAC.',
    expectedGain: 5,
    patch: { audience: opp.segment },
  });
  if (has('Willingness to Pay')) changes.push({
    area: 'Pricing',
    from: structured.price,
    to: `Lower entry tier around ${fmtMoney(Math.max(1, Math.round((Number(inputs.price) || 9) * 0.8) - 0.01))} + annual discount`,
    why: 'Reduces the initial price hurdle while keeping expansion room.',
    expectedGain: 5,
    patch: { price: Math.max(1, Math.round((Number(inputs.price) || 9) * 0.8)) },
  });
  if (has('Retention Potential')) changes.push({
    area: 'Offer',
    from: 'Single purchase moment',
    to: 'Weekly value trigger (digest, reminder, streak) to build habit',
    why: 'Retention drives payback of CAC.',
    expectedGain: 4,
    patch: { what: `${(inputs.what || '').trim().replace(/\.$/, '')}. Includes a weekly value trigger (digest, reminder, streak) to build a habit.` },
  });
  if (has('Acquisition Potential')) changes.push({
    area: 'Acquisition',
    from: structured.acquisition,
    to: 'Start with the single cheapest channel; test referral loop from day 1',
    why: 'Lowers blended CAC before scaling.',
    expectedGain: 4,
    patch: { validate: Array.from(new Set([...(inputs.validate || []), 'acquisition'])) },
  });
  if (has('Competition')) changes.push({
    area: 'Audience',
    from: structured.audience,
    to: `Focus on the most underserved segment of ${structured.audience.toLowerCase()} that incumbents ignore`,
    why: 'Competing head-on with incumbents is expensive; a narrow wedge is winnable.',
    expectedGain: 5,
    patch: { audience: opp.segment },
  });
  if (!changes.length) changes.push({
    area: 'Offer',
    from: 'Current offer',
    to: 'Add a stronger guarantee (e.g., 30-day money back) to reduce perceived risk',
    why: 'At this score the biggest lever is reducing perceived risk.',
    expectedGain: 4,
  });
  const potential = clamp(scores.score + Math.round(changes.reduce((s, c) => s + c.expectedGain, 0) * 0.7), scores.score + 1, 99);
  return {
    changes: changes.slice(0, 4),
    currentScore: scores.score,
    potentialScore: Math.round(potential),
    disclaimer: 'Potential score is a simulation estimate of what these changes could unlock — not a guarantee.',
  };
}

// ---------- unit economics ----------
// CAC / LTV / churn / margin / payback — derived from the simulation estimates.
// All outputs are estimates; assumptions are listed and a what-if recalculator
// lets the founder test better/worse margin and churn.
export function unitEconomics(inputs, structured, funnel, scores, seed, overrides = {}) {
  const rng = mulberry32(seed ^ 0x999);
  const price = Number(inputs.price) || 9;
  const isSub = structured.businessModel === 'subscription' || structured.businessModel === 'freemium';
  const ret = scores.sub['Retention Potential'] ?? 50;
  const bm = scores.sub['Business Model'] ?? 55;

  const churnMonthly = clamp(overrides.churn ?? (0.62 - (ret / 100) * 0.42 + (rng() - 0.5) * 0.05), 0.04, 0.5);
  const grossMargin = clamp(overrides.margin ?? (0.52 + (bm / 100) * 0.4 + (rng() - 0.5) * 0.06), 0.35, 0.95);
  const arpu = price;
  const lifetimeMonths = isSub ? +(1 / churnMonthly).toFixed(1) : 1;
  const ltv = +(arpu * grossMargin * lifetimeMonths).toFixed(2);
  const cac = (funnel && funnel.cac != null && funnel.cac > 0) ? funnel.cac : Math.max(10, Math.round((Number(inputs.budget) || 50) / Math.max(1, funnel?.purchases?.[1] ?? 1)));
  const paybackMonths = isSub ? +((cac / (arpu * grossMargin)) || 0).toFixed(1) : null;
  const ltvCac = +(ltv / cac).toFixed(2);
  const marginPerMonth = +(arpu * grossMargin).toFixed(2);
  const contribution12 = +(isSub ? arpu * grossMargin * Math.min(12, lifetimeMonths) - cac : arpu * grossMargin - cac).toFixed(2);
  const breakevenCustomers = Math.ceil((Number(inputs.budget) || 50) / Math.max(1, ltv)); // customers needed to recover test budget
  const verdict = ltvCac >= 3 && cac <= arpu * 8 ? 'HEALTHY' : ltvCac >= 1.5 ? 'BORDERLINE' : 'DANGEROUS';
  const verdictWhy = {
    HEALTHY: 'LTV covers CAC at least 3× — the model can survive imperfect execution.',
    BORDERLINE: 'LTV covers CAC only 1.5–3× — economics work only if churn stays low and CAC does not creep.',
    DANGEROUS: 'LTV barely covers or loses to CAC — do not scale spend; fix price, margin or churn first.',
  }[verdict];
  return {
    arpu: +arpu.toFixed(2), isSub,
    grossMargin: +grossMargin.toFixed(2), churnMonthly: +churnMonthly.toFixed(3),
    lifetimeMonths, ltv, cac, ltvCac, paybackMonths, marginPerMonth, contribution12, breakevenCustomers,
    verdict, verdictWhy,
    assumptions: [
      `ARPU = planned price ${fmtMoney(price)}${isSub ? '/month' : ' one-time'}.`,
      isSub ? `Lifetime ≈ 1 / churn = ${lifetimeMonths} months at ${Math.round(churnMonthly * 100)}% monthly churn (estimate from retention signals).` : 'One-time purchase model: lifetime = 1 purchase.',
      `Gross margin ${Math.round(grossMargin * 100)}% — payment fees, hosting and support costs subtracted (estimate).`,
      `CAC ${fmtMoney(cac)} — from the simulated funnel at the planned test budget.`,
    ],
    disclaimer: 'Unit economics are simulation estimates, not measurements. A what-if recalculator lets you test better or worse assumptions.',
  };
}

// ---------- unit econ overrides (what-if) ----------
export function recomputeUnitEconomics(base, overrides) {
  const isSub = base.isSub;
  const arpu = base.arpu;
  const churnMonthly = clamp(overrides.churn ?? base.churnMonthly, 0.04, 0.5);
  const grossMargin = clamp(overrides.margin ?? base.grossMargin, 0.35, 0.95);
  const lifetimeMonths = isSub ? +(1 / churnMonthly).toFixed(1) : 1;
  const ltv = +(arpu * grossMargin * lifetimeMonths).toFixed(2);
  const cac = base.cac;
  const ltvCac = +(ltv / Math.max(0.01, cac)).toFixed(2);
  const paybackMonths = isSub ? +((cac / (arpu * grossMargin)) || 0).toFixed(1) : null;
  const verdict = ltvCac >= 3 && cac <= arpu * 8 ? 'HEALTHY' : ltvCac >= 1.5 ? 'BORDERLINE' : 'DANGEROUS';
  return { ...base, grossMargin: +grossMargin.toFixed(2), churnMonthly: +churnMonthly.toFixed(3), lifetimeMonths, ltv, ltvCac, paybackMonths, marginPerMonth: +(arpu * grossMargin).toFixed(2), contribution12: +(isSub ? arpu * grossMargin * Math.min(12, lifetimeMonths) - cac : arpu * grossMargin - cac).toFixed(2), verdict, whatIf: true };
}

// ---------- competitor reaction ----------
// Simulates how existing competitors would plausibly react to your growth.
export function competitorReaction(structured, competitors, scores, seed) {
  const rng = mulberry32(seed ^ 0xcc01);
  const SCENARIOS = [
    { reaction: 'Price cut or promo blitz', weight: 0.28, timing: 'weeks 2–6 of your growth', impact: 'CAC inflation +15–40% while it lasts; your price advantage evaporates', counter: 'Compete on proof, not price; lock early users into annual plans' },
    { reaction: 'Copy your wedge feature', weight: 0.3, timing: '1–3 months (they ship slowly)', impact: 'Your differentiation window narrows; expect feature-checklist marketing', counter: 'Brand the proof mechanic; keep shipping — the wedge is a direction, not a checkbox' },
    { reaction: 'Marketing / brand push', weight: 0.18, timing: 'weeks 1–8, ad-driven', impact: 'CPMs in your niche rise; your audience gets noisier', counter: 'Shift budget to the cheapest channel; lean on organic TikTok winners' },
    { reaction: 'Acqui-hire or clone attempt', weight: 0.1, timing: 'months 3–12, only if traction is public', impact: 'Talent war or a “same but bigger” clone with distribution', counter: 'Own the niche community; build switching costs (data, history, streaks)' },
    { reaction: 'Do nothing (slow mover)', weight: 0.14, timing: '—', impact: 'You keep the window; expect reaction only after you are visible', counter: 'Use the quiet window to lock retention: weekly value loop before they notice' },
  ];
  const ranked = competitors
    .filter((c) => c.kind === 'direct')
    .slice(0, 3);
  const pick = (weights) => {
    let r = rng(); const out = [];
    const pool = [...SCENARIOS];
    for (let i = 0; i < weights; i++) {
      let acc = 0;
      for (let j = 0; j < pool.length; j++) { acc += pool[j].weight; if (r <= acc) { out.push(pool.splice(j, 1)[0]); r = rng(); break; } }
    }
    return out;
  };
  const per = ranked.map((c) => {
    const scenarios = pick(c.kind === 'direct' && /rover|notion|duolingo|amazon|chatgpt|myfitnesspal|hellofresh|etsy/i.test(c.name) ? 2 : 2)
      .map((s) => ({ ...s, probability: Math.round(clamp(s.weight * 100 + (rng() - 0.5) * 10, 5, 60)) }));
    const threat = /rover|amazon|chatgpt|duolingo|notion/i.test(c.name) ? 'HIGH — they move when they notice you' : c.kind === 'direct' ? 'MEDIUM' : 'LOW';
    return { competitor: c.name, threat, scenarios };
  });
  const expectedCacUplift = Math.round(per.reduce((a, x) => a + x.scenarios.reduce((b, s) => b + (s.reaction.includes('Price cut') || s.reaction.includes('Marketing') ? s.probability * 0.4 : 0), 0), 0) / Math.max(1, per.length));
  return {
    per,
    expectedCacUplift: clamp(expectedCacUplift, 5, 45),
    summary: `If you grow, expect competitors to react within weeks: weighted CAC inflation estimate +${clamp(expectedCacUplift, 5, 45)}%. Plan your ad tests to survive that number, not today's CPMs.`,
    disclaimer: 'Scenario simulation based on competitor archetypes and sample data — probabilities are estimates, not predictions.',
  };
}

// ---------- post-test competitor insights ----------
export function postTestCompetitorInsights(competitors, snapshot, seed) {
  const rng = mulberry32(seed ^ 0xdd02);
  const winner = snapshot.ideas?.[0];
  const passed = snapshot.totals?.purchases >= 2;
  return competitors.map((c) => ({
    name: c.name,
    afterTest: passed
      ? `The run exploited their known weakness — “${(c.weakness || 'their status quo').replace(/\.$/, '')}”. Your winning angle (“${winner?.name ?? 'the trust wedge'}”) is exactly the pressure point they defend worst.`
      : `The run could not beat their pull: “${(c.strength || 'their status quo').replace(/\.$/, '')}” kept simulated users from switching. Attack this strength directly or pick a segment where it matters less.`,
    threat: passed ? (rng() < 0.6 ? 'lower' : 'same') : (rng() < 0.6 ? 'higher' : 'same'),
  }));
}

// ---------- decision engine ----------
export function decide({ scores, realTest, iterations }) {
  const reasons = [];
  let rec;
  const s = scores.score;
  if (realTest && realTest.metrics) {
    const m = realTest.metrics;
    const accuracy = realTest.accuracy || {};
    const goodAccuracy = (accuracy.overall ?? 0) >= 60;
    if (m.purchases >= 2 && goodAccuracy) {
      rec = 'BUILD MVP';
      reasons.push('Real test produced purchases and funnel metrics close to the simulation — demand signal confirmed.');
      reasons.push(`Simulation tracked reality reasonably well (accuracy ${accuracy.overall ?? '—'}%).`);
      reasons.push('Next: build the smallest real version and keep the test campaign running to nail unit economics.');
    } else if (m.purchases >= 1) {
      rec = 'TEST MORE';
      reasons.push('Real test converted at least once, but the sample is too small (or accuracy too low) to call it.');
      reasons.push('Extend the test with the winning ad variant and re-check before building.');
    } else {
      rec = 'PIVOT';
      reasons.push('Real test produced no purchases — positioning or offer needs a fundamental change.');
      reasons.push('Change audience or offer, then run a new simulation before spending again.');
    }
    reasons.push(`Simulation vs reality: CTR ${accuracy.ctr ?? '—'}% accuracy, conversion ${accuracy.conversion ?? '—'}% accuracy.`);
    return { recommendation: rec, reasons };
  }
  if (s <= 30) { rec = 'KILL'; reasons.push('Overall score is in the bottom band: core assumptions look unsound.'); reasons.push('Save your weeks and budget — reshape the idea or move on.'); }
  else if (s <= 50) { rec = 'PIVOT'; reasons.push('Score 31–50: the idea has life only with a fundamental change (audience, model or offer).'); reasons.push('Use “Improve idea” and re-simulate before any real spend.'); }
  else if (s <= 70) { rec = 'ITERATE'; reasons.push('Score 51–70: promising signal, but weakest sub-scores block real testing.'); reasons.push('Apply improvements and simulate again — usually 1–2 iterations away from testable.'); }
  else if (s <= 85) { rec = 'TEST MORE'; reasons.push('Score 71–85: worth validating with a small real-budget test.'); reasons.push('Run the real test to confirm CTR, signup rate and price acceptance.'); }
  else { rec = 'LAUNCH'; reasons.push('Score 86+: strong simulated launch signal across sub-scores.'); reasons.push('Proceed to a real test and start building the smallest MVP.'); }
  const weak = Object.entries(scores.sub).sort((a, b) => a[1] - b[1])[0];
  reasons.push(`Watch the weakest factor: ${weak[0]} (${weak[1]}/100) — ${scores.reasons[weak[0]]}`);
  return { recommendation: rec, reasons };
}
