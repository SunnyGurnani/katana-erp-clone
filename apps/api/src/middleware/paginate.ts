import { Request } from 'express';

export function getPagination(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(250, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, hasNext: page * pageSize < total };
}
