export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Home
    if (url.pathname === "/") {
      return new Response("GoalPredict API is running.", {
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // Test D1 database
    if (url.pathname === "/api/test-db") {
      try {
        const result = await env.DB
          .prepare("SELECT 1 AS test")
          .first();

        return new Response(
          JSON.stringify({
            success: true,
            database: result
          }),
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // Test football-data.org
    if (url.pathname === "/api/test-football") {
      try {
        if (!env.FOOTBALL_DATA_TOKEN) {
          throw new Error("FOOTBALL_DATA_TOKEN is not configured");
        }

        const response = await fetch(
          "https://api.football-data.org/v4/competitions",
          {
            method: "GET",
            headers: {
              "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
              "Accept": "application/json"
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          throw new Error(
            `football-data.org returned ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();

        return new Response(
          JSON.stringify({
            success: true,
            count: data.competitions.length,
            competitions: data.competitions
          }),
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // Sync competitions from football-data.org into D1
    if (url.pathname === "/api/sync-competitions") {
      try {
        if (!env.FOOTBALL_DATA_TOKEN) {
          throw new Error("FOOTBALL_DATA_TOKEN is not configured");
        }

        const response = await fetch(
          "https://api.football-data.org/v4/competitions",
          {
            method: "GET",
            headers: {
              "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
              "Accept": "application/json"
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          throw new Error(
            `football-data.org returned ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();

        let inserted = 0;
        let updated = 0;

        for (const competition of data.competitions) {
          const providerId = competition.id;
          const name = competition.name;
          const country = competition.area?.name || null;
          const countryCode = competition.area?.code || null;
          const competitionCode = competition.code || null;
          const type = competition.type || null;
          const logoUrl = competition.emblem || null;

          const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

          const existing = await env.DB
            .prepare(
              "SELECT id FROM competitions WHERE provider_id = ?"
            )
            .bind(providerId)
            .first();

          if (existing) {
            await env.DB
              .prepare(`
                UPDATE competitions
                SET
                  name = ?,
                  slug = ?,
                  country = ?,
                  country_code = ?,
                  competition_code = ?,
                  type = ?,
                  logo_url = ?,
                  active = 1
                WHERE provider_id = ?
              `)
              .bind(
                name,
                slug,
                country,
                countryCode,
                competitionCode,
                type,
                logoUrl,
                providerId
              )
              .run();

            updated++;
          } else {
            await env.DB
              .prepare(`
                INSERT INTO competitions (
                  provider_id,
                  name,
                  slug,
                  country,
                  country_code,
                  competition_code,
                  type,
                  logo_url,
                  active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
              `)
              .bind(
                providerId,
                name,
                slug,
                country,
                countryCode,
                competitionCode,
                type,
                logoUrl
              )
              .run();

            inserted++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            source: "football-data.org",
            total: data.competitions.length,
            inserted: inserted,
            updated: updated
          }),
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    // Not found
    return new Response("Not found", {
      status: 404
    });
  }
};
