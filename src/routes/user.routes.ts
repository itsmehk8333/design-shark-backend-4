import { Request, Response, Router } from "express";
import User from "../Schemas/users.schema";

const router = Router();

interface UserRequestBody {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    isActive?: boolean;
}

router.post("/add-user", async (req: Request<{}, {}, UserRequestBody>, res: Response) => {
    try {
        console.log(req.body);
        const { username, email, password, fullName, isActive } = req.body;

        const createUser = new User({
            username,
            email,
            password,
            fullName,
            isActive
        });

        const saveUser = await createUser.save();
        res.status(201).json({
            success: true,
            message: "User created successfully!!",
            data: saveUser
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Unknown Error!!"
            });
        }
    }
});

router.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Unknown Error!!"
            });
        }
    }
});


router.get("/users/:id", async (req: Request<{ id: string }>, res: Response) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: user
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Unknown Error!!"
            });
        }
    }
});


router.put("/users/:id", async (req: Request<{ id: string }, {}, Partial<UserRequestBody>>, res: Response) => {
    try {
        const { username, email, password, fullName, isActive } = req.body;

        const updateData: Partial<UserRequestBody> = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (fullName !== undefined) updateData.fullName = fullName;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: updatedUser
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Unknown Error!!"
            });
        }
    }
});


router.delete("/users/:id", async (req: Request<{ id: string }>, res: Response) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Unknown Error!!"
            });
        }
    }
});

export default router;