import mongoose from 'mongoose';

export interface IDomain {
  name: string;
  cloudflareNameservers: string[];
  cloudflareZoneId?: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  verificationKey?: string;
  isActive: boolean;
  // Deployment-related fields
  deploymentId?: string;
  deploymentStatus: 'pending' | 'deploying' | 'deployed' | 'failed' | 'not_deployed';
  deploymentUrl?: string;
  lastDeployedAt?: Date;
  // Ban tracking
  banCount?: number;
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
    // Deployment-related fields
    deploymentId: {
      type: String,
      trim: true,
    },
    deploymentStatus: {
      type: String,
      enum: ['pending', 'deploying', 'deployed', 'failed', 'not_deployed'],
      default: 'not_deployed',
    },
    deploymentUrl: {
      type: String,
      trim: true,
    },
    lastDeployedAt: {
      type: Date,
    },
    // Ban tracking
    banCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Check if model already exists to prevent recompilation in development
export const Domain = mongoose.models.Domain || mongoose.model<IDomain>('Domain', DomainSchema); 