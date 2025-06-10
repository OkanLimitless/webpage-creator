import mongoose from 'mongoose';

const JciLogSchema = new mongoose.Schema({
  // Visitor Information
  ip: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  
  // Decision Information
  decision: {
    type: String,
    enum: ['MONEY_PAGE', 'SAFE_PAGE'],
    required: true,
    index: true
  },
  reason: {
    type: String,
    enum: ['JCI_APPROVED', 'JCI_BLOCKED', 'JCI_API_FAILED', 'WORKER_ERROR'],
    required: true,
    index: true
  },
  
  // JCI API Response Data
  jciResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Error Information (if any)
  error: {
    type: String,
    default: null
  },
  
  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  workerVersion: {
    type: String,
    default: '1.0'
  },
  
  // Domain Information (extracted from referrer or URL)
  domain: {
    type: String,
    index: true
  },
  
  // Additional extracted data from JCI response
  country: {
    type: String,
    index: true
  },
  device: String,
  os: String,
  browser: String,
  isp: String,
  riskScore: Number,
  
}, {
  timestamps: true,
  collection: 'jci_logs'
});

// Create indexes for efficient querying
JciLogSchema.index({ timestamp: -1 });
JciLogSchema.index({ decision: 1, timestamp: -1 });
JciLogSchema.index({ reason: 1, timestamp: -1 });
JciLogSchema.index({ domain: 1, timestamp: -1 });
JciLogSchema.index({ country: 1, timestamp: -1 });

export const JciLog = mongoose.models.JciLog || mongoose.model('JciLog', JciLogSchema); 