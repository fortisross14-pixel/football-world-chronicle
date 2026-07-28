import { neon } from "@neondatabase/serverless";

const MAX_SAVE_BYTES = 15 * 1024 * 1024;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured in Vercel.");
    }

    const { saveKey, saveName, currentSeason, gameData } = request.body ?? {};

    if (
      typeof saveKey !== "string" ||
      saveKey.length < 16 ||
      !gameData ||
      typeof gameData !== "object"
    ) {
      return response.status(400).json({
        ok: false,
        error: "Invalid save data.",
      });
    }

    const serialized = JSON.stringify(gameData);

    if (Buffer.byteLength(serialized, "utf8") > MAX_SAVE_BYTES) {
      return response.status(413).json({
        ok: false,
        error: "The save file is too large.",
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      insert into cloud_saves (
        save_key,
        save_name,
        current_season,
        game_data,
        updated_at
      )
      values (
        ${saveKey},
        ${saveName || "Main Universe"},
        ${Number.isInteger(currentSeason) ? currentSeason : null},
        ${serialized}::jsonb,
        now()
      )
      on conflict (save_key)
      do update set
        save_name = excluded.save_name,
        current_season = excluded.current_season,
        game_data = excluded.game_data,
        updated_at = now()
      returning
        save_name,
        current_season,
        updated_at
    `;

    return response.status(200).json({
      ok: true,
      save: rows[0],
    });
  } catch (error) {
    console.error("Cloud save failed:", error);

    return response.status(500).json({
      ok: false,
      error: "Cloud save failed.",
    });
  }
}