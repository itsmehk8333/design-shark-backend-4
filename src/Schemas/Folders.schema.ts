import mongoose, { Schema, Document } from "mongoose";

export interface IFolder extends Document {
  name: string;
  createdBy: mongoose.Schema.Types.ObjectId;
  parentFolder?: mongoose.Schema.Types.ObjectId | null; 
  s3Path: string; 
  isDeleted: boolean; 
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentFolder: { type: Schema.Types.ObjectId, ref: "Folder", default: null }, 
    s3Path: { type: String, required: true }, 
    isDeleted: { type: Boolean, default: false }, 
  },
  { timestamps: true }
);



const Folder = mongoose.model<IFolder>("Folder", FolderSchema);

export default Folder;
