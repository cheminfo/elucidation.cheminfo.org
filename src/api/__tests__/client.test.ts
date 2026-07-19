import { afterEach, expect, test, vi } from 'vitest';

import {
  ApiError,
  cancelJob,
  getJobResult,
  getJobStatus,
  getQueueStats,
  submitJob,
} from '../client.ts';

interface StubCall {
  url: string;
  init?: RequestInit;
}

function stubFetch(
  responder: (call: StubCall) => { status?: number; body: unknown },
): StubCall[] {
  const calls: StubCall[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const { status = 200, body } = responder({ url, init });
    return Promise.resolve(
      Response.json(body, {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('submitJob posts to the same origin by default', async () => {
  const calls = stubFetch(() => ({
    body: { job_id: 'abc', task_id: 't1', status: 'submitted' },
  }));

  const response = await submitJob({
    mf: 'C9H6N4',
    spectrum: { x: [1, 2], y: [0, 1] },
    model: 'residual',
  });

  expect(response).toStrictEqual({
    job_id: 'abc',
    task_id: 't1',
    status: 'submitted',
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe('/submit');
  expect(calls[0]?.init?.method).toBe('POST');
  expect(JSON.parse(calls[0]?.init?.body as string)).toStrictEqual({
    mf: 'C9H6N4',
    spectrum: { x: [1, 2], y: [0, 1] },
    model: 'residual',
  });
});

test('an explicit base url is used verbatim', async () => {
  const calls = stubFetch(() => ({
    body: { job_id: 'a', task_id: 't', status: 'pending' },
  }));
  await getJobStatus('a', 'https://example.org');
  expect(calls[0]?.url).toBe('https://example.org/jobs/a/status');
});

test('a cached submission carries no task id', async () => {
  stubFetch(() => ({
    body: { job_id: 'abc', status: 'cached', message: 'Result already exists' },
  }));
  const response = await submitJob({ mf: 'C2H6O', spectrum: { x: [], y: [] } });

  expect(response.status).toBe('cached');
  expect(response.task_id).toBeUndefined();
});

test('a still-running result is surfaced as a 400 ApiError with the server detail', async () => {
  stubFetch(() => ({
    status: 400,
    body: { detail: 'Job not completed. Current status: PENDING' },
  }));

  await expect(getJobResult('abc')).rejects.toThrow(ApiError);
  await expect(getJobResult('abc')).rejects.toThrow(
    'Job not completed. Current status: PENDING',
  );
});

test('a forgotten job is surfaced as a 404 ApiError', async () => {
  stubFetch(() => ({ status: 404, body: { detail: 'Job not found' } }));

  await expect(getJobStatus('gone')).rejects.toMatchObject({
    name: 'ApiError',
    status: 404,
    message: 'Job not found',
  });
});

test('a non-JSON error body still produces a useful message', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response('<html>502</html>', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    ),
  );

  await expect(getQueueStats()).rejects.toThrow('HTTP 502 Bad Gateway');
});

test('a bare array result is normalized to a candidate list', async () => {
  // While the genetic algorithm runs, the cache file holds a bare array of candidates.
  stubFetch(() => ({ body: [{ smiles: 'CCO', score: 0.4 }] }));

  await expect(getJobResult('abc')).resolves.toStrictEqual([
    { smiles: 'CCO', score: 0.4 },
  ]);
});

test('an object result keeps its metadata, so nothing is lost when stored', async () => {
  // The payload is returned as received and stored verbatim; extractCandidates does
  // the unwrapping later, so the metadata survives in the run history.
  stubFetch(() => ({
    body: {
      results: [{ smiles: 'CCO', score: 0.4 }],
      metadata: { job_id: 'abc', processing_time: 1234 },
    },
  }));

  await expect(getJobResult('abc')).resolves.toStrictEqual({
    results: [{ smiles: 'CCO', score: 0.4 }],
    metadata: { job_id: 'abc', processing_time: 1234 },
  });
});

test('cancelJob issues a DELETE', async () => {
  const calls = stubFetch(() => ({
    body: { job_id: 'abc', status: 'cancelled' },
  }));
  await cancelJob('abc');

  expect(calls[0]?.url).toBe('/jobs/abc');
  expect(calls[0]?.init?.method).toBe('DELETE');
});
