/**
 * SKILLSHOT — CHOREOGRAPHY DIRECTOR
 *
 * State machine that orchestrates 3D character appearances with:
 * - Randomized intervals (20–45 s between events)
 * - Weighted character selection with cooldown tracking
 * - Cinematic entrance/exit animation curves
 * - Scroll-section awareness (hero / community / deep feed)
 * - 1–3 characters visible at any moment
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntranceStyle =
  | 'swing'        // Aero-Strider grapple swing (handled specially)
  | 'slideIn'      // Step from behind page edge
  | 'flyAcross'    // Glide across from off-screen
  | 'teleport'     // Glitch/flash appear
  | 'riseUp'       // Rise from below viewport
  | 'fallIn'       // Fall from above
  | 'dashIn';      // Speed dash with trail

export type ExitStyle =
  | 'swingAway'
  | 'slideOut'
  | 'flyUp'
  | 'fadeOut'
  | 'dropDown'
  | 'moveBehind'
  | 'dashOut';

export type ScrollStage = 'hero' | 'community' | 'deepFeed';

export interface CharacterSlot {
  /** Index into the character roster */
  characterIndex: number;
  /** Which side of the screen ('left' is reserved for the swinger) */
  side: 'left' | 'right';
  /** Current animation phase */
  phase: 'entering' | 'idle' | 'exiting' | 'gone';
  /** Progress 0→1 for entrance/exit animations */
  progress: number;
  /** Entrance style for this appearance */
  entrance: EntranceStyle;
  /** Exit style for this appearance */
  exit: ExitStyle;
  /** Timestamp (seconds) when this slot was activated */
  activatedAt: number;
  /** How long (seconds) the character stays idle before exiting */
  idleDuration: number;
}

export interface ChoreographyState {
  slots: CharacterSlot[];
  scrollStage: ScrollStage;
  lastEventTime: number;
  nextEventDelay: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default entrance/exit styles per character roster index (right pool 0–5). */
export const CHARACTER_CHOREOGRAPHY: {
  entrance: EntranceStyle;
  exit: ExitStyle;
}[] = [
  { entrance: 'slideIn',   exit: 'slideOut'   },  // 0: Kaze-Blade
  { entrance: 'flyAcross', exit: 'flyUp'      },  // 1: Nova Sentinel
  { entrance: 'teleport',  exit: 'fadeOut'     },  // 2: Neon Phantom
  { entrance: 'riseUp',    exit: 'dropDown'    },  // 3: Aether Mystic
  { entrance: 'fallIn',    exit: 'moveBehind'  },  // 4: Mecha Ace
  { entrance: 'dashIn',    exit: 'dashOut'     },  // 5: Volt Runner
];

const MIN_EVENT_INTERVAL = 20;   // seconds
const MAX_EVENT_INTERVAL = 45;
const MIN_IDLE_DURATION  = 12;   // how long a character stays visible
const MAX_IDLE_DURATION  = 28;
const COOLDOWN_SECONDS   = 40;   // minimum gap before a character re-enters
const ENTRANCE_DURATION  = 1.6;  // seconds for entrance animation
const EXIT_DURATION      = 1.4;  // seconds for exit animation

// Maximum simultaneous right-side characters per breakpoint tier
const MAX_VISIBLE_FULL     = 2;  // ≥1440 px
const MAX_VISIBLE_ENHANCED = 1;  // 1200–1439 px

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

/** Smooth cubic ease-out: fast start, gentle deceleration */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Smooth cubic ease-in: gentle acceleration, fast finish */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Elastic ease-out for dramatic entrances */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

/** Back ease-out: slight overshoot then settle */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------------------------------------------------------------------------
// Director class
// ---------------------------------------------------------------------------

export class ChoreographyDirector {
  private state: ChoreographyState;
  private cooldowns: Map<number, number> = new Map(); // characterIndex → exitTime
  private characterCount: number;
  private maxVisible: number;
  private onEnter: ((slot: CharacterSlot) => void) | null = null;
  private onExit: ((slot: CharacterSlot) => void) | null = null;

  constructor(characterCount: number, isFullExperience: boolean) {
    this.characterCount = characterCount;
    this.maxVisible = isFullExperience ? MAX_VISIBLE_FULL : MAX_VISIBLE_ENHANCED;
    this.state = {
      slots: [],
      scrollStage: 'hero',
      lastEventTime: 0,
      nextEventDelay: randomRange(3, 6), // First event comes quickly
    };
  }

  /** Register callbacks for character enter/exit events */
  onCharacterEnter(cb: (slot: CharacterSlot) => void) { this.onEnter = cb; }
  onCharacterExit(cb: (slot: CharacterSlot) => void) { this.onExit = cb; }

