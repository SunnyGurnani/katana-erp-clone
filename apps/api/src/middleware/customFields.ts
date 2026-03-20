import { Request, Response, NextFunction } from 'express';
import { enrichWithCustomFields } from '../routes/customFields';

/**
 * Factory: returns middleware that enriches a single entity GET response
 * with its custom field values. Wraps res.json to intercept the response.
 *
 * Usage: router.get('/:id', withCustomFields('product'), async (req, res) => { ... })
 */
export function withCustomFields(entityType: string): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (body && typeof body === 'object' && !Array.isArray(body) && body.id && !body.data) {
        // Async enrich — fire and forget, attach immediately
        enrichWithCustomFields(entityType, body.id)
          .then(customFields => {
            if (Object.keys(customFields).length > 0) {
              body.customFields = customFields;
            }
            return originalJson(body);
          })
          .catch(() => originalJson(body));
        return res;
      }
      return originalJson(body);
    };
    next();
  };
}
