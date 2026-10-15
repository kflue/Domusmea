import express, { Router } from 'express';
import { z } from 'zod';
import { jsonErrors, validationError } from '../api-errors';
import { withId } from '../route-params';
import { utilityBillInputSchema, utilityEntryInputSchema } from './utility-input';
import { UtilityRepository } from './utility-repository';

/**
 * REST API for utility bills, mounted at `/api/utilities` (ADR 0011). `POST` takes a whole bill and
 * creates one entry per line; the other routes work on single entries. `repository` is resolved per
 * request so the database is only opened when the API is used.
 */
export function createUtilitiesRouter(repository: () => UtilityRepository): Router {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  /** The validated body, or `undefined` after answering with a 400. */
  const parse = <T>(schema: z.ZodType<T>, body: unknown, res: express.Response): T | undefined => {
    const input = schema.safeParse(body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return undefined;
    }
    return input.data;
  };

  router.get('/', (_req, res) => {
    res.json(repository().list());
  });

  router.get('/:id', (req, res) => {
    const entry = withId(req.params.id, (id) => repository().get(id));
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'not-found' });
    }
  });

  router.post('/', (req, res) => {
    const bill = parse(utilityBillInputSchema, req.body, res);
    if (bill) {
      res.status(201).json(repository().createBill(bill));
    }
  });

  router.put('/:id', (req, res) => {
    const input = parse(utilityEntryInputSchema, req.body, res);
    if (!input) {
      return;
    }
    const stored = withId(req.params.id, (id) => repository().get(id));
    if (stored && stored.commodity !== input.commodity) {
      // A bill has one entry per commodity (ADR 0011); a wrong one is deleted and entered again.
      res.status(400).json({ error: 'invalid', fields: { commodity: ['Cannot be changed'] } });
      return;
    }
    const entry = stored && repository().update(stored.id, input);
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'not-found' });
    }
  });

  router.delete('/:id', (req, res) => {
    const deleted = withId(req.params.id, (id) => repository().delete(id));
    res.status(deleted ? 204 : 404).end();
  });

  router.use(jsonErrors);
  return router;
}