  /** Update the scroll stage based on scroll position */
  updateScrollStage(scrollY: number) {
    if (scrollY < 450) {
      this.state.scrollStage = 'hero';
    } else if (scrollY < 1200) {
      this.state.scrollStage = 'community';
    } else {
      this.state.scrollStage = 'deepFeed';
    }
  }

  /** Update the max visible count (called on resize) */
  updateBreakpoint(isFullExperience: boolean) {
    this.maxVisible = isFullExperience ? MAX_VISIBLE_FULL : MAX_VISIBLE_ENHANCED;
  }

  /** Main tick — called every frame with elapsed time in seconds */
  tick(time: number, delta: number): CharacterSlot[] {
    // 1. Update all active slot animations
    for (const slot of this.state.slots) {
      if (slot.phase === 'entering') {
        slot.progress += delta / ENTRANCE_DURATION;
        if (slot.progress >= 1) {
          slot.progress = 1;
          slot.phase = 'idle';
        }
      } else if (slot.phase === 'idle') {
        // Check if idle duration exceeded → trigger exit
        const idleTime = time - (slot.activatedAt + ENTRANCE_DURATION);
        if (idleTime >= slot.idleDuration) {
          slot.phase = 'exiting';
          slot.progress = 0;
        }
      } else if (slot.phase === 'exiting') {
        slot.progress += delta / EXIT_DURATION;
        if (slot.progress >= 1) {
          slot.progress = 1;
          slot.phase = 'gone';
          this.cooldowns.set(slot.characterIndex, time);
          this.onExit?.(slot);
        }
      }
    }

    // 2. Remove completed (gone) slots
    this.state.slots = this.state.slots.filter(s => s.phase !== 'gone');

    // 3. In deep feed, force-exit all characters
    if (this.state.scrollStage === 'deepFeed') {
      for (const slot of this.state.slots) {
        if (slot.phase === 'idle') {
          slot.phase = 'exiting';
          slot.progress = 0;
        }
      }
      return this.state.slots;
    }

    // 4. Check if it's time for a new event
    const activeCount = this.state.slots.filter(s => s.phase !== 'exiting').length;
    if (time - this.state.lastEventTime >= this.state.nextEventDelay && activeCount < this.maxVisible) {
      const candidate = this.pickCandidate(time);
      if (candidate !== null) {
        const choreo = CHARACTER_CHOREOGRAPHY[candidate] ?? CHARACTER_CHOREOGRAPHY[0];
        const newSlot: CharacterSlot = {
          characterIndex: candidate,
          side: 'right',
          phase: 'entering',
          progress: 0,
          entrance: choreo.entrance,
          exit: choreo.exit,
          activatedAt: time,
          idleDuration: randomRange(MIN_IDLE_DURATION, MAX_IDLE_DURATION),
        };
        this.state.slots.push(newSlot);
        this.state.lastEventTime = time;
        this.state.nextEventDelay = randomRange(MIN_EVENT_INTERVAL, MAX_EVENT_INTERVAL);
        this.onEnter?.(newSlot);
      }
    }

    return this.state.slots;
  }

