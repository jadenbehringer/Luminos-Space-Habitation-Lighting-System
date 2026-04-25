/**
 * dummy.js
 * --------
 * Static seed data for the AstroView dashboard.
 *
 * Three exported constants are used throughout the app:
 *   CREW     – astronaut roster with per-member lighting targets
 *   PROFILES – predefined lighting profiles mapped to mission activities
 *   SERVOS   – physical window servo descriptors
 *   FILTERS  – blue-light filter bank state
 *
 * When no live serial / bridge data is available the UI falls back to
 * these values so the dashboard remains fully interactive in simulation mode.
 */

// ---------------------------------------------------------------------------
// CREW
// ---------------------------------------------------------------------------
// Each crew member defines:
//   id            – short unique key used for React keying and selection state
//   name          – last-name-first callsign (all-caps, military style)
//   designation   – ISS role code (CDR, FE-n, MS)
//   activity      – current scheduled activity label
//   activityClass – CSS-friendly key used to map activity → colour palette
//   targetLux     – desired ambient illuminance (lux) for this crew member's task
//   overrides     – number of manual light-level overrides logged this session
//   active        – legacy flag (currently unused; selection driven by UI state)
//   color         – accent colour for inline styles
//   colorBg       – translucent version of accent colour for card backgrounds
export const CREW = [
  {
    id: 'ck',
    name: 'CHEN, K.',
    designation: 'CDR',
    activity: 'RESEARCH',
    activityClass: 'work',
    targetLux: 1550,   // high illuminance for detailed lab work
    overrides: 3,
    active: true,
    color: '#00c8ff',
    colorBg: 'rgba(0,200,255,0.12)',
  },
  {
    id: 'np',
    name: 'PATEL, N.',
    designation: 'FE-1',
    activity: 'SLEEP',
    activityClass: 'sleep',
    targetLux: 0,      // blackout target during sleep phase
    overrides: 1,
    active: false,
    color: '#a080ff',
    colorBg: 'rgba(100,50,200,0.15)',
  },
  {
    id: 'rv',
    name: 'VASQUEZ, R.',
    designation: 'MS',
    activity: 'EVA PREP',
    activityClass: 'eva',
    targetLux: 1250,   // bright pre-EVA suit-up environment
    overrides: 0,
    active: false,
    color: '#ffc800',
    colorBg: 'rgba(255,200,0,0.1)',
  },
  {
    id: 'lm',
    name: 'MULLER, L.',
    designation: 'FE-2',
    activity: 'EXERCISE',
    activityClass: 'exercise',
    targetLux: 800,    // energising mid-level light for physical activity
    overrides: 2,
    active: false,
    color: '#00ff88',
    colorBg: 'rgba(0,255,136,0.1)',
  },
];

// ---------------------------------------------------------------------------
// PROFILES
// ---------------------------------------------------------------------------
// Predefined lighting scenes mapped to mission activities.
// Each profile defines:
//   id             – unique key; also used as the activeProfile string in useLiveData
//   icon           – emoji displayed on the profile card
//   name           – human-readable label (all-caps)
//   targetRange    – descriptive lux range string shown in the UI
//   targetLux      – numeric lux target sent to the Tapo bridge when selected
//   blueLightLevel – expected blue-light sensor reading (TCS34725 raw counts)
//                    for this scene; used as the generated fallback value
//   servoPositions – [s1, s2, s3, s4] servo angles (0–180°) for each window
//                    panel that achieve the target illuminance for this scene
export const PROFILES = [
  {
    id: 'sleep',
    icon: '☾',
    name: 'SLEEP',
    targetRange: '0 lux',
    targetLux: 0,
    blueLightLevel: 210,           // minimal blue light — supports melatonin production
    servoPositions: [10, 15, 10, 5],
  },
  {
    id: 'dawn',
    icon: '☀',
    name: 'DAWN',
    targetRange: '40–100 lux',
    targetLux: 70,
    blueLightLevel: 840,           // gentle morning ramp-up
    servoPositions: [30, 35, 30, 28],
  },
  {
    id: 'dusk',
    icon: '◒',
    name: 'DUSK',
    targetRange: '80–140 lux',
    targetLux: 110,
    blueLightLevel: 620,           // warm wind-down before sleep
    servoPositions: [55, 50, 52, 48],
  },
  {
    id: 'leisure',
    icon: '📖',
    name: 'LEISURE',
    targetRange: '250–350 lux',
    targetLux: 300,
    blueLightLevel: 1050,
    servoPositions: [85, 90, 88, 82],
  },
  {
    id: 'hygeine',
    icon: '🫧',
    name: 'HYGEINE',
    targetRange: '400–500 lux',
    targetLux: 450,
    blueLightLevel: 1280,
    servoPositions: [98, 108, 102, 96],
  },
  {
    id: 'meal',
    icon: '🍽️',
    name: 'MEAL',
    targetRange: '550–650 lux',
    targetLux: 600,
    blueLightLevel: 1420,
    servoPositions: [95, 105, 100, 92],
  },
  {
    id: 'exercise',
    icon: '🏃',
    name: 'EXERCISE',
    targetRange: '750–850 lux',
    targetLux: 800,
    blueLightLevel: 2450,          // elevated blue light supports alertness during exercise
    servoPositions: [120, 130, 128, 115],
  },
  {
    id: 'maitenance',
    icon: '🔧',
    name: 'MAITENANCE',
    targetRange: '950–1050 lux',
    targetLux: 1000,
    blueLightLevel: 2820,
    servoPositions: [125, 120, 130, 118],
  },
  {
    id: 'eva-prep',
    icon: '🛰️',
    name: 'EVA PREP',
    targetRange: '1200–1300 lux',
    targetLux: 1250,
    blueLightLevel: 3150,
    servoPositions: [135, 145, 140, 132],
  },
  {
    id: 'research',
    icon: '🧪',
    name: 'RESEARCH',
    targetRange: '1500+ lux',
    targetLux: 1550,
    blueLightLevel: 3400,          // maximum illuminance for precision laboratory tasks
    servoPositions: [145, 150, 155, 142],
  },
];

// ---------------------------------------------------------------------------
// SERVOS
// ---------------------------------------------------------------------------
// Descriptors for the four window panel servo actuators.
//   id       – matches the s1–s4 keys used in servoPositions above
//   name     – human-readable panel name
//   location – physical location within the habitat module
//   live     – whether this servo is currently active / receiving commands
export const SERVOS = [
  { id: 's1', name: 'Window A', location: 'Main panel · Blue filter', live: true },
  { id: 's2', name: 'Window B', location: 'Starboard · Filter stack', live: false },
  { id: 's3', name: 'Window C', location: 'Port · No filter', live: false },
  { id: 's4', name: 'Window D', location: 'Cupola · Dual filter', live: false },
];

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------
// Static state for the four blue-light filter panels.
//   id      – unique key
//   label   – display label
//   engaged – whether the filter is currently inserted in the light path
export const FILTERS = [
  { id: 'a', label: 'Filter A', engaged: true },
  { id: 'b', label: 'Filter B', engaged: false },
  { id: 'c', label: 'Filter C', engaged: false },
  { id: 'd', label: 'Filter D', engaged: false },
];