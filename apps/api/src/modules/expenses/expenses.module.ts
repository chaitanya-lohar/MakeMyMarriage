import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { EventExpenses, EventsModule } from '../events/index.js';
import { UsersModule } from '../users/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { ExpensesController } from './api/controllers/expenses.controller.js';
import { EventExpensesAdapter } from './application/services/event-expenses.adapter.js';
import { ExpensesService } from './application/services/expenses.service.js';
import { ExpensePaymentsUseCase } from './application/use-cases/expense-payments.use-case.js';
import { ListExpensesUseCase } from './application/use-cases/list-expenses.use-case.js';
import { SaveExpenseUseCase } from './application/use-cases/save-expense.use-case.js';
import { ExpensePaymentsRepository } from './infrastructure/repositories/expense-payments.repository.js';
import { ExpensesRepository } from './infrastructure/repositories/expenses.repository.js';
import {
  ExpensePaymentRecord,
  ExpensePaymentSchema,
} from './infrastructure/schemas/expense-payment.schema.js';
import { ExpenseRecord, ExpenseSchema } from './infrastructure/schemas/expense.schema.js';

/**
 * Wedding expenses and their payments (System Design §12.1, Database Design §12, decision
 * 0028). Receipts are deferred (0028 #3).
 *
 * Global only so the events module can use the EventExpenses port without importing this
 * module, which depends on events (see the port).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExpenseRecord.name, schema: ExpenseSchema },
      { name: ExpensePaymentRecord.name, schema: ExpensePaymentSchema },
    ]),
    WorkspaceModule,
    WeddingsModule,
    EventsModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [ExpensesController],
  providers: [
    ExpensesRepository,
    ExpensePaymentsRepository,
    ExpensesService,
    SaveExpenseUseCase,
    ListExpensesUseCase,
    ExpensePaymentsUseCase,
    { provide: EventExpenses, useClass: EventExpensesAdapter },
  ],
  exports: [ExpensesService, EventExpenses],
})
export class ExpensesModule {}
