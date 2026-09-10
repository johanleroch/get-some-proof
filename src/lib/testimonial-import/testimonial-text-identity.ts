/** Correlate visible show-more controls with Testimonial.to's keyed RSC cards. */
export function testimonialTextIdentities(flight: string) {
  const records = new Map<string, unknown>();
  const serialized = new Map<string, string>();
  for (const line of flight.split("\n")) {
    const separator = line.indexOf(":");
    const id = /([a-f0-9]+)$/.exec(line.slice(0, separator))?.[1];
    if (separator < 0 || !id) continue;
    try {
      const json = line.slice(separator + 1);
      const parsed: unknown = JSON.parse(json);
      if (serialized.has(id) && serialized.get(id) !== json) {
        records.set(id, null);
      } else {
        serialized.set(id, json);
        if (!records.has(id)) records.set(id, parsed);
      }
    } catch {
      /* Non-JSON Flight records are never executed. */
    }
  }
  const identities = new Map<string, string | null>();
  const controlsByRecord = new Map<string, string[]>();
  const pending = [...records.values()];
  while (pending.length) {
    const value = pending.pop();
    if (!Array.isArray(value)) {
      if (value && typeof value === "object")
        pending.push(...Object.values(value));
      continue;
    }
    pending.push(...value);
    if (value[0] !== "$" || value[1] !== "div" || typeof value[2] !== "string")
      continue;
    const sourceId = /^([a-zA-Z0-9_-]{1,200})-\d+$/.exec(value[2])?.[1];
    const reference =
      typeof value[3]?.children === "string"
        ? /^\$L?([a-f0-9]+)$/.exec(value[3].children)?.[1]
        : undefined;
    if (!sourceId || !reference) continue;
    const card = records.get(reference);
    if (
      !Array.isArray(card) ||
      typeof card[3]?.className !== "string" ||
      !card[3].className.split(/\s+/).includes("text-testimonial")
    )
      continue;
    let controls = controlsByRecord.get(reference);
    if (!controls) {
      controls = [];
      const children: unknown[] = [card];
      while (children.length) {
        const child = children.pop();
        if (Array.isArray(child)) {
          children.push(...child);
          const props = child[3];
          if (
            child[0] === "$" &&
            child[1] === "input" &&
            typeof props?.id === "string" &&
            typeof props.className === "string" &&
            props.className.split(/\s+/).includes("show-more-toggle")
          ) {
            controls.push(props.id);
          }
        } else if (child && typeof child === "object")
          children.push(...Object.values(child));
      }
      controlsByRecord.set(reference, controls);
    }
    for (const control of controls) {
      const previous = identities.get(control);
      identities.set(
        control,
        previous === undefined || previous === sourceId ? sourceId : null,
      );
    }
  }
  return identities;
}
