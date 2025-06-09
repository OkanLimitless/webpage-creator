require('dotenv').config();
const mongoose = require('mongoose');

// Phone Number Schema (matching the TypeScript model)
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

const PhoneNumber = mongoose.models.PhoneNumber || mongoose.model('PhoneNumber', PhoneNumberSchema);

async function addPhoneNumbers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Sample phone numbers for testing
    const travelNumbers = [
      '+1-555-TRAVEL-1',
      '+1-555-TRAVEL-2', 
      '+1-555-TRAVEL-3',
      '+1-555-FLY-NOW1',
      '+1-555-FLY-NOW2'
    ];

    const pestControlNumbers = [
      '+1-555-PEST-001',
      '+1-555-PEST-002',
      '+1-555-PEST-003',
      '+1-555-BUG-KILL',
      '+1-555-NO-BUGS1'
    ];

    // Add travel numbers
    for (const phoneNumber of travelNumbers) {
      try {
        await PhoneNumber.create({
          phoneNumber,
          industry: 'travel',
          description: 'Sample travel phone number for testing'
        });
        console.log(`✅ Added travel number: ${phoneNumber}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Travel number already exists: ${phoneNumber}`);
        } else {
          console.error(`❌ Error adding travel number ${phoneNumber}:`, error.message);
        }
      }
    }

    // Add pest control numbers
    for (const phoneNumber of pestControlNumbers) {
      try {
        await PhoneNumber.create({
          phoneNumber,
          industry: 'pest-control',
          description: 'Sample pest control phone number for testing'
        });
        console.log(`✅ Added pest control number: ${phoneNumber}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Pest control number already exists: ${phoneNumber}`);
        } else {
          console.error(`❌ Error adding pest control number ${phoneNumber}:`, error.message);
        }
      }
    }

    // Show summary
    const travelCount = await PhoneNumber.countDocuments({ industry: 'travel', isActive: true });
    const pestControlCount = await PhoneNumber.countDocuments({ industry: 'pest-control', isActive: true });
    
    console.log('\n📊 Summary:');
    console.log(`Travel phone numbers: ${travelCount}`);
    console.log(`Pest control phone numbers: ${pestControlCount}`);
    console.log(`Total active phone numbers: ${travelCount + pestControlCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

addPhoneNumbers(); 