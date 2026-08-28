import { getReadyDb } from './db';
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const sql = await getReadyDb();
  const rows = await sql.query(`INSERT INTO rate_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window_start < now()-($2*interval '1 second') THEN 1 ELSE rate_limits.count+1 END, window_start=CASE WHEN rate_limits.window_start < now()-($2*interval '1 second') THEN now() ELSE rate_limits.window_start END RETURNING count,window_start`, [key, windowSeconds]);
  return Number(rows[0].count) <= limit;
}
