export async function onRequest(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      `SELECT slug, title, description, icon, path
       FROM games
       WHERE enabled = 1
       ORDER BY sort_order ASC`
    ).all();

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch games" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
