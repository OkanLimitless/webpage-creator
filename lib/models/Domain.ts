import mongoose from 'mongoose';

export interface IDomain {
  name: string;
  cloudflareNameservers: string[];
  cloudflareZoneId?: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  verificationKey?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DomainSchema = new mongoose.Schema<IDomain>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    cloudflareNameservers: {
      type: [String],
      required: true,
    },
    cloudflareZoneId: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'active', 'inactive', 'error'],
      default: 'pending',
    },
    verificationKey: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Check if model already exists to prevent recompilation in development
export const Domain = mongoose.models.Domain || mongoose.model<IDomain>('Domain', DomainSchema); 