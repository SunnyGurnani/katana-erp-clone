import { Request } from 'express';

export function getPagination(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(250, Math.max(1, parseInt((req.query.limit || req.query.pageSize) as string) || 20));
  const skip = (page - 1) * limit;
  return { page, pageSize: limit, skip, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    data: items,
    meta: { total, page, pageSize, hasNext: page * pageSize < total, totalPages: Math.ceil(total / pageSize) },
  };
}
