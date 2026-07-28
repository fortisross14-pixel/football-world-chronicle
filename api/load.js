import { neon } from '@neondatabase/serverless';

function validKey(value) {
  return typeof value === 'string' && value.length >= 12;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured in Vercel.');
    const saveKey = request.query?.saveKey;
    if (!validKey(saveKey)) return response.status(400).json({ ok: false, error: 'Invalid cloud code.' });
    const sql = neon(process.env.DATABASE_URL);

    if (request.query?.chunk !== undefined) {
      const index = Number(request.query.chunk);
      if (!Number.isInteger(index) || index < 0 || index > 99) {
        return response.status(400).json({ ok: false, error: 'Invalid cloud-save chunk.' });
      }
      const chunkKey = `chunk_${index}`;
      const rows = await sql`
        select game_data->>${chunkKey} as chunk
        from cloud_saves
        where save_key = ${saveKey}
        limit 1
      `;
      if (!rows.length) return response.status(404).json({ ok: false, error: 'No cloud save was found.' });
      if (!rows[0].chunk) return response.status(409).json({ ok: false, error: 'The cloud save is incomplete. Save it again from the source device.' });
      return response.status(200).json({ ok: true, index, chunk: rows[0].chunk });
    }

    const rows = await sql`
      select
        save_name,
        current_season,
        updated_at,
        game_data ? 'chunk_0' as chunked,
        case
          when game_data ? 'chunk_0' then jsonb_build_object(
            'format', game_data->>'format',
            'uploadId', game_data->>'uploadId',
            'totalChunks', (game_data->>'totalChunks')::integer,
            'originalBytes', (game_data->>'originalBytes')::integer,
            'compressedBytes', (game_data->>'compressedBytes')::integer
          )
          else game_data
        end as game_data
      from cloud_saves
      where save_key = ${saveKey}
      limit 1
    `;
    if (!rows.length) return response.status(404).json({ ok: false, error: 'No cloud save was found.' });
    return response.status(200).json({ ok: true, save: rows[0] });
  } catch (error) {
    console.error('Cloud load failed:', error);
    return response.status(500).json({ ok: false, error: 'Cloud load failed.' });
  }
}
