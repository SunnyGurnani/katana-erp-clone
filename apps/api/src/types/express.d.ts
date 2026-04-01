import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requestId middleware */
    id?: string;
  }
}
