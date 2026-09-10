export type ImportAssistant = "claude" | "codex";

export function assistantConnectionCommands(
  assistant: ImportAssistant,
  origin: string,
) {
  const endpoint = new URL("/mcp", origin).href;
  // Only a configured HTTP(S) origin enters these commands; never credentials.
  if (!/^https?:\/\/[^\s'"`$\\]+$/.test(endpoint))
    throw new Error("Invalid MCP origin.");
  return assistant === "claude"
    ? `claude mcp add --transport http get-some-proof ${endpoint}\nclaude mcp login get-some-proof`
    : `codex mcp add get-some-proof --url ${endpoint}\ncodex mcp login get-some-proof --scopes testimonials:import:assistant,offline_access`;
}

export const assistantMigrationInstructions = `Import the testimonials from this one page: [PAGE URL].
Use my connected Get Some Proof account. Read the available Projects; ask me to choose if more than one is available.
Collect the testimonials yourself from the supplied page. Get Some Proof does not scrape the page or call an AI service. If you cannot read it, ask me for the page content instead of guessing.
Keep the original text, author name, role, company, individual rating and portrait when explicitly present. Preserve source URLs and stable source identities. Do not rewrite, invent missing information, use an aggregate rating, or substitute a video thumbnail for a portrait.
Use import_testimonials in batches of at most 50 within 500 KB. Keep a stable migration ID and discovered count for the page, and a stable request ID per batch. Retry an uncertain batch with exactly the same payload and request ID. Save directly as Pending in the Inbox. Do not publish.
For video, supply a public URL that points to the actual video file. Each video must be at most 10 minutes and 512 MB. Photos and videos are copied in the background. A page URL is not a video file URL.
For a local video, use create_assistant_video_upload. If this environment can read the file and run Node 24+, download transferHelperUrl and run the helper with the file path, passing the private capability JSON through stdin. Never put file bytes, local paths or credentials into MCP JSON. Keep temporary capability files private and remove them after transfer. Otherwise give me the Inbox link to choose the file there.
yt-dlp is optional only where it is already available or I explicitly choose to install it and the source permits access. Do not promise automatic installation or extraction of protected media.
Read import and migration progress. Report exact saved, skipped, failed, remaining and media states with the Inbox link. Processing or transferred bytes do not mean Ready. If video capacity is insufficient, show the failed videos and ask me which ones to resume within the available capacity. Preserve successful records and copied media.`;
