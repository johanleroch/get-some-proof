export function backupSlug(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(slug)
    ? slug
    : fallback;
}
export function nameBackupMedia(data: {
  organization: { _id: string; publicSlug: string };
  testimonials: Array<{ _id: string; [key: string]: unknown }>;
  media: Array<{ ownerId: string; path: string; kind: string; role?: string }>;
}) {
  const owners = new Map<string, string>();
  const used = new Set<string>();
  for (const [index, item] of data.testimonials.entries()) {
    const base = backupSlug(
      String(item.submitterName ?? ""),
      `testimonial-${index + 1}`,
    );
    let name = base;
    let suffix = 2;
    while (used.has(name)) name = `${base}-${suffix++}`;
    used.add(name);
    owners.set(item._id, name);
  }
  const counts = new Map<string, number>();
  for (const item of data.media) {
    const name =
      owners.get(item.ownerId) ??
      `brand-${backupSlug(data.organization.publicSlug, "logo")}`;
    const extension =
      item.path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "bin";
    const role =
      item.kind === "video"
        ? "video"
        : /\/avatar(?:\.|$)/.test(item.path)
          ? "avatar"
          : /\/thumbnail(?:\.|$)/.test(item.path)
            ? "thumbnail"
            : /\/logo(?:\.|$)/.test(item.path)
              ? "logo"
              : "image";
    item.role = role;
    const key = `${name}/${role}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    item.path =
      role === "video"
        ? `videos/${name}${count > 1 ? `-${count}` : ""}.${extension}`
        : `images/${name}/${role}${role === "image" || count > 1 ? `-${count}` : ""}.${extension}`;
  }
}
