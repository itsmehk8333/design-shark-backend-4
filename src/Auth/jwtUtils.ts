import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
  
const SECRET_KEY = process.env.JWT_SECRET || "Im Batman";

export const generateToken = (payload: { id: string; email: string; role: string }): string => {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: "1h" });
};
export const verifyToken = (token: string): any => {
  return jwt.verify(token, SECRET_KEY);
};
