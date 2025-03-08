import mongoose, { Schema, Document } from "mongoose";


export interface IFile extends Document {
    filename: string;
    fileType: string; 
    size: number; 
    s3Url: string; 
    uploadedBy: mongoose.Schema.Types.ObjectId;
    parentFolder: mongoose.Schema.Types.ObjectId | null;
    isDeleted: boolean; 
    createdAt: Date;
    updatedAt: Date;
  }
  
  const FileSchema = new Schema<IFile>(
    {
      filename: { type: String, required: true },
      fileType: { type: String, required: true }, 
      size: { type: Number, required: true }, 
      s3Url: { type: String, required: true }, 
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      parentFolder: { type: Schema.Types.ObjectId, ref: "Folder", default: null }, 
      isDeleted: { type: Boolean, default: false }, 
    },
    { timestamps: true }
  );
  
  const File = mongoose.model<IFile>("File", FileSchema);

  export default File;