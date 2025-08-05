const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected for migration');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const runMigration = async () => {
  await connectDB();

  const User = mongoose.model('User', new mongoose.Schema({
    mainSiteUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MainSiteUser',
      index: true
    }
  }));

  // Add mainSiteUserId to existing users
  await User.updateMany({}, { $set: { mainSiteUserId: null } });
  console.log('mainSiteUserId added to existing users');

  // Create indexes
  await User.collection.createIndex({ mainSiteUserId: 1 });
  console.log('Indexes created');

  mongoose.connection.close();
  console.log('Migration completed and connection closed');
};

runMigration().catch(error => console.error(`Migration error: ${error.message}`)); 