/** Dashboard rules: Phase 4 PRD §10.2, decisions 0019 #5, 0021 and 0022. */

/** The dashboard returns at most five upcoming events — a response limit only (0022 #1). */
export const UPCOMING_EVENTS_LIMIT = 5;

/** Today's date in the wedding's timezone; owned by the weddings module (shared with tasks). */
export { todayIn } from '../../../weddings/index.js';
