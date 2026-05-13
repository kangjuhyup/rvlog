export type FetchResponse = {
  ok: boolean;
  status: number;
};

export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponse>;

export async function postJson(
  fetcher: FetchLike,
  url: string,
  body: unknown,
  errorLabel: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${errorLabel} failed with status ${response.status}`);
  }
}
