import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  mainSiteUserId?: mongoose.Types.ObjectId;
  dialerSettings?: {
    defaultFromNumber?: string;
    callRecording?: boolean;
    sipCredentials?: {
      username?: string;
      password?: string;
      domain?: string;
    };
  };
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  mainSiteUserId: {
    type: Schema.Types.ObjectId,
    ref: 'MainSiteUser',
    index: true
  },
  dialerSettings: {
    defaultFromNumber: {
      type: String,
      default: ''
    },
    callRecording: {
      type: Boolean,
      default: false
    },
    sipCredentials: {
      username: {
        type: String,
        default: ''
      },
      password: {
        type: String,
        default: ''
      },
      domain: {
        type: String,
        default: ''
      }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(this: IUser, next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User; 