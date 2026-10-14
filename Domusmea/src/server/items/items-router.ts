import express, { Router } from 'express';
import { jsonErrors, validationError } from '../api-errors';
import { itemInputSchema } from './item-input';
import { ItemList } from '../../shared/item';
import { ItemRepository } from './item-repository';

/**
 * REST API for items, mounted at `/api/items`. `repository` is resolved per request so the database
 * is only opened when the API is used (not while the build loads `server.ts`).
 */
export function createItemsRouter(repository: () => ItemRepository, today: () => string): Router {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  router.get('/', (_req, res) => {
    const body: ItemList = { today: today(), items: repository().list() };
    res.json(body);
  });

  router.get('/:id', (req, res) => {
    const item = withId(req.params.id, (id) => repository().get(id));
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: 'not-found' });
    }
  });

  router.post('/', (req, res) => {
    const input = itemInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    res.status(201).json(repository().create(input.data));
  });

  router.put('/:id', (req, res) => {
    const input = itemInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(validationError(input.error));
      return;
    }
    const item = withId(req.params.id, (id) => repository().update(id, input.data));
    if (item) {
      res.json(item);
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

/** Calls `fn` with the numeric id, or returns `undefined` for ids that cannot exist. */
function withId<T>(param: string, fn: (id: number) => T): T | undefined {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? fn(id) : undefined;
}