  /** Pick a character index that isn't on cooldown and isn't currently visible */
  private pickCandidate(currentTime: number): number | null {
    const activeIndices = new Set(this.state.slots.map(s => s.characterIndex));
    const candidates: number[] = [];

    for (let i = 0; i < this.characterCount; i++) {
      if (activeIndices.has(i)) continue;
      const lastExit = this.cooldowns.get(i);
      if (lastExit !== undefined && currentTime - lastExit < COOLDOWN_SECONDS) continue;
      candidates.push(i);
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Force an immediate entrance of a specific character */
  forceEntrance(characterIndex: number, time: number): CharacterSlot | null {
    const alreadyActive = this.state.slots.some(s => s.characterIndex === characterIndex && s.phase !== 'gone');
    if (alreadyActive) return null;

    const choreo = CHARACTER_CHOREOGRAPHY[characterIndex] ?? CHARACTER_CHOREOGRAPHY[0];
    const newSlot: CharacterSlot = {
      characterIndex,
      side: 'right',
      phase: 'entering',
      progress: 0,
      entrance: choreo.entrance,
      exit: choreo.exit,
      activatedAt: time,
      idleDuration: randomRange(MIN_IDLE_DURATION, MAX_IDLE_DURATION),
    };
    this.state.slots.push(newSlot);
    this.state.lastEventTime = time;
    this.onEnter?.(newSlot);
    return newSlot;
  }

  /** Force all characters to begin exiting */
  forceExitAll() {
    for (const slot of this.state.slots) {
      if (slot.phase === 'idle' || slot.phase === 'entering') {
        slot.phase = 'exiting';
        slot.progress = 0;
      }
    }
  }

  /** Get the currently active character name/index for the UI badge */
  getActiveCharacterIndex(): number | null {
    const idle = this.state.slots.find(s => s.phase === 'idle');
    if (idle) return idle.characterIndex;
    const entering = this.state.slots.find(s => s.phase === 'entering');
    if (entering) return entering.characterIndex;
    return null;
  }

  get currentSlots(): readonly CharacterSlot[] {
    return this.state.slots;
  }
}

// ---------------------------------------------------------------------------
// Entrance / Exit position calculators
// Each returns [x, y, z] offset to apply during the animation.
// `progress` is 0→1, already eased by the caller.
// ---------------------------------------------------------------------------

/** Calculate character position during entrance animation */
export function getEntrancePosition(
  style: EntranceStyle,
  rawProgress: number,
  baseX: number,
  baseY: number = -0.6,
): [number, number, number] {
  const t = easeOutCubic(rawProgress);

  switch (style) {
    case 'slideIn': {
      // Slide in from far right
      const startX = baseX + 8;
      return [startX + (baseX - startX) * t, baseY, 0];
    }
    case 'flyAcross': {
      // Fly in from above-right with arc
      const startX = baseX + 10;
      const startY = 6;
      const arc = Math.sin(t * Math.PI) * 2;
      return [
        startX + (baseX - startX) * t,
        startY + (baseY - startY) * t + arc,
        -2 + t * 2,
      ];
    }
    case 'teleport': {
      // Glitch appear: snaps in at ~30% progress, slight overshoot
      const bt = easeOutBack(rawProgress);
      return [baseX + (1 - bt) * 0.5, baseY + (1 - bt) * 0.2, 0];
    }
    case 'riseUp': {
      // Rise from below viewport
      const startY = -8;
      return [baseX, startY + (baseY - startY) * t, 0];
    }
    case 'fallIn': {
      // Fall from above with slight bounce
      const bt = easeOutElastic(rawProgress);
      const startY = 10;
      return [baseX, startY + (baseY - startY) * bt, 0];
    }
    case 'dashIn': {
      // Speed dash from far right, overshoots then settles
      const bt = easeOutBack(rawProgress);
      const startX = baseX + 14;
      return [startX + (baseX - startX) * bt, baseY, -1 + bt];
    }
    default:
      return [baseX, baseY, 0];
  }
}

/** Calculate character position during exit animation */
export function getExitPosition(
  style: ExitStyle,
  rawProgress: number,
  baseX: number,
  baseY: number = -0.6,
): [number, number, number] {
  const t = easeInCubic(rawProgress);

  switch (style) {
    case 'slideOut': {
      const endX = baseX + 8;
      return [baseX + (endX - baseX) * t, baseY, 0];
    }
    case 'flyUp': {
      const endY = 10;
      return [baseX + t * 2, baseY + (endY - baseY) * t, -t * 3];
    }
    case 'fadeOut': {
      // Stay in place, scale handled externally
      return [baseX, baseY, -t * 2];
    }
    case 'dropDown': {
      const endY = -10;
      return [baseX, baseY + (endY - baseY) * t, 0];
    }
    case 'moveBehind': {
      return [baseX - t * 1.5, baseY, -3 * t];
    }
    case 'dashOut': {
      const endX = baseX + 16;
      const bt = easeInCubic(rawProgress);
      return [baseX + (endX - baseX) * bt, baseY, -bt];
    }
    case 'swingAway':
    default: {
      const endX = baseX + 10;
      return [baseX + (endX - baseX) * t, baseY + t * 4, -t * 2];
    }
  }
}

/** Get opacity multiplier for entrance/exit animations */
export function getAnimationOpacity(
  phase: 'entering' | 'idle' | 'exiting' | 'gone',
  progress: number,
  entranceStyle: EntranceStyle,
  exitStyle: ExitStyle,
): number {
  if (phase === 'idle') return 1;
  if (phase === 'gone') return 0;

  if (phase === 'entering') {
    if (entranceStyle === 'teleport') {
      // Snap to visible after brief delay
      return progress < 0.15 ? 0 : 1;
    }
    // Fade in over first 40% of entrance
    return Math.min(1, progress / 0.4);
  }

  // exiting
  if (exitStyle === 'fadeOut') {
    return 1 - progress;
  }
  // Fade out over last 30% of exit
  return progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
