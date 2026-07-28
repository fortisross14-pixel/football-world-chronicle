import { neon } from "@neondatabase/serverless";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured in Vercel.");
    }

    const saveKey = request.query?.saveKey;

    if (typeof saveKey !== "string" || saveKey.length < 16) {
      return response.status(400).json({
        ok: false,
        error: "Invalid save key.",
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      select
        save_name,
        current_season,
        game_data,
        updated_at
      from cloud_saves
      where save_key = ${saveKey}
      limit 1
    `;

    if (rows.length === 0) {
      return response.status(404).json({
        ok: false,
        error: "No cloud save was found.",
      });
    }

    return response.status(200).json({
      ok: true,
      save: rows[0],
    });
  } catch (error) {
    console.error("Cloud load failed:", error);

    return response.status(500).json({
      ok: false,
      error: "Cloud load failed.",
    });
  }
}