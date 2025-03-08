import express, { Request, Response } from 'express';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose from 'mongoose';
import File, { IFile } from '../Schemas/Files.schema'; 
import Folder from '../Schemas/Folders.schema'; 

const router = express.Router();
const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESSKEYID as string,
        secretAccessKey: process.env.SECRETACCESSKEY as string,
    },
});

interface UploadRequest extends Request {
    body: {
        name: string;
        contentType: string;
        folder: string;
    };
}

interface AuthRequest extends Request {
    user?: { username: string; id: string };
}

interface S3File {
    name: string;
    key: string;
    size: number;
    url: string;
}

router.post('/upload', async (req: AuthRequest, res: Response) => {
    try {
        const { name, contentType, folder } = req.body;
        const user = req.user;

        if (!user || !user.username || !user.id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!name || !contentType || !folder) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        const key = `${user.username}/${name}`;
        const command = new PutObjectCommand({
            Bucket: 'buket.staticsites.dev',
            Key: key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({ uploadUrl: url, key });
    } catch (error) {
        console.error('S3 Upload Error:', error);
        res.status(500).json({ error: 'Failed to generate presigned URL.' });
    }
});

router.post('/confirm-upload', async (req: AuthRequest, res: Response) => {
    try {
        const { key, size, fileType, folder } = req.body;
        const user = req.user;

        if (!user || !user.id || !user.username) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!key || !size || !fileType || !folder) {
            return res.status(400).json({ message: 'Key, size, file type, and folder are required' });
        }

        const parentFolder = await Folder.findOne({
            name: folder,
            createdBy: new mongoose.Types.ObjectId(user.id),
            isDeleted: false,
        });

        if (!parentFolder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        const s3Url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: 'buket.staticsites.dev',
                Key: key,
            }),
            { expiresIn: 3600 }
        );

        const newFile: IFile = new File({
            filename: key.split('/').pop()!,
            fileType,
            size,
            s3Url,
            uploadedBy: new mongoose.Types.ObjectId(user.id),
            parentFolder: parentFolder._id,
            isDeleted: false,
        });

        const savedFile = await newFile.save();

        res.status(201).json({
            message: 'File metadata saved successfully',
            file: {
                id: savedFile._id,
                filename: savedFile.filename,
                fileType: savedFile.fileType,
                size: savedFile.size,
                s3Url: savedFile.s3Url,
                parentFolder: savedFile.parentFolder,
                uploadedBy: savedFile.uploadedBy,
                createdAt: savedFile.createdAt,
                updatedAt: savedFile.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error saving file metadata:', error);
        res.status(500).json({
            message: 'Internal Server Error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});


router.get('/:folderPath', async (req: AuthRequest, res: Response) => {
    const { folderPath } = req.params;
    const user = req.user;

    if (!user || !user.id || !user.username) {
        return res.status(401).json({ message: 'Unauthorized: No username found' });
    }

    try {
        const parentFolder = await Folder.findOne({
            name: folderPath,
            createdBy: new mongoose.Types.ObjectId(user.id),
            isDeleted: false,
        });

        if (!parentFolder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        const files = await File.find({
            parentFolder: parentFolder._id,
            uploadedBy: new mongoose.Types.ObjectId(user.id),
            isDeleted: false,
        }).lean();

        const filesWithFreshUrls: S3File[] = await Promise.all(
            files.map(async (file) => {
                const key = `${user.username}/${folderPath}/${file.filename}`;
                const signedUrl = await getSignedUrl(
                    s3Client,
                    new GetObjectCommand({
                        Bucket: 'buket.staticsites.dev',
                        Key: key,
                    }),
                    { expiresIn: 3600 }
                );
                return {
                    name: file.filename,
                    key: key,
                    size: file.size,
                    url: signedUrl,
                };
            })
        );

        res.status(200).json({
            message: 'Files retrieved successfully',
            files: filesWithFreshUrls,
            itemCount: filesWithFreshUrls.length,
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching files',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});


router.delete('/delete', async (req: AuthRequest, res: Response) => {
    const { key } = req.body;
    const user = req.user;

    if (!user || !user.id || !user.username) {
        return res.status(401).json({ message: 'Unauthorized: No username found' });
    }

    if (!key || typeof key !== 'string') {
        return res.status(400).json({ message: 'Invalid or missing file key' });
    }

    if (!key.startsWith(`${user.username}/`)) {
        return res.status(403).json({ message: 'Forbidden: Cannot delete files outside your namespace' });
    }

    try {

        const file = await File.findOne({
            filename: key.split('/').pop(),
            uploadedBy: new mongoose.Types.ObjectId(user.id),
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: 'buket.staticsites.dev',
                Key: key,
            })
        );

        file.isDeleted = true;
        await file.save();

        res.status(200).json({
            message: 'File deleted successfully',
            key,
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error deleting file',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

router.put('/rename', async (req: AuthRequest, res: Response) => {
    const { oldKey, newName } = req.body;
    const user = req.user;

    if (!user || !user.id || !user.username) {
        return res.status(401).json({ message: 'Unauthorized: No username found' });
    }

    if (!oldKey || !newName || typeof oldKey !== 'string' || typeof newName !== 'string') {
        return res.status(400).json({ message: 'Invalid or missing oldKey or newName' });
    }

    if (!oldKey.startsWith(`${user.username}/`)) {
        return res.status(403).json({ message: 'Forbidden: Cannot rename files outside your namespace' });
    }

    const folderPath = oldKey.substring(0, oldKey.lastIndexOf('/') + 1);
    const newKey = `${folderPath}${newName}`;

    try {

        const file = await File.findOne({
            filename: oldKey.split('/').pop(),
            uploadedBy: new mongoose.Types.ObjectId(user.id),
            isDeleted: false,
        });

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        await s3Client.send(
            new CopyObjectCommand({
                Bucket: 'buket.staticsites.dev',
                CopySource: `buket.staticsites.dev/${oldKey}`,
                Key: newKey,
            })
        );

        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: 'buket.staticsites.dev',
                Key: oldKey,
            })
        );
        file.filename = newName;
        file.s3Url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: 'buket.staticsites.dev',
                Key: newKey,
            }),
            { expiresIn: 3600 }
        );
        const updatedFile = await file.save();

        res.status(200).json({
            message: 'File renamed successfully',
            oldKey,
            newKey,
            file: {
                id: updatedFile._id,
                filename: updatedFile.filename,
                fileType: updatedFile.fileType,
                size: updatedFile.size,
                s3Url: updatedFile.s3Url,
            },
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error renaming file',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

export default router;