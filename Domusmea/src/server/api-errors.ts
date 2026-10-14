import { ErrorRequestHandler } from 'express';
import { z } from 'zod';

/** Body of a 400 response for input that failed validation, with messages per field. */
export function validationError(error: z.ZodError) {
  return { error: 'invalid', fields: z.flattenError(error).fieldErrors };
}

/** JSON errors without stack traces (Express' default handler sends HTML with stacks in dev). */
export const jsonErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = typeof error?.status === 'number' && error.status < 500 ? error.status : 500;
  if (status === 500) {
    console.error('API error', error);
  }
  res.status(status).json({ error: status === 500 ? 'internal' : 'bad-request' });
};
