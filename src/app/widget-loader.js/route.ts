import { NextResponse } from "next/server";

const LOADER_SCRIPT = `
// Coco Capital — Bootstrap Loader
// This always fetches the latest widget from the server.

const BASE_URL = "{{BASE_URL}}";
const req = new Request(BASE_URL + "/widget.js");
const code = await req.loadString();
eval(code);
`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    `${url.protocol}//${url.host}`;

  const script = LOADER_SCRIPT.replace(/\{\{BASE_URL}}/g, baseUrl);

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
