import { Module } from '@nestjs/common';
import { EventsModule } from '../events/index.js';
import { ExpensesModule } from '../expenses/index.js';
import { GuestsModule } from '../guests/index.js';
import { TasksModule } from '../tasks/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { DashboardController } from './api/controllers/dashboard.controller.js';
import { GetDashboardUseCase } from './application/use-cases/get-dashboard.use-case.js';

/**
 * Wedding dashboard summaries (PRD §18, decisions 0022, 0026 and 0028). A separate module
 * because it reads weddings, events, guests, tasks and expenses, which depend on one another.
 * It owns no data.
 */
@Module({
  imports: [
    WorkspaceModule,
    WeddingsModule,
    EventsModule,
    GuestsModule,
    TasksModule,
    ExpensesModule,
  ],
  controllers: [DashboardController],
  providers: [GetDashboardUseCase],
})
export class DashboardModule {}
