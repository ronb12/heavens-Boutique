import type { NextRequest } from "next/server";
import { proxyPostToApi } from "@/lib/backendProxy";

export async function POST(req: NextRequest) {
  return proxyPostToApi(req, "auth/register");
}
