import app from '../src/app';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Export the Express app as a Vercel serverless function
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};