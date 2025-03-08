import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Users from './routes/user.routes';
import folder from './routes/Folders.routes';
import Files from './routes/Files.routes';
import Auth from './routes/Auth.routes';
import { authenticateJWT } from './Auth/authMiddleware';

dotenv.config();

const app = express();
app.use(cors());
const port = process.env.PORT || '5000';
const dbUrl = process.env.MONGO_URI;

if (!dbUrl) {
  throw new Error('MONGO_URI is not defined in the environment variables');
}

if (!port) {
  throw new Error('PORT is not defined in the environment variables');
}
// Allows all origins, methods, and headers
app.use(express.json());

mongoose.connect(dbUrl);

mongoose.connection.on('open', () => {
  console.log('Database connected successfully!');
});

mongoose.connection.on('error', (error) => {
  console.error('Database connection error:', error.message);
  process.exit(1);
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript!');
});

app.use('/api/users', authenticateJWT, Users);
app.use('/api/folders', authenticateJWT, folder);
app.use('/api/files', authenticateJWT, Files);
app.use('/api/auth', Auth);

app.listen(parseInt(port), () => {
  console.log(`Server running at http://localhost:${port}`);
});