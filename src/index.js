export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // HOME
    // --------------------------------------------------
    if (url.pathname === "/") {
      return new Response("GoalPredict API is running.", {
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // --------------------------------------------------
    // TEST D1 DATABASE
    // --------------------------------------------------
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

    // --------------------------------------------------
    // TEST FOOTBALL-DATA.ORG
    // --------------------------------------------------
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

    // --------------------------------------------------
    // SYNC COMPETITIONS
    // --------------------------------------------------
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
            inserted,
            updated
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

    // --------------------------------------------------
    // SYNC TEAMS
    // Example:
    // /api/sync-teams?competition=PL
    // --------------------------------------------------
    if (url.pathname === "/api/sync-teams") {
      try {
        if (!env.FOOTBALL_DATA_TOKEN) {
          throw new Error("FOOTBALL_DATA_TOKEN is not configured");
        }

        const competitionCode = url.searchParams.get("competition");

        if (!competitionCode) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Missing competition parameter. Example: ?competition=PL"
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        }

        // Find competition in D1
        const competition = await env.DB
          .prepare(`
            SELECT
              id,
              provider_id,
              name,
              competition_code
            FROM competitions
            WHERE competition_code = ?
          `)
          .bind(competitionCode)
          .first();

        if (!competition) {
          throw new Error(
            `Competition ${competitionCode} was not found in D1`
          );
        }

        // Fetch competition data from football-data.org
        const response = await fetch(
          `https://api.football-data.org/v4/competitions/${encodeURIComponent(
            competitionCode
          )}`,
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

        // --------------------------------------------------
        // CREATE / UPDATE SEASON
        // --------------------------------------------------

        const providerSeasonId = data.currentSeason?.id;

        if (!providerSeasonId) {
          throw new Error(
            `No current season was returned for ${competitionCode}`
          );
        }

        const seasonName =
          `${data.currentSeason.startDate} / ${data.currentSeason.endDate}`;

        const startDate = data.currentSeason.startDate || null;
        const endDate = data.currentSeason.endDate || null;

        let season = await env.DB
          .prepare(`
            SELECT id
            FROM seasons
            WHERE competition_id = ?
              AND provider_id = ?
          `)
          .bind(
            competition.id,
            providerSeasonId
          )
          .first();

        if (season) {
          await env.DB
            .prepare(`
              UPDATE seasons
              SET
                name = ?,
                start_date = ?,
                end_date = ?,
                current = 1
              WHERE id = ?
            `)
            .bind(
              seasonName,
              startDate,
              endDate,
              season.id
            )
            .run();
        } else {
          const insertedSeason = await env.DB
            .prepare(`
              INSERT INTO seasons (
                competition_id,
                provider_id,
                name,
                start_date,
                end_date,
                current
              )
              VALUES (?, ?, ?, ?, ?, 1)
            `)
            .bind(
              competition.id,
              providerSeasonId,
              seasonName,
              startDate,
              endDate
            )
            .run();

          season = {
            id: insertedSeason.meta.last_row_id
          };
        }

        // --------------------------------------------------
        // SYNC TEAMS
        // --------------------------------------------------

        let insertedTeams = 0;
        let updatedTeams = 0;
        let linkedTeams = 0;

        const teams = data.teams || [];

        for (const team of teams) {
          const providerId = team.id;
          const name = team.name;
          const shortName = team.shortName || null;
          const country = team.area?.name || null;
          const crestUrl = team.crest || null;

          const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

          // Find existing team
          const existingTeam = await env.DB
            .prepare(`
              SELECT id
              FROM teams
              WHERE provider_id = ?
            `)
            .bind(providerId)
            .first();

          let teamId;

          if (existingTeam) {
            teamId = existingTeam.id;

            await env.DB
              .prepare(`
                UPDATE teams
                SET
                  name = ?,
                  short_name = ?,
                  slug = ?,
                  country = ?,
                  crest_url = ?,
                  active = 1,
                  updated_at = CURRENT_TIMESTAMP
                WHERE provider_id = ?
              `)
              .bind(
                name,
                shortName,
                slug,
                country,
                crestUrl,
                providerId
              )
              .run();

            updatedTeams++;
          } else {
            const insertedTeam = await env.DB
              .prepare(`
                INSERT INTO teams (
                  provider_id,
                  name,
                  short_name,
                  slug,
                  country,
                  crest_url,
                  active
                )
                VALUES (?, ?, ?, ?, ?, ?, 1)
              `)
              .bind(
                providerId,
                name,
                shortName,
                slug,
                country,
                crestUrl
              )
              .run();

            teamId = insertedTeam.meta.last_row_id;

            insertedTeams++;
          }

          // --------------------------------------------------
          // LINK TEAM TO COMPETITION + SEASON
          // --------------------------------------------------

          const existingLink = await env.DB
            .prepare(`
              SELECT id
              FROM team_seasons
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
            `)
            .bind(
              teamId,
              competition.id,
              season.id
            )
            .first();

          if (!existingLink) {
            await env.DB
              .prepare(`
                INSERT INTO team_seasons (
                  team_id,
                  competition_id,
                  season_id,
                  squad_status
                )
                VALUES (?, ?, ?, ?)
              `)
              .bind(
                teamId,
                competition.id,
                season.id,
                "ACTIVE"
              )
              .run();

            linkedTeams++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            source: "football-data.org",
            competition: {
              id: competition.id,
              provider_id: competition.provider_id,
              code: competition.competition_code,
              name: competition.name
            },
            season: {
              id: season.id,
              provider_id: providerSeasonId,
              name: seasonName
            },
            teams: {
              total: teams.length,
              inserted: insertedTeams,
              updated: updatedTeams,
              linked: linkedTeams
            }
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

    // --------------------------------------------------
    // NOT FOUND
    // --------------------------------------------------
    return new Response("Not found", {
      status: 404
    });
  }
};
