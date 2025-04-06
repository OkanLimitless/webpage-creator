import mongoose from 'mongoose';

// Define interface for RootPage
interface IRootPage extends mongoose.Document {
  domainId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  content: string;
  isActive: boolean;
  metaTags: string[];
  redirectWwwToNonWww: boolean;
  customHead: string;
  customCss: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema for the root page
const RootPageSchema = new mongoose.Schema(
  {
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: true,
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
    content: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metaTags: {
      type: [String],
      default: [],
    },
    redirectWwwToNonWww: {
      type: Boolean,
      default: true, // Default to redirecting www to non-www for SEO best practices
    },
    customHead: {
      type: String,
      default: '',
    },
    customCss: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Add unique index to domainId to ensure one root page per domain
RootPageSchema.index({ domainId: 1 }, { unique: true });

// Create and export the RootPage model
export const RootPage = mongoose.models.RootPage || mongoose.model<IRootPage>('RootPage', RootPageSchema); 