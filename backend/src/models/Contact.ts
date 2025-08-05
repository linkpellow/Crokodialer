import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
  mainSiteUserId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber: string;
  email?: string;
  company?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>({
  mainSiteUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  email: String,
  company: String
}, {
  timestamps: true
});

const Contact = mongoose.model<IContact>('Contact', contactSchema);

export default Contact; 