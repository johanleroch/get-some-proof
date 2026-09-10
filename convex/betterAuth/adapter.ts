import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "../auth";
import { createImportOAuthOptions } from "../importOAuthOptions";
import schema from "./schema";

// Schema metadata only: both HTTP instances share this component but retain
// separate endpoints and token audiences. No OAuth endpoint is mounted here.
export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, (ctx) => {
  const website = createAuthOptions(ctx);
  const oauth = createImportOAuthOptions({
    siteUrl: "https://schema-metadata.invalid",
    secret: "schema-metadata-only-not-a-runtime-credential",
    database: website.database,
  });
  return { ...website, plugins: [...website.plugins, ...oauth.plugins] };
});
