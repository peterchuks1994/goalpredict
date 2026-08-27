```javascript
const API_BASE_URL = "https://api.football-data.org/v4";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function footballDataFetch(path, env) {
  if (!env.FOOTBALL_DATA_TOKEN) {
    throw new Error("FOOTBALL_DATA_TOKEN is not configured");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
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

  return response.json();
}

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
    // TEST DATABASE
    // --------------------------------------------------
    if (url.pathname === "/api/test-db") {
      try {
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

        const result = await env.DB
          .prepare("SELECT 1 AS test")
          .first();

        return jsonResponse({
          success: true,
          database: result
        });
      } catch (error) {
        return jsonResponse(
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
        const data = await footballDataFetch(
          "/competitions",
          env
        );

        return jsonResponse({
          success: true,
          source: "football-data.org",
          count: data.competitions?.length || 0,
          competitions: data.competitions || []
        });
      } catch (error) {
        return jsonResponse(
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
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

        const data = await footballDataFetch(
          "/competitions",
          env
        );

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
          const slug = slugify(name);

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

        return jsonResponse({
          success: true,
          source: "football-data.org",
          total: data.competitions?.length || 0,
          inserted,
          updated
        });
      } catch (error) {
        return jsonResponse(
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
    // Example:
    // /api/sync-teams?competition=PL
    // --------------------------------------------------
    if (url.pathname === "/api/sync-teams") {
      try {
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

        const competitionCode =
          url.searchParams.get("competition");

        if (!competitionCode) {
          return jsonResponse(
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

        const data = await footballDataFetch(
          `/competitions/${encodeURIComponent(competitionCode)}`,
          env
        );

        const providerSeasonId = data.currentSeason?.id;

        if (!providerSeasonId) {
          throw new Error(
            `No current season was returned for ${competitionCode}`
          );
        }

        const seasonName =
          `${data.currentSeason.startDate} / ${data.currentSeason.endDate}`;

        const startDate =
          data.currentSeason.startDate || null;

        const endDate =
          data.currentSeason.endDate || null;

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
          const slug = slugify(name);

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

        return jsonResponse({
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
            year: String(
              new Date(startDate).getUTCFullYear()
            )
          },
          teams: {
            total: teams.length,
            inserted: insertedTeams,
            updated: updatedTeams,
            linked: linkedTeams
          }
        });
      } catch (error) {
        return jsonResponse(
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
    // Example:
    // /api/sync-matches?competition=PL
    //
    // IMPORTANT:
    // This endpoint fetches matches in ONE football-data.org
    // request, then writes them to D1.
    // --------------------------------------------------
    if (url.pathname === "/api/sync-matches") {
      try {
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

        const competitionCode =
          url.searchParams.get("competition");

        if (!competitionCode) {
          return jsonResponse(
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

        const data = await footballDataFetch(
          `/competitions/${encodeURIComponent(competitionCode)}/matches`,
          env
        );

        const providerSeasonId =
          data.matches?.[0]?.season?.id ||
          null;

        let season = null;

        if (providerSeasonId) {
          season = await env.DB
            .prepare(`
              SELECT id, provider_id, name
              FROM seasons
              WHERE competition_id = ?
                AND provider_id = ?
            `)
            .bind(
              competition.id,
              providerSeasonId
            )
            .first();
        }

        if (!season) {
          season = await env.DB
            .prepare(`
              SELECT id, provider_id, name
              FROM seasons
              WHERE competition_id = ?
                AND current = 1
              ORDER BY id DESC
              LIMIT 1
            `)
            .bind(competition.id)
            .first();
        }

        if (!season) {
          throw new Error(
            `No season found in D1 for ${competitionCode}`
          );
        }

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const match of data.matches || []) {
          const providerId = match.id;

          const homeProviderId =
            match.homeTeam?.id;

          const awayProviderId =
            match.awayTeam?.id;

          if (!homeProviderId || !awayProviderId) {
            skipped++;
            continue;
          }

          const homeTeam = await env.DB
            .prepare(`
              SELECT id
              FROM teams
              WHERE provider_id = ?
            `)
            .bind(homeProviderId)
            .first();

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

          const kickoffAt =
            match.utcDate || null;

          const status =
            match.status || "SCHEDULED";

          const homeScore =
            match.score?.fullTime?.home ?? null;

          const awayScore =
            match.score?.fullTime?.away ?? null;

          let winner = null;

          if (match.score?.winner) {
            winner = match.score.winner;
          }

          const matchday =
            match.matchday ?? null;

          const existing = await env.DB
            .prepare(`
              SELECT id
              FROM matches
              WHERE provider_id = ?
            `)
            .bind(providerId)
            .first();

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
          } else {
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

        return jsonResponse({
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
            total_from_provider:
              data.matches?.length || 0,
            inserted,
            updated,
            skipped
          }
        });
      } catch (error) {
        return jsonResponse(
          {
            success: false,
            message: error.message
          },
          500
        );
      }
    }

    // --------------------------------------------------
    // SYNC TEAM STATISTICS + FORM
    //
    // Example:
    // /api/sync-statistics?competition=PL
    //
    // Uses existing D1 matches only.
    // No football-data.org request is made here.
    // --------------------------------------------------
    if (url.pathname === "/api/sync-statistics") {
      try {
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

        const competitionCode =
          url.searchParams.get("competition");

        if (!competitionCode) {
          return jsonResponse(
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

        const season = await env.DB
          .prepare(`
            SELECT
              id,
              provider_id,
              name
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
            `No current season found for ${competitionCode}`
          );
        }

        const teamsResult = await env.DB
          .prepare(`
            SELECT
              t.id,
              t.provider_id,
              t.name
            FROM teams t
            INNER JOIN team_seasons ts
              ON ts.team_id = t.id
            WHERE ts.competition_id = ?
              AND ts.season_id = ?
            ORDER BY t.name
          `)
          .bind(
            competition.id,
            season.id
          )
          .all();

        const teams = teamsResult.results || [];

        let statisticsUpdated = 0;
        let formUpdated = 0;

        // --------------------------------------------------
        // PROCESS EACH TEAM
        // --------------------------------------------------
        for (const team of teams) {
          // ----------------------------------------------
          // SEASON STATISTICS
          // ----------------------------------------------
          const matchesResult = await env.DB
            .prepare(`
              SELECT
                id,
                home_team_id,
                away_team_id,
                home_score,
                away_score,
                status,
                kickoff_at,
                winner
              FROM matches
              WHERE competition_id = ?
                AND season_id = ?
                AND (
                  home_team_id = ?
                  OR away_team_id = ?
                )
                AND status IN ('FINISHED', 'TIMED')
                AND home_score IS NOT NULL
                AND away_score IS NOT NULL
              ORDER BY kickoff_at ASC
            `)
            .bind(
              competition.id,
              season.id,
              team.id,
              team.id
            )
            .all();

          const matches =
            matchesResult.results || [];

          let matchesPlayed = 0;
          let wins = 0;
          let draws = 0;
          let losses = 0;
          let goalsFor = 0;
          let goalsAgainst = 0;
          let points = 0;
          let cleanSheets = 0;
          let bttsMatches = 0;
          let over15Matches = 0;
          let over25Matches = 0;
          let over35Matches = 0;

          for (const match of matches) {
            const isHome =
              match.home_team_id === team.id;

            const goalsScored = isHome
              ? Number(match.home_score)
              : Number(match.away_score);

            const goalsConceded = isHome
              ? Number(match.away_score)
              : Number(match.home_score);

            matchesPlayed++;

            goalsFor += goalsScored;
            goalsAgainst += goalsConceded;

            if (goalsConceded === 0) {
              cleanSheets++;
            }

            if (
              goalsScored > 0 &&
              goalsConceded > 0
            ) {
              bttsMatches++;
            }

            const totalGoals =
              goalsScored + goalsConceded;

            if (totalGoals >= 2) {
              over15Matches++;
            }

            if (totalGoals >= 3) {
              over25Matches++;
            }

            if (totalGoals >= 4) {
              over35Matches++;
            }

            if (goalsScored > goalsConceded) {
              wins++;
              points += 3;
            } else if (
              goalsScored === goalsConceded
            ) {
              draws++;
              points += 1;
            } else {
              losses++;
            }
          }

          const goalDifference =
            goalsFor - goalsAgainst;

          // ----------------------------------------------
          // UPSERT TEAM STATISTICS
          // ----------------------------------------------
          const existingStatistics = await env.DB
            .prepare(`
              SELECT id
              FROM team_statistics
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
            `)
            .bind(
              team.id,
              competition.id,
              season.id
            )
            .first();

          if (existingStatistics) {
            await env.DB
              .prepare(`
                UPDATE team_statistics
                SET
                  matches_played = ?,
                  wins = ?,
                  draws = ?,
                  losses = ?,
                  goals_for = ?,
                  goals_against = ?,
                  goal_difference = ?,
                  points = ?,
                  clean_sheets = ?,
                  btts_matches = ?,
                  over_15_matches = ?,
                  over_25_matches = ?,
                  over_35_matches = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `)
              .bind(
                matchesPlayed,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDifference,
                points,
                cleanSheets,
                bttsMatches,
                over15Matches,
                over25Matches,
                over35Matches,
                existingStatistics.id
              )
              .run();
          } else {
            await env.DB
              .prepare(`
                INSERT INTO team_statistics (
                  team_id,
                  competition_id,
                  season_id,
                  matches_played,
                  wins,
                  draws,
                  losses,
                  goals_for,
                  goals_against,
                  goal_difference,
                  points,
                  clean_sheets,
                  btts_matches,
                  over_15_matches,
                  over_25_matches,
                  over_35_matches,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `)
              .bind(
                team.id,
                competition.id,
                season.id,
                matchesPlayed,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDifference,
                points,
                cleanSheets,
                bttsMatches,
                over15Matches,
                over25Matches,
                over35Matches
              )
              .run();
          }

          statisticsUpdated++;

          // ----------------------------------------------
          // LAST 5 FINISHED MATCHES
          // ----------------------------------------------
          const recentResult = await env.DB
            .prepare(`
              SELECT
                id,
                home_team_id,
                away_team_id,
                home_score,
                away_score,
                kickoff_at
              FROM matches
              WHERE competition_id = ?
                AND season_id = ?
                AND (
                  home_team_id = ?
                  OR away_team_id = ?
                )
                AND status IN ('FINISHED', 'TIMED')
                AND home_score IS NOT NULL
                AND away_score IS NOT NULL
              ORDER BY kickoff_at DESC
              LIMIT 5
            `)
            .bind(
              competition.id,
              season.id,
              team.id,
              team.id
            )
            .all();

          const recentMatches =
            recentResult.results || [];

          let recentWins = 0;
          let recentDraws = 0;
          let recentLosses = 0;
          let recentGoalsFor = 0;
          let recentGoalsAgainst = 0;
          let recentPoints = 0;
          let formString = "";

          // Reverse so form is oldest -> newest
          const chronologicalMatches =
            [...recentMatches].reverse();

          for (const match of chronologicalMatches) {
            const isHome =
              match.home_team_id === team.id;

            const goalsScored = isHome
              ? Number(match.home_score)
              : Number(match.away_score);

            const goalsConceded = isHome
              ? Number(match.away_score)
              : Number(match.home_score);

            recentGoalsFor += goalsScored;
            recentGoalsAgainst += goalsConceded;

            if (goalsScored > goalsConceded) {
              recentWins++;
              recentPoints += 3;
              formString += "W";
            } else if (
              goalsScored === goalsConceded
            ) {
              recentDraws++;
              recentPoints += 1;
              formString += "D";
            } else {
              recentLosses++;
              formString += "L";
            }
          }

          // ----------------------------------------------
          // UPSERT TEAM FORM
          // ----------------------------------------------
          const existingForm = await env.DB
            .prepare(`
              SELECT id
              FROM team_form
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
            `)
            .bind(
              team.id,
              competition.id,
              season.id
            )
            .first();

          if (existingForm) {
            await env.DB
              .prepare(`
                UPDATE team_form
                SET
                  matches_considered = ?,
                  wins = ?,
                  draws = ?,
                  losses = ?,
                  goals_for = ?,
                  goals_against = ?,
                  points = ?,
                  form_string = ?,
                  calculated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `)
              .bind(
                recentMatches.length,
                recentWins,
                recentDraws,
                recentLosses,
                recentGoalsFor,
                recentGoalsAgainst,
                recentPoints,
                formString,
                existingForm.id
              )
              .run();
          } else {
            await env.DB
              .prepare(`
                INSERT INTO team_form (
                  team_id,
                  competition_id,
                  season_id,
                  matches_considered,
                  wins,
                  draws,
                  losses,
                  goals_for,
                  goals_against,
                  points,
                  form_string,
                  calculated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `)
              .bind(
                team.id,
                competition.id,
                season.id,
                recentMatches.length,
                recentWins,
                recentDraws,
                recentLosses,
                recentGoalsFor,
                recentGoalsAgainst,
                recentPoints,
                formString
              )
              .run();
          }

          formUpdated++;
        }

        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------
        const statisticsCount = await env.DB
          .prepare(`
            SELECT COUNT(*) AS total
            FROM team_statistics
            WHERE competition_id = ?
              AND season_id = ?
          `)
          .bind(
            competition.id,
            season.id
          )
          .first();

        const formCount = await env.DB
          .prepare(`
            SELECT COUNT(*) AS total
            FROM team_form
            WHERE competition_id = ?
              AND season_id = ?
          `)
          .bind(
            competition.id,
            season.id
          )
          .first();

        return jsonResponse({
          success: true,
          source: "D1 existing matches",
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
          teams: {
            processed: teams.length
          },
          statistics: {
            updated: statisticsUpdated,
            records_in_database:
              statisticsCount?.total || 0
          },
          form: {
            updated: formUpdated,
            matches_considered_per_team: 5,
            records_in_database:
              formCount?.total || 0
          }
        });
      } catch (error) {
        return jsonResponse(
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
```
