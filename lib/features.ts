export type FeatureFlags = Record<string, boolean>;

const defaults: FeatureFlags = {
  graphql_checkout: true,
  admin_dashboard_v2: true,
  mobile_cart_v2: true,
};

export async function loadFeatureFlags(api: string, token: string): Promise<FeatureFlags> {
  try {
    const response = await fetch(`${api}/config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return defaults;
    const body = (await response.json()) as { flags?: FeatureFlags };
    return { ...defaults, ...(body.flags ?? {}) };
  } catch {
    return defaults;
  }
}
