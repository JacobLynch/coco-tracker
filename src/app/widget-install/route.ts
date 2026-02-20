import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    `${url.protocol}//${url.host}`;

  const loaderScript = [
    "// Coco Capital — Always loads the latest widget from the server.",
    `const req = new Request("${baseUrl}/widget.js")`,
    "const code = await req.loadString()",
    "eval(code)",
  ].join("\n");

  const scriptableFile = {
    always_run_in_app: false,
    icon: {
      color: "deep-green",
      glyph: "chart-line",
    },
    name: "Coco Capital",
    script: loaderScript,
    share_sheet_inputs: [],
  };

  return new NextResponse(JSON.stringify(scriptableFile), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Coco Capital.scriptable"',
    },
  });
}
