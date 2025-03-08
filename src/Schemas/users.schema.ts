import mongoose, { Schema, Document } from 'mongoose';


interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  role: string
}

const UserSchema: Schema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [50, 'Full name cannot exceed 50 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      default: "User",
      enum: ["User", "Admin"]
    }
  },
  {
    timestamps: true, 
  }
);

const User = mongoose.model("User", UserSchema)

export default User