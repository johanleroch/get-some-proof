/** Synthetic version of the public keyed-card / Flight-reference / DOM-control relationship. */
export function withTestimonialIds(html: string, ids?: string[]) {
  const wrappers: unknown[] = [];
  const records: string[] = [];
  let position = 0;
  const visible = html.replace(
    /<(article|div)([^>]*class="[^"]*\btext-testimonial\b[^"]*"[^>]*)>/g,
    (opening) => {
      const index = position++;
      const recordId = (index + 100).toString(16);
      const controlId = `_S_fixture_${index}_`;
      wrappers.push([
        "$",
        "div",
        `${ids?.[index] ?? `proof-${index}`}-${index}`,
        { children: `$L${recordId}` },
      ]);
      records.push(
        `${recordId}:${JSON.stringify([
          "$",
          "div",
          null,
          {
            className: "testimonial-card text-testimonial",
            children: [
              "$",
              "input",
              null,
              { id: controlId, className: "show-more-toggle" },
            ],
          },
        ])}\n`,
      );
      return `${opening}<input id="${controlId}" class="show-more-toggle" type="checkbox">`;
    },
  );
  const flight = `0:${JSON.stringify(wrappers)}\n${records.join("")}`;
  return `${visible}<script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`;
}
