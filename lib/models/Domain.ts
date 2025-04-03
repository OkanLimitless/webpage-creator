import mongoose from 'mongoose';

export interface IDomain {
  name: string;
  cloudflareNameservers: string[];
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Check if model already exists to prevent recompilation in development
export const Domain = mongoose.models.Domain || mongoose.model<IDomain>('Domain', DomainSchema); 