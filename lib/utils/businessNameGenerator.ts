// Business name generators for different industries

const travelBusinessNames = {
  prefixes: [
    'Elite', 'Premium', 'Global', 'Express', 'Swift', 'Premier', 'Ultimate', 'Advanced',
    'Pro', 'Smart', 'Quick', 'First Class', 'VIP', 'Instant', 'Direct', 'Fast Track',
    'Sky', 'Horizon', 'Voyage', 'Journey', 'Wanderlust', 'Explorer', 'Adventure',
    'Escape', 'Getaway', 'Paradise', 'Dream', 'Luxury', 'Royal', 'Imperial'
  ],
  middles: [
    'Travel', 'Tours', 'Flights', 'Vacations', 'Booking', 'Trips', 'Airways',
    'Destinations', 'Expeditions', 'Journeys', 'Adventures', 'Escapes', 'Getaways'
  ],
  suffixes: [
    'Agency', 'Services', 'Solutions', 'Group', 'Network', 'Associates', 'Partners',
    'Experts', 'Specialists', 'Consultants', 'Hub', 'Center', 'Express', 'Plus',
    'Pro', 'Direct', 'Online', 'Now', 'Fast', 'Easy'
  ]
};

const pestControlBusinessNames = {
  prefixes: [
    'Elite', 'Premium', 'Advanced', 'Professional', 'Expert', 'Master', 'Superior',
    'Prime', 'Top', 'Best', 'Quick', 'Fast', 'Rapid', 'Instant', 'Complete',
    'Total', 'Full', 'Safe', 'Eco', 'Green', 'Natural', 'Organic', 'Smart',
    'Pro', 'All', 'Local', 'Metro', 'City', 'Regional'
  ],
  middles: [
    'Pest', 'Bug', 'Termite', 'Rodent', 'Insect', 'Critter', 'Exterminator',
    'Fumigation', 'Control', 'Elimination', 'Removal', 'Protection'
  ],
  suffixes: [
    'Control', 'Solutions', 'Services', 'Experts', 'Specialists', 'Professionals',
    'Exterminators', 'Elimination', 'Removal', 'Protection', 'Defense', 'Guard',
    'Shield', 'Care', 'Management', 'Systems', 'Plus', 'Pro', 'Express', 'Direct'
  ]
};

export function generateBusinessName(industry: 'travel' | 'pest-control'): string {
  const names = industry === 'travel' ? travelBusinessNames : pestControlBusinessNames;
  
  // Choose random elements
  const prefix = names.prefixes[Math.floor(Math.random() * names.prefixes.length)];
  const middle = names.middles[Math.floor(Math.random() * names.middles.length)];
  const suffix = names.suffixes[Math.floor(Math.random() * names.suffixes.length)];
  
  // Generate different name patterns
  const patterns = [
    `${prefix} ${middle} ${suffix}`,
    `${prefix} ${middle}`,
    `${middle} ${suffix}`,
    `${prefix} ${suffix}`
  ];
  
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  
  return pattern;
}

// Generate multiple unique business names
export function generateMultipleBusinessNames(industry: 'travel' | 'pest-control', count: number): string[] {
  const names = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 10; // Prevent infinite loops
  
  while (names.size < count && attempts < maxAttempts) {
    names.add(generateBusinessName(industry));
    attempts++;
  }
  
  return Array.from(names);
} 