import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

export async function POST(req: NextRequest) {
  if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_API_KEY)) {
    return NextResponse.json(
      { error: "Pinata credentials not configured on server" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PINATA_JWT
          ? { Authorization: `Bearer ${PINATA_JWT}` }
          : {
              pinata_api_key: PINATA_API_KEY as string,
              pinata_secret_api_key: PINATA_SECRET_API_KEY as string,
            }),
      },
      body: JSON.stringify({
        pinataContent: body,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Pinata error ${res.status}`, details: text },
        { status: 502 },
      );
    }

    const data = JSON.parse(text) as { IpfsHash?: string };
    if (!data.IpfsHash) {
      return NextResponse.json(
        { error: "Pinata response missing IpfsHash" },
        { status: 502 },
      );
    }

    return NextResponse.json({ cid: data.IpfsHash });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

