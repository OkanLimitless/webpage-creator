import mongoose from 'mongoose';

export interface IRootPage {
  domainId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  isActive: boolean;
  
  // Hero section
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl?: string;
  heroButtonText?: string;
  heroButtonUrl?: string;
  
  // Features/services section
  features: {
    title: string;
    description: string;
    iconName?: string;
  }[];
  
  // Testimonials section
  testimonials?: {
    name: string;
    role?: string;
    comment: string;
    avatarUrl?: string;
  }[];
  
  // Contact section
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  
  // Company info for footer
  companyName?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  
  // Styling & branding
  primaryColor?: string;
  logoUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const RootPageSchema = new mongoose.Schema<IRootPage>(
  {
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: true,
      unique: true, // Only one root page per domain
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Hero section
    heroTitle: {
      type: String,
      required: true,
      trim: true,
    },
    heroSubtitle: {
      type: String,
      required: true,
      trim: true,
    },
    heroImageUrl: {
      type: String,
      trim: true,
    },
    heroButtonText: {
      type: String,
      trim: true,
    },
    heroButtonUrl: {
      type: String,
      trim: true,
    },
    
    // Features/services section
    features: [{
      title: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        required: true,
        trim: true,
      },
      iconName: {
        type: String,
        trim: true,
      },
    }],
    
    // Testimonials section
    testimonials: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      role: {
        type: String,
        trim: true,
      },
      comment: {
        type: String,
        required: true,
        trim: true,
      },
      avatarUrl: {
        type: String,
        trim: true,
      },
    }],
    
    // Contact section
    contactTitle: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactAddress: {
      type: String,
      trim: true,
    },
    
    // Company info for footer
    companyName: {
      type: String,
      trim: true,
    },
    privacyPolicyUrl: {
      type: String,
      trim: true,
    },
    termsUrl: {
      type: String,
      trim: true,
    },
    
    // Styling & branding
    primaryColor: {
      type: String,
      trim: true,
      default: '#3b82f6', // Default to blue
    },
    logoUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Check if model already exists to prevent recompilation in development
export const RootPage = mongoose.models.RootPage || 
  mongoose.model<IRootPage>('RootPage', RootPageSchema); 