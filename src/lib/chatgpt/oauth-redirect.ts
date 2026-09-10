/** OAuth may navigate to a public HTTPS client or a native loopback listener. */
export function isImportOAuthRedirect(value: string): boolean {
  try {
    if (value.length > 2048) return false;
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}
