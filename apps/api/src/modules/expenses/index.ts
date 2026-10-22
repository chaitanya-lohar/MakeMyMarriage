// Public entry point of the expenses module (decision 0006).
export { ExpensesService } from './application/services/expenses.service.js';
export {
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  PAYMENT_STATUSES,
  PaymentStatus,
} from './domain/rules/expense-rules.js';
export type { ExpenseSummary } from './domain/types/expense.js';
export { ExpenseSummaryDto } from './api/dto/expense.dto.js';
export { ExpensesModule } from './expenses.module.js';
