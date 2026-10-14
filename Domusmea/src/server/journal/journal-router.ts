import express, { Router } from 'express';
import { jsonErrors, validationError } from '../api-errors';
import { withId } from '../route-params';
import { journalEntryInputSchema } from './journal-input';
import { JournalRepository } from './journal-repository';
import { JournalEntryInput } from '../../shared/journal';

/** Body of a 400 response for an entry that refers to an item that does not exist. */
const UNKNOWN_ITEM = { error: 'invalid', fields: { itemId: ['Unknown item'] } };

/**
 * REST API for the journal of repairs and investments, mounted at `/api/journal`. `repository` is
 * resolved per request so the database is only opened when the API is used.
 */
export function createJournalRouter(repository: () => JournalRepository): Router {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  /** The validated body, or `undefined` after answering with a 400. */
  const parseInput = (body: unknown, res: express.Response): JournalEntryInput | undefined => {
    const input = journalEntryInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return undefined;
    }
    if (input.data.itemId !== null && !repository().itemExists(input.data.itemId)) {
      res.status(400).json(UNKNOWN_ITEM);
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
    const input = parseInput(req.body, res);
    if (input) {
      res.status(201).json(repository().create(input));
    }
  });

  router.put('/:id', (req, res) => {
    const input = parseInput(req.body, res);
    if (!input) {
      return;
    }
    const entry = withId(req.params.id, (id) => repository().update(id, input));
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
