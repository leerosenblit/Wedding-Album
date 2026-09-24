import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './concurrency';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runWithConcurrency', () => {
  it('never runs more than `limit` tasks at once and preserves order', async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return i;
    });

    const results = await runWithConcurrency(tasks, 2);
    expect(peak).toBe(2);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : -1))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('keeps going after a failure and reports it as rejected', async () => {
    const results = await runWithConcurrency(
      [
        async () => 'a',
        async () => {
          throw new Error('nope');
        },
        async () => 'c',
      ],
      2,
    );
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });

  it('starts the next task as soon as one finishes', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const started: number[] = [];
    const tasks = [
      () => {
        started.push(0);
        return first.promise;
      },
      () => {
        started.push(1);
        return second.promise;
      },
      async () => {
        started.push(2);
      },
    ];
    const run = runWithConcurrency(tasks, 2);
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toEqual([0, 1]);

    second.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toEqual([0, 1, 2]);

    first.resolve();
    await run;
  });

  it('handles an empty task list', async () => {
    await expect(runWithConcurrency([], 2)).resolves.toEqual([]);
  });
});
