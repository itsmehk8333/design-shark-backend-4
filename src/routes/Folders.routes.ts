import { Request, Response, Router } from "express";

import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { authenticateJWT } from "../Auth/authMiddleware";
import Folder, { IFolder } from "../Schemas/Folders.schema";
import mongoose from "mongoose";
dotenv.config();
const router = Router();

const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESSKEYID as string,
        secretAccessKey: process.env.SECRETACCESSKEY as string,
    },
});
interface AuthRequest extends Request {
    user?: { username: string; id: string }; 
}

router.post('/create-folder', async (req: AuthRequest, res: Response) => {
    try {
        const { folderName, parentFolderId } = req.body; 

        if (!folderName) {
            return res.status(400).json({ message: 'Folder name is required' });
        }

        const user = req.user;
        if (!user || !user.username || !user.id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        
        const folderPath = `${user.username}/${folderName}/`; 

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: folderPath,
            Body: '', 
            ContentType: 'application/x-directory',
        });

        await s3Client.send(command);


        const newFolder: IFolder = new Folder({
            name: folderName,
            createdBy: new mongoose.Types.ObjectId(user.id), 
            parentFolder: parentFolderId ? new mongoose.Types.ObjectId(parentFolderId) : null, 
            s3Path: folderPath,
            isDeleted: false,
        });

        const savedFolder = await newFolder.save();

        res.status(201).json({
            message: 'Folder created successfully',
            folder: {
                id: savedFolder._id,
                name: savedFolder.name,
                s3Path: savedFolder.s3Path,
                parentFolder: savedFolder.parentFolder,
                createdBy: savedFolder.createdBy,
                createdAt: savedFolder.createdAt,
                updatedAt: savedFolder.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({
            message: 'Internal Server Error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

interface Folder {
    name: string;
    totalItems: number;
}
router.get("/list-folders", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const bucketName = process.env.BUCKET_NAME;
        const user = (req as any).user;

        if (!user || !user.username) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const prefix = `${user.username}/`;

        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
        });

        const response = await s3Client.send(command);
        console.log(response, "response");

       
        const folderMap = new Map<string, number>();

        (response.Contents || []).forEach(item => {
            if (!item.Key || item.Key === prefix) return;

            
            const relativePath = item.Key.substring(prefix.length);
            const pathParts = relativePath.split('/');

            if (pathParts.length > 0) {
                const folderName = pathParts[0];
                folderMap.set(folderName, (folderMap.get(folderName) || 0) + 1);
            }
        });

        const folders = Array.from(folderMap.entries()).map(([name, totalItems]) => ({
            name,
            totalItems: totalItems - 1, 
        }));

    
        const itemCount = folders.length;

        res.status(200).json({
            message: "Folders retrieved successfully",
            folders,
            itemCount,
            prefix: response.Prefix || "",
        });

    } catch (error) {
        console.error("Error listing folders:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


export default router;
