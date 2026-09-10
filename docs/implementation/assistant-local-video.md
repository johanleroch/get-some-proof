# Local assistant video transfer

Implementation checkpoint for #115. This command has not yet certified a real Claude or Codex MCP connection.

1. Import the testimonial as `type: "video"` with its real identity, optional original text and stable source ID. Omit `videoUrl` for a local file. It is saved in Pending with a missing video.
2. Call `create_assistant_video_upload` with the returned job/item IDs, a new stable request ID, the actual file byte count and MP4/MOV/WebM MIME type. Keep the returned capability private.
3. With Node 24 or later, run the repository command and pass the capability object through standard input:

   ```sh
   node scripts/upload-assistant-video.mjs /absolute/path/customer-video.mp4 < private-capability.json
   ```

   If a temporary capability file is needed, restrict it to the current user and delete it after transfer. Never commit it or place its contents in a chat response, process arguments, issue or log. The command sends binary slices directly to the scoped HTTPS endpoint; no bytes or local paths are sent as MCP JSON.

4. `complete` means all bytes were acknowledged. `finalizing` means the final response is uncertain; stop sending bytes. Call `read_assistant_import` until it reports Ready or an actionable failure. Do not claim a referenced or uploaded file is already playable.
5. After an interrupted non-final transfer, request the capability again with the same request ID and exact file metadata. Use the returned offset with the same original file. Expired or rejected transfers require a new capability for the failed item.

The maximum is 512 MiB and 600 seconds. Mux validates duration before Ready. A client without file execution can open `/org/ORGANIZATION_SLUG/inbox?import=JOB_ID` and use Choose video file on its missing video. New transfers require Pro; accepted work can finish while its reservation remains valid.
