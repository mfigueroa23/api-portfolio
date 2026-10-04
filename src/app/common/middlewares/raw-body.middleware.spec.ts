import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import request from 'supertest';
import {
  RAW_BODY_LIMIT_BYTES,
  RawBodyMiddleware,
  TOO_LARGE,
} from './raw-body.middleware.js';

// Echoes what the middleware left in req.body once next() is called.
function createEchoServer(): Server {
  const middleware = new RawBodyMiddleware();
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const typed = req as IncomingMessage & { body?: unknown };
    middleware.use(typed as never, res as never, () => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          tooLarge: typed.body === TOO_LARGE,
          isBuffer: Buffer.isBuffer(typed.body),
          size: Buffer.isBuffer(typed.body) ? typed.body.length : null,
          first: Buffer.isBuffer(typed.body) ? typed.body[0] : null,
        }),
      );
    });
  });
}

describe('RawBodyMiddleware', () => {
  const server = createEchoServer();

  it('limits uploads to 10 MiB', () => {
    expect(RAW_BODY_LIMIT_BYTES).toBe(10 * 1024 * 1024);
  });

  it('buffers the raw bytes whatever the content type says', async () => {
    const response = await request(server)
      .post('/files')
      .set('content-type', 'text/plain')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(response.body).toEqual({
      tooLarge: false,
      isBuffer: true,
      size: 4,
      first: 0x89,
    });
  });

  it('gives an empty buffer for an empty body', async () => {
    const response = await request(server).post('/files');

    expect(response.body).toMatchObject({ isBuffer: true, size: 0 });
  });

  it('accepts a body of exactly 10 MiB', async () => {
    const response = await request(server)
      .post('/files')
      .set('content-type', 'application/octet-stream')
      .send(Buffer.alloc(RAW_BODY_LIMIT_BYTES, 1));

    expect(response.body).toMatchObject({
      isBuffer: true,
      size: RAW_BODY_LIMIT_BYTES,
    });
  });

  it('marks a larger body as too large and still drains it to answer', async () => {
    const response = await request(server)
      .post('/files')
      .set('content-type', 'application/octet-stream')
      .send(Buffer.alloc(RAW_BODY_LIMIT_BYTES + 2 * 1024 * 1024, 1));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tooLarge: true,
      isBuffer: false,
      size: null,
      first: null,
    });
  });
});
