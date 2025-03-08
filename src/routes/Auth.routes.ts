
import { Request, Response, Router } from "express";
import bcrypt from "bcryptjs";
import User from "../Schemas/users.schema";
import { generateToken } from "../Auth/jwtUtils";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const router = Router();

const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESSKEYID as string,
        secretAccessKey: process.env.SECRETACCESSKEY as string,
    },
});
const BUCKET_NAME = process.env.BUCKET_NAME || "buket.staticsites.dev";
// Register Route
router.post("/register", async (req: Request, res: Response) => {
    try {
        console.log(21)
        const { name, email, password, fullName } = req.body; 

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, email, and password are required"
            });
        }

        
        if (await User.findOne({ email })) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        
        if (await User.findOne({ username: name })) {
            return res.status(400).json({
                success: false,
                message: "Username already exists"
            });
        }    
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username: name,
            email,
            password: hashedPassword,
            fullName, 
        });

        await newUser.save();

        if (BUCKET_NAME) {
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: `${newUser.username}/`,  
                Body: "",
            }));
        }

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                fullName: newUser.fullName
            }
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


interface UserDocument {
    _id: string;  
    username: string;
    email: string;
    password: string;
    fullName?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    role: "User" | "Admin";
}

router.post("/login", async (req: Request, res: Response) => {
    console.log(98)
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }
        const user = await User.findOne({ email }) as UserDocument | null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        const tokenPayload = {
            username: user.username,
            id: user._id, 
            email: user.email,
            role: user.role
        };

        const token = generateToken(tokenPayload);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});
export default router;