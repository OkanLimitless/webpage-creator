import mongoose from 'mongoose';

export interface IPhoneNumber extends mongoose.Document {
  phoneNumber: string;
  industry: 'travel' | 'pest-control';
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PhoneNumberSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    enum: ['travel', 'pest-control']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create compound index for industry and active status
PhoneNumberSchema.index({ industry: 1, isActive: 1 });

export const PhoneNumber = mongoose.models.PhoneNumber || mongoose.model<IPhoneNumber>('PhoneNumber', PhoneNumberSchema); 