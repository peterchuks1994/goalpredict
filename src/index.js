export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json"
        }
      });

    const errorResponse = (error) =>
      json(
        {
          success: false,
          message: error?.message || String(error)
        },
        500
      );

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
    // TEST D1
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
        return errorResponse(error);
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

        return json({
          success: true,
          count: data.competitions?.length || 0,
          competitions: data.competitions || []
        });
      } catch (error) {
        return errorResponse(error);
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

        for (const competition of data.competitions || []) {
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

        return json({
          success: true,
          source: "football-data.org",
          total: data.competitions?.length || 0,
          inserted,
          updated
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    // --------------------------------------------------
    // SYNC TEAMS
    //
    // Example:
    // /api/sync-teams?competition=PL
    // --------------------------------------------------
    if (url.pathname === "/api/sync-teams") {
      try {
        if (!env.FOOTBALL_DATA_TOKEN) {
          throw new Error("FOOTBALL_DATA_TOKEN is not configured");
        }

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

        const response = await fetch(
          `https://api.football-data.org/v4/competitions/${encodeURIComponent(
            competitionCode
          )}`,
          {
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

        const currentSeason = data.currentSeason;

        if (!currentSeason?.id) {
          throw new Error(
            `No current season was returned for ${competitionCode}`
          );
        }

        const providerSeasonId = currentSeason.id;

        const seasonName =
          `${currentSeason.startDate} / ${currentSeason.endDate}`;

        const startDate = currentSeason.startDate || null;
        const endDate = currentSeason.endDate || null;

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
          const result = await env.DB
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
            id: result.meta.last_row_id
          };
        }

        const teams = data.teams || [];

        /*
         * Load all existing teams for this competition's
         * provider IDs in ONE query.
         */
        const providerIds = teams
          .map((team) => team.id)
          .filter(Boolean);

        let existingTeams = [];

        if (providerIds.length > 0) {
          const placeholders =
            providerIds.map(() => "?").join(",");

          existingTeams = await env.DB
            .prepare(`
              SELECT id, provider_id
              FROM teams
              WHERE provider_id IN (${placeholders})
            `)
            .bind(...providerIds)
            .all();
        }

        const existingTeamMap = new Map();

        for (const team of existingTeams.results || []) {
          existingTeamMap.set(
            Number(team.provider_id),
            Number(team.id)
          );
        }

        const teamStatements = [];

        let insertedTeams = 0;
        let updatedTeams = 0;

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

          if (existingTeamMap.has(providerId)) {
            teamStatements.push(
              env.DB
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
            );

            updatedTeams++;
          } else {
            teamStatements.push(
              env.DB
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
            );

            insertedTeams++;
          }
        }

        if (teamStatements.length > 0) {
          await env.DB.batch(teamStatements);
        }

        /*
         * Reload all team IDs in ONE query.
         */
        const refreshedTeams =
          providerIds.length > 0
            ? await env.DB
                .prepare(`
                  SELECT id, provider_id
                  FROM teams
                  WHERE provider_id IN (${providerIds
                    .map(() => "?")
                    .join(",")})
                `)
                .bind(...providerIds)
                .all()
            : { results: [] };

        const teamIdMap = new Map();

        for (const team of refreshedTeams.results || []) {
          teamIdMap.set(
            Number(team.provider_id),
            Number(team.id)
          );
        }

        /*
         * Get existing links in ONE query.
         */
        const existingLinks =
          await env.DB
            .prepare(`
              SELECT team_id
              FROM team_seasons
              WHERE competition_id = ?
                AND season_id = ?
            `)
            .bind(
              competition.id,
              season.id
            )
            .all();

        const linkedTeamIds = new Set(
          (existingLinks.results || []).map(
            (row) => Number(row.team_id)
          )
        );

        const linkStatements = [];
        let linkedTeams = 0;

        for (const team of teams) {
          const teamId = teamIdMap.get(
            Number(team.id)
          );

          if (!teamId) {
            continue;
          }

          if (!linkedTeamIds.has(teamId)) {
            linkStatements.push(
              env.DB
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
            );

            linkedTeams++;
          }
        }

        if (linkStatements.length > 0) {
          await env.DB.batch(linkStatements);
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
            year: String(startDate).slice(0, 4)
          },
          teams: {
            total: teams.length,
            inserted: insertedTeams,
            updated: updatedTeams,
            linked: linkedTeams
          }
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    // --------------------------------------------------
    // SYNC MATCHES
    //
    // Example:
    // /api/sync-matches?competition=PL
    //
    // Optional:
    // ?competition=PL&season=2026
    // --------------------------------------------------
    if (url.pathname === "/api/sync-matches") {
      try {
        if (!env.FOOTBALL_DATA_TOKEN) {
          throw new Error(
            "FOOTBALL_DATA_TOKEN is not configured"
          );
        }

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

        // ------------------------------------------------
        // FIND COMPETITION
        // ------------------------------------------------
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

        // ------------------------------------------------
        // FIND CURRENT SEASON
        // ------------------------------------------------
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
            `No current season found for ${competitionCode}. Run sync-teams first.`
          );
        }

        // ------------------------------------------------
        // FETCH MATCHES
        // ------------------------------------------------
        const footballUrl =
          `https://api.football-data.org/v4/competitions/${encodeURIComponent(
            competitionCode
          )}/matches`;

        const response = await fetch(footballUrl, {
          headers: {
            "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          const errorText = await response.text();

          throw new Error(
            `football-data.org returned ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();

        const matches = data.matches || [];

        // ------------------------------------------------
        // LOAD ALL TEAMS ONCE
        // ------------------------------------------------
        const teamRows = await env.DB
          .prepare(`
            SELECT
              id,
              provider_id
            FROM teams
            WHERE active = 1
          `)
          .all();

        const teamMap = new Map();

        for (const team of teamRows.results || []) {
          teamMap.set(
            Number(team.provider_id),
            Number(team.id)
          );
        }

        // ------------------------------------------------
        // VALIDATE / PREPARE MATCHES
        // ------------------------------------------------
        const validMatches = [];

        let skipped = 0;

        for (const match of matches) {
          const homeProviderId =
            match.homeTeam?.id;

          const awayProviderId =
            match.awayTeam?.id;

          const homeTeamId =
            teamMap.get(Number(homeProviderId));

          const awayTeamId =
            teamMap.get(Number(awayProviderId));

          if (!homeTeamId || !awayTeamId) {
            skipped++;
            continue;
          }

          const score = match.score || {};

          const fullTime =
            score.fullTime || {};

          let winner = null;

          if (match.score?.winner) {
            winner = match.score.winner;
          }

          validMatches.push({
            providerId: match.id,
            competitionId: competition.id,
            seasonId: season.id,
            matchday: match.matchday || null,
            homeTeamId,
            awayTeamId,
            kickoffAt: match.utcDate || null,
            status: match.status || "SCHEDULED",
            homeScore:
              fullTime.home ?? null,
            awayScore:
              fullTime.away ?? null,
            winner
          });
        }

        // ------------------------------------------------
        // LOAD EXISTING MATCHES ONCE
        // ------------------------------------------------
        const existingMatches =
          await env.DB
            .prepare(`
              SELECT
                id,
                provider_id
              FROM matches
              WHERE competition_id = ?
                AND season_id = ?
            `)
            .bind(
              competition.id,
              season.id
            )
            .all();

        const existingMatchMap = new Map();

        for (const match of existingMatches.results || []) {
          existingMatchMap.set(
            Number(match.provider_id),
            Number(match.id)
          );
        }

        // ------------------------------------------------
        // BUILD BATCHES
        //
        // We intentionally keep batches small.
        // This prevents a large matchday sync from
        // generating excessive subrequests.
        // ------------------------------------------------
        const BATCH_SIZE = 20;

        let inserted = 0;
        let updated = 0;

        for (
          let start = 0;
          start < validMatches.length;
          start += BATCH_SIZE
        ) {
          const batchMatches =
            validMatches.slice(
              start,
              start + BATCH_SIZE
            );

          const statements = [];

          for (const match of batchMatches) {
            if (
              existingMatchMap.has(
                Number(match.providerId)
              )
            ) {
              statements.push(
                env.DB
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
                    match.competitionId,
                    match.seasonId,
                    match.matchday,
                    match.homeTeamId,
                    match.awayTeamId,
                    match.kickoffAt,
                    match.status,
                    match.homeScore,
                    match.awayScore,
                    match.winner,
                    match.providerId
                  )
              );

              updated++;
            } else {
              statements.push(
                env.DB
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
                    match.providerId,
                    match.competitionId,
                    match.seasonId,
                    match.matchday,
                    match.homeTeamId,
                    match.awayTeamId,
                    match.kickoffAt,
                    match.status,
                    match.homeScore,
                    match.awayScore,
                    match.winner
                  )
              );

              inserted++;
            }
          }

          if (statements.length > 0) {
            await env.DB.batch(statements);
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
            provider_id: season.provider_id,
            name: season.name,
            year: String(
              season.start_date
            ).slice(0, 4)
          },
          matches: {
            total_from_provider: matches.length,
            valid: validMatches.length,
            inserted,
            updated,
            skipped
          }
        });
      } catch (error) {
        return errorResponse(error);
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
