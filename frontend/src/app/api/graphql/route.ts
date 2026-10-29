import { NextRequest, NextResponse } from "next/server";

const hopByHopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
];

function getForwardableHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  const connectionTokens = headers.get("connection")
    ?.split(",")
    .map((header) => header.trim().toLowerCase()) ?? [];

  for (const header of [...hopByHopHeaders, ...connectionTokens]) {
    headers.delete(header);
  }
  return headers;
}

export async function POST(request: NextRequest) {
    const backendUrl = process.env.BACKEND_GRAPHQL_URL ?? "http://127.0.0.1:8080/graphql";
  try {
    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers: getForwardableHeaders(request.headers),
      body: await request.arrayBuffer(),
      cache: "no-store",
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: getForwardableHeaders(upstream.headers),
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: "No se pudo conectar con el servicio GraphQL." }] },
      { status: 502 },
    );
  }
}