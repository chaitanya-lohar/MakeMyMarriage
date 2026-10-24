// Public entry point of the events module (decision 0006).
export { EventExpenses } from './application/ports/event-expenses.port.js';
export { EventTasks } from './application/ports/event-tasks.port.js';
export { EventVendors } from './application/ports/event-vendors.port.js';
export { EventsService } from './application/services/events.service.js';
export { EVENT_TYPES, EventType } from './domain/rules/event-rules.js';
export type { EventVenue, WeddingEvent } from './domain/types/event.js';
export { EventsModule } from './events.module.js';
