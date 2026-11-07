// A problem the person can fix (bad input, duplicate SKU...). Routes turn it into a 400 with this message.
export class DataError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 400) {
    super(message);
  }
}

/** Runs a data call for an API route: DataError → JSON error response; anything else is re-thrown. */
export async function respond<T>(fn: () => Promise<T>, ok: (value: T) => Response): Promise<Response> {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof DataError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export const notFoundResponse = (what = "Not found.") => Response.json({ error: what }, { status: 404 });
