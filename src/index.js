export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    const json = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json"
        }
      });
    };

    const footballFetch = async (path) => {
      if (!env.FOOTBALL_DATA_TOKEN) {
        throw new Error(
          "FOOTBALL_DATA_TOKEN is not configured"
        );
      }

      const response = await fetch(
        `https://api.football-data.org/v4${path}`,
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

      return response.json();
    };

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
    // TEST DATABASE
    // --------------------------------------------------

    if (url.pathname === "/api/test-db") {
      try {
        const result = await env.DB
          .prepare("SELECT 1 AS test")
          .first();

        return json({
          success: true,
          database: result
        });
      } catch (error) {
        return json(
          {
            success: false,
            message: error.message
          },
          500
        );
      }
    }

    // --------------------------------------------------
    // TEST FOOTBALL-DATA.ORG
    // --------------------------------------------------

    if (url.pathname === "/api/test-football") {
      try {
        const data = await footballFetch("/competitions");

        return json({
          success: true,
          source: "football-data.org",
          total: data.competitions?.length || 0,
          competitions: data.competitions || []
        });
      } catch (error) {
        return json(
          {
            success: false,
            message: error.message
          },
          500
        );
      }
    }

    // --------------------------------------------------
    // SYNC COMPETITIONS
    // --------------------------------------------------

    if (url.pathname === "/api/sync-competitions") {
      try {
        const data = await footballFetch("/competitions");

        let inserted = 0;
        let updated = 0;

        for (const competition of data.competitions || []) {
          const providerId = competition.id;
          const name = competition.name;
          const country =
            competition.area?.name || null;
          const countryCode =
            competition.area?.code || null;
          const competitionCode =
            competition.code || null;
          const type =
            competition.type || null;
          const logoUrl =
            competition.emblem || null;

          const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

          const existing = await env.DB
            .prepare(`
              SELECT id
              FROM competitions
              WHERE provider_id = ?
            `)
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

        return json({
          success: true,
          source: "football-data.org",
          total: data.competitions?.length || 0,
          inserted,
          updated
        });
      } catch (error) {
        return json(
          {
            success: false,
            message: error.message
          },
          500
        );
      }
    }

    // --------------------------------------------------
    // SYNC TEAMS
    //
    // /api/sync-teams?competition=PL
    // --------------------------------------------------

    if (url.pathname === "/api/sync-teams") {
      try {
        const competitionCode =
          url.searchParams.get("competition");

        if (!competitionCode) {
          return json(
            {
              success: false,
              message:
                "Missing competition parameter. Example: ?competition=PL"
            },
            400
          );
        }

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

        const data = await footballFetch(
          `/competitions/${encodeURIComponent(
            competitionCode
          )}`
        );

        const providerSeasonId =
          data.currentSeason?.id;

        if (!providerSeasonId) {
          throw new Error(
            `No current season was returned for ${competitionCode}`
          );
        }

        const startDate =
          data.currentSeason.startDate || null;

        const endDate =
          data.currentSeason.endDate || null;

        const seasonName =
          `${startDate} / ${endDate}`;

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

        const teams = data.teams || [];

        let insertedTeams = 0;
        let updatedTeams = 0;
        let linkedTeams = 0;

        for (const team of teams) {
          const providerId = team.id;
          const name = team.name;
          const shortName =
            team.shortName || null;
          const country =
            team.area?.name || null;
          const crestUrl =
            team.crest || null;

          const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

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

            teamId =
              insertedTeam.meta.last_row_id;

            insertedTeams++;
          }

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

        return json({
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
            name: seasonName,
            year: startDate
              ? startDate.substring(0, 4)
              : null
          },
          teams: {
            total: teams.length,
            inserted: insertedTeams,
            updated: updatedTeams,
            linked: linkedTeams
          }
        });
      } catch (error) {
        return json(
          {
            success: false,
            message: error.message
          },
          500
        );
      }
    }

    // --------------------------------------------------
    // SYNC MATCHES
    //
    // /api/sync-matches?competition=PL
    // --------------------------------------------------

    if (url.pathname === "/api/sync-matches") {
      try {
        const competitionCode =
          url.searchParams.get("competition");

        if (!competitionCode) {
          return json(
            {
              success: false,
              message:
                "Missing competition parameter. Example: ?competition=PL"
            },
            400
          );
        }

        // ----------------------------------------------
        // FIND COMPETITION
        // ----------------------------------------------

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

        // ----------------------------------------------
        // FIND CURRENT SEASON
        // ----------------------------------------------

        const season = await env.DB
          .prepare(`
            SELECT
              id,
              provider_id,
              name,
              start_date,
              end_date
            FROM seasons
            WHERE competition_id = ?
              AND current = 1
            ORDER BY id DESC
            LIMIT 1
          `)
          .bind(competition.id)
          .first();

        if (!season) {
          throw new Error(
            `No current season found for ${competitionCode}. Run /api/sync-teams?competition=${competitionCode} first.`
          );
        }

        // ----------------------------------------------
        // FETCH MATCHES
        // ----------------------------------------------

        const data = await footballFetch(
          `/competitions/${encodeURIComponent(
            competitionCode
          )}/matches`
        );

        const matches = data.matches || [];

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        // ----------------------------------------------
        // PROCESS MATCHES
        // ----------------------------------------------

        for (const match of matches) {
          const providerId = match.id;

          const matchday =
            match.matchday ?? null;

          const kickoffAt =
            match.utcDate || null;

          const status =
            match.status || "SCHEDULED";

          const homeProviderId =
            match.homeTeam?.id;

          const awayProviderId =
            match.awayTeam?.id;

          if (
            !homeProviderId ||
            !awayProviderId
          ) {
            skipped++;
            continue;
          }

          // --------------------------------------------
          // FIND HOME TEAM
          // --------------------------------------------

          const homeTeam = await env.DB
            .prepare(`
              SELECT id
              FROM teams
              WHERE provider_id = ?
            `)
            .bind(homeProviderId)
            .first();

          // --------------------------------------------
          // FIND AWAY TEAM
          // --------------------------------------------

          const awayTeam = await env.DB
            .prepare(`
              SELECT id
              FROM teams
              WHERE provider_id = ?
            `)
            .bind(awayProviderId)
            .first();

          if (!homeTeam || !awayTeam) {
            skipped++;
            continue;
          }

          // --------------------------------------------
          // SCORES
          // --------------------------------------------

          const homeScore =
            match.score?.fullTime?.home ?? null;

          const awayScore =
            match.score?.fullTime?.away ?? null;

          // --------------------------------------------
          // WINNER
          // --------------------------------------------

          let winner = null;

          if (
            match.score?.winner === "HOME_TEAM"
          ) {
            winner = "HOME";
          } else if (
            match.score?.winner === "AWAY_TEAM"
          ) {
            winner = "AWAY";
          } else if (
            match.score?.winner === "DRAW"
          ) {
            winner = "DRAW";
          }

          // --------------------------------------------
          // CHECK EXISTING MATCH
          // --------------------------------------------

          const existing = await env.DB
            .prepare(`
              SELECT id
              FROM matches
              WHERE provider_id = ?
            `)
            .bind(providerId)
            .first();

          // --------------------------------------------
          // UPDATE EXISTING
          // --------------------------------------------

          if (existing) {
            await env.DB
              .prepare(`
                UPDATE matches
                SET
                  competition_id = ?,
                  season_id = ?,
                  matchday = ?,
                  home_team_id = ?,
                  away_team_id = ?,
                  kickoff_at = ?,
                  status = ?,
                  home_score = ?,
                  away_score = ?,
                  winner = ?
                WHERE provider_id = ?
              `)
              .bind(
                competition.id,
                season.id,
                matchday,
                homeTeam.id,
                awayTeam.id,
                kickoffAt,
                status,
                homeScore,
                awayScore,
                winner,
                providerId
              )
              .run();

            updated++;
          }

          // --------------------------------------------
          // INSERT NEW
          // --------------------------------------------

          else {
            await env.DB
              .prepare(`
                INSERT INTO matches (
                  provider_id,
                  competition_id,
                  season_id,
                  matchday,
                  home_team_id,
                  away_team_id,
                  kickoff_at,
                  status,
                  home_score,
                  away_score,
                  winner
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              .bind(
                providerId,
                competition.id,
                season.id,
                matchday,
                homeTeam.id,
                awayTeam.id,
                kickoffAt,
                status,
                homeScore,
                awayScore,
                winner
              )
              .run();

            inserted++;
          }
        }

        // ----------------------------------------------
        // RESPONSE
        // ----------------------------------------------

        return json({
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
            provider_id: season.provider_id,
            name: season.name
          },
          matches: {
            total_from_api: matches.length,
            inserted,
            updated,
            skipped
          }
        });
      } catch (error) {
        return json(
          {
            success: false,
            message: error.message
          },
          500
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
