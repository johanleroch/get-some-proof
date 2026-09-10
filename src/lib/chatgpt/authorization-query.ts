export function authorizationQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value))
      for (const item of value) result.append(key, item);
    else if (value !== undefined) result.append(key, value);
  }
  return result.toString();
}
