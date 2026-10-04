import { Prisma } from '../../src/generated/prisma/client.js';

// In-memory stand-in for PrismaService used by the e2e tests (plan D13): CI has
// no PostgreSQL, so it implements only the subset of the Prisma API the app uses.

type Row = Record<string, any>;
type Where = Record<string, unknown>;
type OrderBy = Record<string, 'asc' | 'desc'>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (condition instanceof Object && 'lt' in condition) {
      return row[field] < (condition as { lt: unknown }).lt;
    }
    return row[field] === condition;
  });
}

function compare(a: Row, b: Row, orderBy: OrderBy[]): number {
  for (const order of orderBy) {
    const [field, direction] = Object.entries(order)[0];
    if (a[field] === b[field]) continue;
    const result = a[field] < b[field] ? -1 : 1;
    return direction === 'desc' ? -result : result;
  }
  return 0;
}

function notFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found.', {
    code: 'P2025',
    clientVersion: Prisma.prismaVersion.client,
  });
}

export class FakeModel<T extends Row = Row> {
  rows: T[] = [];
  private nextId = 1;

  constructor(
    // Field used by update/delete and findUnique when `where` holds it.
    private readonly idField = 'id',
    private readonly timestamps: ('createdAt' | 'updatedAt')[] = [
      'createdAt',
      'updatedAt',
    ],
  ) {}

  findMany(args: { where?: Where; orderBy?: OrderBy | OrderBy[] } = {}) {
    const orderBy = [args.orderBy ?? []].flat();
    const rows = this.rows
      .filter((row) => matches(row, args.where))
      .sort((a, b) => compare(a, b, orderBy));
    return Promise.resolve(rows.map((row) => ({ ...row })));
  }

  findUnique(args: { where: Where }) {
    const row = this.rows.find((candidate) => matches(candidate, args.where));
    return Promise.resolve(row ? { ...row } : null);
  }

  create(args: { data: Row }) {
    const now = new Date();
    const row = { ...args.data } as Row;
    if (this.idField === 'id' && row.id === undefined) row.id = this.nextId++;
    for (const field of this.timestamps) row[field] = now;
    this.rows.push(row as T);
    return Promise.resolve({ ...row } as T);
  }

  update(args: { where: Where; data: Row }) {
    const row = this.rows.find((candidate) => matches(candidate, args.where));
    if (!row) return Promise.reject(notFound());
    Object.assign(row, args.data);
    if (this.timestamps.includes('updatedAt')) {
      (row as Row).updatedAt = new Date();
    }
    return Promise.resolve({ ...row });
  }

  delete(args: { where: Where }) {
    const index = this.rows.findIndex((row) => matches(row, args.where));
    if (index === -1) return Promise.reject(notFound());
    const [row] = this.rows.splice(index, 1);
    return Promise.resolve({ ...row });
  }

  count(args: { where?: Where } = {}) {
    return Promise.resolve(
      this.rows.filter((row) => matches(row, args.where)).length,
    );
  }

  deleteMany(args: { where?: Where } = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, args.where));
    return Promise.resolve({ count: before - this.rows.length });
  }
}

export class PrismaFake {
  property = new FakeModel('key');
  rateLimitHit = new FakeModel('id', ['createdAt']);
  experience = new FakeModel();
  project = new FakeModel();
  testimonial = new FakeModel();
  highlight = new FakeModel();
  socialLink = new FakeModel();
  technology = new FakeModel();
  contactInfo = new FakeModel();
  corsOrigin = new FakeModel();

  $connect(): Promise<void> {
    return Promise.resolve();
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }

  // Interactive transactions run directly: the fake is single-threaded, so
  // there is nothing to isolate.
  $transaction<R>(fn: (tx: this) => Promise<R>): Promise<R> {
    return fn(this);
  }
}
