import { NextResponse } from "next/server";
import clientPromise from "@/lib/db";

export async function GET() {
  try {
    const client = await clientPromise;
    // "ping" is the cheapest possible way to confirm a live connection
    await client.db("admin").command({ ping: 1 });
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (error) {
    console.error("Health check DB error:", error);
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 500 }
    );
  }
}