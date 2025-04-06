import mongoose from 'mongoose';

export interface IDomainDeployment {
  domainId: mongoose.Types.ObjectId;
  domainName: string;
  deploymentId: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'cancelled';
  vercelProjectId?: string;
  deploymentUrl?: string;
  logs: Array<{
    timestamp: Date;
    message: string;
    level: 'info' | 'warning' | 'error';
    data?: any;
  }>;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DomainDeploymentSchema = new mongoose.Schema<IDomainDeployment>(
  {
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Domain',
      required: true,
      index: true,
    },
    domainName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    deploymentId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'deploying', 'deployed', 'failed', 'cancelled'],
      default: 'pending',
    },
    vercelProjectId: {
      type: String,
      trim: true,
    },
    deploymentUrl: {
      type: String,
      trim: true,
    },
    logs: [{
      timestamp: {
        type: Date,
        default: Date.now,
      },
      message: {
        type: String,
        required: true,
      },
      level: {
        type: String,
        enum: ['info', 'warning', 'error'],
        default: 'info',
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
      },
    }],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Create indexes for better query performance
DomainDeploymentSchema.index({ domainId: 1, createdAt: -1 });
DomainDeploymentSchema.index({ deploymentId: 1 }, { unique: true });
DomainDeploymentSchema.index({ status: 1, createdAt: -1 });

// Utility method to add a log entry
DomainDeploymentSchema.methods.addLog = function(
  message: string, 
  level: 'info' | 'warning' | 'error' = 'info', 
  data?: any
) {
  this.logs.push({
    timestamp: new Date(),
    message,
    level,
    data,
  });
};

// Export the model
export const DomainDeployment = mongoose.models.DomainDeployment || 
  mongoose.model<IDomainDeployment>('DomainDeployment', DomainDeploymentSchema); 