import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "floodsense_session";
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path.every((p) => /^[a-zA-Z0-9-]+$/.test(p)))
    return NextResponse.json({ message: "Invalid endpoint" }, { status: 400 });
  const endpoint = path.join("/");
  const writable = req.method !== "GET";
  if (writable && req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { message: "Same-origin request required" },
      { status: 403 },
    );
  const base = process.env.BACKEND_URL;
  if (!base)
    return NextResponse.json(
      {
        message:
          "Backend not configured. Set BACKEND_URL on the frontend server.",
      },
      { status: 503 },
    );
  try {
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Invalid backend URL");
    url.pathname = `${url.pathname.replace(/\/$/, "")}/api/${endpoint}`;
    url.search = "";
    url.hash = "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = req.cookies.get(cookieName)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
    const body = writable ? await req.text() : undefined;
    if (body && Buffer.byteLength(body) > 16384)
      return NextResponse.json(
        { message: "Request too large" },
        { status: 413 },
      );
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const data = upstream.status === 204 ? null : await upstream.json();
    const sessionToken = data?.token;
    if (data && typeof data === "object") delete data.token;
    const response =
      upstream.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    if (
      upstream.ok &&
      ["auth/login", "auth/register"].includes(endpoint) &&
      typeof sessionToken === "string"
    )
      response.cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 3600,
      });
    if (endpoint === "auth/logout" || upstream.status === 401)
      response.cookies.delete(cookieName);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Backend unreachable. Please retry later." },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
