import mongoose from 'mongoose';

export interface ILandingPage {
  name: string;
  domainId: mongoose.Types.ObjectId;
  subdomain: string;
  affiliateUrl: string;
  originalUrl: string;
  desktopScreenshotUrl: string;
  mobileScreenshotUrl: string;
  isActive: boolean;
  googleAdsAccountId?: string;
  banCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LandingPageSchema = new mongoose.Schema<ILandingPage>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: true,
    },
    subdomain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    affiliateUrl: {
      type: String,
      required: true,
      trim: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    desktopScreenshotUrl: {
      type: String,
      trim: true,
    },
    mobileScreenshotUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    googleAdsAccountId: {
      type: String,
      trim: true,
    },
    banCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Create a compound index for domainId and subdomain to ensure uniqueness
LandingPageSchema.index({ domainId: 1, subdomain: 1 }, { unique: true });

// Check if model already exists to prevent recompilation in development
export const LandingPage = mongoose.models.LandingPage || 
  mongoose.model<ILandingPage>('LandingPage', LandingPageSchema); 