export function studioChoosingFromUrl(searchParams: {
  getAll: (name: string) => string[];
}) {
  const requested = searchParams.getAll("create");
  return requested.length === 1 && requested[0] === "widget";
}

export function setStudioChoosingFilter(choosing: boolean) {
  const url = new URL(window.location.href);
  if (choosing) url.searchParams.set("create", "widget");
  else url.searchParams.delete("create");
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
