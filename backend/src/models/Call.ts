import mongoose, { Document, Schema } from 'mongoose';

export interface ICall extends Document {
  mainSiteUserId?: mongoose.Types.ObjectId;
  fromNumber: string;
  toNumber: string;
  status: 'initiated' | 'ringing' | 'active' | 'completed' | 'failed';
  fusionPBXCallId?: string;
  telnyxCallId?: string;
  duration?: number;
  recordingUrl?: string;
  cost?: number;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  callControlId?: string;
  callLegId?: string;
}

const callSchema = new Schema<ICall>({
  mainSiteUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  fromNumber: {
    type: String,
    required: true
  },
  toNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'active', 'completed', 'failed'],
    default: 'initiated'
  },
  fusionPBXCallId: String,
  telnyxCallId: String,
  duration: Number,
  recordingUrl: String,
  cost: Number,
  startTime: Date,
  endTime: Date,
  callControlId: String,
  callLegId: String
}, {
  timestamps: true
});

const Call = mongoose.model<ICall>('Call', callSchema);

export default Call; 