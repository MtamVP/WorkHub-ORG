const RETAIN_BACKUPS = 30;

async function runBackup(env) {
  const { results } = await env.DB.prepare("SELECT data FROM topics ORDER BY id").all();
  const topics = results.map((row) => JSON.parse(row.data));
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO backups (created_at, topic_count, data) VALUES (?, ?, ?)")
    .bind(createdAt, topics.length, JSON.stringify(topics))
    .run();
  await env.DB.prepare(
    "DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ?)"
  ).bind(RETAIN_BACKUPS).run();
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env));
  },
  async fetch() {
    return new Response("research-hub-backup: cron-triggered worker, no public API.", { status: 404 });
  }
};
