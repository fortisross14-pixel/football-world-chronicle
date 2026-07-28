import { neon } from '@neondatabase/serverless';

const MAX_LEGACY_SAVE_BYTES = 4 * 1024 * 1024;
const MAX_CHUNK_BYTES = 850 * 1024;

function validKey(value) {
  return typeof value === 'string' && value.length >= 12;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured in Vercel.');
    const sql = neon(process.env.DATABASE_URL);
    const body = request.body ?? {};
    const { saveKey, saveName, currentSeason } = body;
    if (!validKey(saveKey)) return response.status(400).json({ ok: false, error: 'Invalid cloud code.' });

    // v0.4 uses small sequential chunks so large, long-running universes stay
    // below serverless request/response limits. No additional Neon table is needed.
    if (Number.isInteger(body.chunkIndex) && Number.isInteger(body.totalChunks)) {
      const {
        uploadId,
        chunkIndex,
        totalChunks,
        chunk,
        format,
        originalBytes,
        compressedBytes
      } = body;
      if (
        typeof uploadId !== 'string' || uploadId.length < 8 ||
        totalChunks < 1 || totalChunks > 100 ||
        chunkIndex < 0 || chunkIndex >= totalChunks ||
        typeof chunk !== 'string' ||
        typeof format !== 'string'
      ) {
        return response.status(400).json({ ok: false, error: 'Invalid cloud-save chunk.' });
      }
      if (Buffer.byteLength(chunk, 'utf8') > MAX_CHUNK_BYTES) {
        return response.status(413).json({ ok: false, error: 'A cloud-save chunk is too large.' });
      }

      const chunkKey = `chunk_${chunkIndex}`;
      let rows;
      if (chunkIndex === 0) {
        const gameData = JSON.stringify({
          format,
          uploadId,
          totalChunks,
          originalBytes: Number(originalBytes) || null,
          compressedBytes: Number(compressedBytes) || null,
          [chunkKey]: chunk
        });
        rows = await sql`
          insert into cloud_saves (save_key, save_name, current_season, game_data, updated_at)
          values (
            ${saveKey},
            ${saveName || 'Main Universe'},
            ${Number.isInteger(currentSeason) ? currentSeason : null},
            ${gameData}::jsonb,
            now()
          )
          on conflict (save_key)
          do update set
            save_name = excluded.save_name,
            current_season = excluded.current_season,
            game_data = excluded.game_data,
            updated_at = now()
          returning save_name, current_season, updated_at
        `;
      } else {
        rows = await sql`
          update cloud_saves
          set
            game_data = game_data || jsonb_build_object(${chunkKey}, ${chunk}),
            updated_at = case when ${chunkIndex === totalChunks - 1} then now() else updated_at end
          where save_key = ${saveKey}
            and game_data->>'uploadId' = ${uploadId}
            and (game_data->>'totalChunks')::integer = ${totalChunks}
          returning save_name, current_season, updated_at
        `;
        if (!rows.length) {
          return response.status(409).json({ ok: false, error: 'The cloud upload expired or was replaced. Please save again.' });
        }
      }

      return response.status(200).json({
        ok: true,
        chunkIndex,
        totalChunks,
        complete: chunkIndex === totalChunks - 1,
        save: rows[0]
      });
    }

    // Backward-compatible small snapshot support.
    const { gameData } = body;
    if (!gameData || typeof gameData !== 'object') {
      return response.status(400).json({ ok: false, error: 'Invalid cloud save data.' });
    }
    const serialized = JSON.stringify(gameData);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_LEGACY_SAVE_BYTES) {
      return response.status(413).json({ ok: false, error: 'The cloud save is too large. Update to the chunked v0.4 client.' });
    }
    const rows = await sql`
      insert into cloud_saves (save_key, save_name, current_season, game_data, updated_at)
      values (
        ${saveKey},
        ${saveName || 'Main Universe'},
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
      returning save_name, current_season, updated_at
    `;
    return response.status(200).json({ ok: true, save: rows[0] });
  } catch (error) {
    console.error('Cloud save failed:', error);
    return response.status(500).json({ ok: false, error: 'Cloud save failed.' });
  }
}
