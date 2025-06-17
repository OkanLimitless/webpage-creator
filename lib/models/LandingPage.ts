import mongoose from 'mongoose';
import { IDomain } from './Domain';

export interface ILandingPage extends mongoose.Document {
  name: string;
  domainId: mongoose.Types.ObjectId | IDomain;
  subdomain: string;
  affiliateUrl: string;
  originalUrl: string;
  desktopScreenshotUrl: string;
  mobileScreenshotUrl: string;
  isActive: boolean;
  googleAdsAccountId?: string;
  googleAnalyticsId?: string;
  facebookPixelId?: string;
  banCount?: number;
  manualScreenshots?: boolean;
  createdAt: Date;
  updatedAt: Date;
  templateType: 'standard' | 'call-ads' | 'cloaked';
  callAdsTemplateType?: 'travel' | 'pest-control';
  phoneNumber?: string;
  businessName?: string;
  // Cloaking specific fields
  moneyUrl?: string;
  targetCountries?: string[];
  excludeCountries?: string[];
  workerScriptName?: string;
  workerRouteId?: string;
  safePageContent?: string;
  safeUrl?: string; // Store the original safe URL for bots (e.g., https://www.auxmoney.com/)
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
      required: false,
      trim: true,
      lowercase: true,
      default: '',
    },
    affiliateUrl: {
      type: String,
      required: function(this: ILandingPage) {
        return this.templateType === 'standard';
      },
      trim: true,
      default: '',
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
    googleAnalyticsId: {
      type: String,
      trim: true,
    },
    banCount: {
      type: Number,
      default: 0,
    },
    manualScreenshots: {
      type: Boolean,
      default: false,
    },
    templateType: {
      type: String,
      enum: ['standard', 'call-ads', 'cloaked'],
      default: 'standard',
    },
    callAdsTemplateType: {
      type: String,
      enum: ['travel', 'pest-control'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      required: function(this: ILandingPage) {
        return this.templateType === 'call-ads';
      },
    },
    businessName: {
      type: String,
      trim: true,
      required: function(this: ILandingPage) {
        return this.templateType === 'call-ads';
      },
    },
    moneyUrl: {
      type: String,
      trim: true,
    },
    targetCountries: {
      type: [String],
      trim: true,
    },
    excludeCountries: {
      type: [String],
      trim: true,
    },
    workerScriptName: {
      type: String,
      trim: true,
    },
    workerRouteId: {
      type: String,
      trim: true,
    },
    safePageContent: {
      type: String,
      trim: true,
    },
    safeUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Create a compound index for domainId and subdomain to ensure uniqueness
// For external domains (empty subdomain), only one landing page per domain is allowed
// For regular domains, subdomain must be unique within the domain
LandingPageSchema.index({ domainId: 1, subdomain: 1 }, { 
  unique: true,
  partialFilterExpression: { subdomain: { $ne: '' } }  // Only apply uniqueness when subdomain is not empty
});

// Separate index to ensure only one landing page per domain when subdomain is empty (external domains)
LandingPageSchema.index({ domainId: 1 }, { 
  unique: true,
  partialFilterExpression: { subdomain: '' }  // Only apply when subdomain is empty
});

// Check if model already exists to prevent recompilation in development
export const LandingPage = mongoose.models.LandingPage || 
  mongoose.model<ILandingPage>('LandingPage', LandingPageSchema); 