import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceModule } from '../workspace/index.js';
import { WeddingsController } from './api/controllers/weddings.controller.js';
import { CreateWeddingUseCase } from './application/use-cases/create-wedding.use-case.js';
import { GetWeddingUseCase } from './application/use-cases/get-wedding.use-case.js';
import { ListWeddingsUseCase } from './application/use-cases/list-weddings.use-case.js';
import { UpdateWeddingUseCase } from './application/use-cases/update-wedding.use-case.js';
import { WeddingsService } from './application/services/weddings.service.js';
import { WeddingsRepository } from './infrastructure/repositories/weddings.repository.js';
import { WeddingRecord, WeddingSchema } from './infrastructure/schemas/wedding.schema.js';

/** Wedding identity and couple details (System Design §6, decision 0016). */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: WeddingRecord.name, schema: WeddingSchema }]),
    WorkspaceModule,
  ],
  controllers: [WeddingsController],
  providers: [
    WeddingsRepository,
    CreateWeddingUseCase,
    ListWeddingsUseCase,
    GetWeddingUseCase,
    UpdateWeddingUseCase,
    WeddingsService,
  ],
  exports: [WeddingsService],
})
export class WeddingsModule {}
