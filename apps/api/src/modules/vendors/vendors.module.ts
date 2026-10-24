import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/index.js';
import { EventVendors, EventsModule } from '../events/index.js';
import { WeddingsModule } from '../weddings/index.js';
import { WorkspaceModule } from '../workspace/index.js';
import { VendorsController } from './api/controllers/vendors.controller.js';
import { EventVendorsAdapter } from './application/services/event-vendors.adapter.js';
import { VendorsService } from './application/services/vendors.service.js';
import { VendorsRepository } from './infrastructure/repositories/vendors.repository.js';
import {
  VendorBookingRecord,
  VendorBookingSchema,
} from './infrastructure/schemas/vendor-booking.schema.js';
import { VendorRecord, VendorSchema } from './infrastructure/schemas/vendor.schema.js';
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorRecord.name, schema: VendorSchema },
      { name: VendorBookingRecord.name, schema: VendorBookingSchema },
    ]),
    EventsModule,
    WeddingsModule,
    WorkspaceModule,
    AuditModule,
  ],
  controllers: [VendorsController],
  providers: [
    VendorsRepository,
    VendorsService,
    { provide: EventVendors, useClass: EventVendorsAdapter },
  ],
  exports: [VendorsService, EventVendors],
})
export class VendorsModule {}
