// Public entry point of the weddings module (decision 0006).
export { WeddingsModule } from './weddings.module.js';
export { WeddingsService } from './application/services/weddings.service.js';
export { isCalendarDate, WEDDING_TIMEZONE } from './domain/rules/wedding-rules.js';
export type { Wedding } from './domain/types/wedding.js';
