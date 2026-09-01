export type GraphQLResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

export async function graphQLRequest<T>(api: string, token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${api}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json() as GraphQLResponse<T>;
  if (!response.ok || body.errors?.length || !body.data) {
    throw new Error(body.errors?.[0]?.message ?? `GraphQL request failed (${response.status})`);
  }
  return body.data;
}

export const PRODUCT_QUERY = `query Products($pageSize: Int, $status: ProductStatus) {
  products(pageSize: $pageSize, status: $status) {
    products { id sku name description priceMinor currency status }
    nextPageToken
  }
}`;

