import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_GRAPHQL_URL ?? "http://localhost:8080/graphql";
  const authorization = request.headers.get("authorization");

  try {
    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: await request.text(),
      cache: "no-store",
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { errors: [{ message: "No se pudo conectar con el servicio GraphQL." }] },
      { status: 502 },
    );
  }
}