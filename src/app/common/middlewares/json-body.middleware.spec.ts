import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import request from 'supertest';
import { JsonBodyMiddleware } from './json-body.middleware.js';

// A bare node:http server keeps the test focused on the middleware: it echoes
// whatever ended up in req.body once next() is called.
function createEchoServer(): Server {
  const middleware = new JsonBodyMiddleware();
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const typed = req as IncomingMessage & { body?: unknown };
    middleware.use(typed as never, res as never, () => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          defined: typed.body !== undefined,
          body: typed.body ?? null,
        }),
      );
    });
  });
}

describe('JsonBodyMiddleware', () => {
  const server = createEchoServer();

  it('parses a JSON object body', async () => {
    const response = await request(server)
      .post('/')
      .set('content-type', 'application/json; charset=utf-8')
      .send('{"name":"Ada"}');

    expect(response.body).toEqual({ defined: true, body: { name: 'Ada' } });
  });

  it('leaves the body undefined and continues on malformed JSON', async () => {
    const response = await request(server)
      .post('/')
      .set('content-type', 'application/json')
      .send('{"name":');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ defined: false, body: null });
  });

  it('rejects JSON primitives like express.json strict mode does', async () => {
    const response = await request(server)
      .post('/')
      .set('content-type', 'application/json')
      .send('"text"');

    expect(response.body).toEqual({ defined: false, body: null });
  });

  it('leaves the body undefined when it exceeds 16kb', async () => {
    const response = await request(server)
      .post('/')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(17 * 1024) }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ defined: false, body: null });
  });

  it('accepts a body right below the 16kb limit', async () => {
    const message = 'x'.repeat(16 * 1024 - 20);
    const response = await request(server)
      .post('/')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ message }));

    expect(response.body).toEqual({ defined: true, body: { message } });
  });

  it('ignores requests that are not JSON', async () => {
    const response = await request(server)
      .post('/')
      .set('content-type', 'text/plain')
      .send('{"name":"Ada"}');

    expect(response.body).toEqual({ defined: false, body: null });
  });
});
