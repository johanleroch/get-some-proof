import { publicWallResponse } from "@/lib/public-wall-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicSlug: string }> },
) {
  return publicWallResponse(request, context);
}
