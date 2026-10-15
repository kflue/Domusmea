import express, { Router } from 'express';
import { jsonErrors, validationError } from '../api-errors';
import { withId } from '../route-params';
import { subscriptionInputSchema } from './subscription-input';
import { SubscriptionRepository } from './subscription-repository';
import { SubscriptionInput } from '../../shared/subscription';

/**
 * REST API for subscriptions, mounted at `/api/subscriptions`. `repository` is resolved per request
 * so the database is only opened when the API is used.
 */
export function createSubscriptionsRouter(repository: () => SubscriptionRepository): Router {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  /** The validated body, or `undefined` after answering with a 400. */
  const parseInput = (body: unknown, res: express.Response): SubscriptionInput | undefined => {
    const input = subscriptionInputSchema.safeParse(body);
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
    const subscription = withId(req.params.id, (id) => repository().get(id));
    if (subscription) {
      res.json(subscription);
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
    const subscription = withId(req.params.id, (id) => repository().update(id, input));
    if (subscription) {
      res.json(subscription);
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
