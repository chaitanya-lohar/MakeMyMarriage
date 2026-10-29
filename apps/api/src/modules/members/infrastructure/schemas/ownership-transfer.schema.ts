import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { OWNER_SEATS, type OwnerSeat } from '../../../workspace/index.js';
import {
  OwnershipTransferStatus,
  TransferCancelReason,
} from '../../domain/types/ownership-transfer.js';

/** `ownership_transfers` collection (Database Design §7.6). */
@Schema({ collection: 'ownership_transfers', timestamps: true })
export class OwnershipTransferRecord {
  @Prop({ type: Types.ObjectId, required: true })
  weddingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  fromMembershipId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  toMembershipId!: Types.ObjectId;

  @Prop({ type: Number, required: true, enum: OWNER_SEATS })
  ownerSeat!: OwnerSeat;

  @Prop({ type: String, required: true, enum: Object.values(OwnershipTransferStatus) })
  status!: OwnershipTransferStatus;

  @Prop({ type: Types.ObjectId, required: true })
  requestedBy!: Types.ObjectId;

  @Prop()
  respondedAt?: Date;

  @Prop({ type: String, enum: Object.values(TransferCancelReason) })
  cancelledReason?: TransferCancelReason;

  createdAt!: Date;
  updatedAt!: Date;
}

export type OwnershipTransferDocument = HydratedDocument<OwnershipTransferRecord>;
export const OwnershipTransferSchema = SchemaFactory.createForClass(OwnershipTransferRecord);

// One open offer per wedding, so two owners never move seats at once (§7.6, §20).
OwnershipTransferSchema.index(
  { weddingId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: OwnershipTransferStatus.Pending },
    name: 'one_pending_ownership_transfer_per_wedding',
  },
);
OwnershipTransferSchema.index({ weddingId: 1, createdAt: -1 });
