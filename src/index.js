const API_BASE_URL = "https://api.football-data.org/v4";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function errorResponse(error) {
  return json(
    {
      success: false,
      message: error?.message || String(error)
    },
    500
  );
}

function slugify(value) {
  return String(value || "")
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

function safeDivide(numerator, denominator) {
  if (!denominator || Number(denominator) === 0) {
    return 0;
  }

  return Number(numerator || 0) / Number(denominator);
}

function roundNumber(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function buildTeamFeatures(statistics, form) {
  const matchesPlayed = Number(statistics?.matches_played || 0);
  const recentMatches = Number(form?.matches_considered || 0);

  const points = Number(statistics?.points || 0);
  const wins = Number(statistics?.wins || 0);
  const draws = Number(statistics?.draws || 0);
  const losses = Number(statistics?.losses || 0);

  const goalsFor = Number(statistics?.goals_for || 0);
  const goalsAgainst = Number(statistics?.goals_against || 0);
  const goalDifference = Number(
    statistics?.goal_difference ??
    (goalsFor - goalsAgainst)
  );

  const cleanSheets = Number(statistics?.clean_sheets || 0);
  const bttsMatches = Number(statistics?.btts_matches || 0);
  const over15Matches = Number(statistics?.over_15_matches || 0);
  const over25Matches = Number(statistics?.over_25_matches || 0);
  const over35Matches = Number(statistics?.over_35_matches || 0);

  const recentWins = Number(form?.wins || 0);
  const recentDraws = Number(form?.draws || 0);
  const recentLosses = Number(form?.losses || 0);
  const recentGoalsFor = Number(form?.goals_for || 0);
  const recentGoalsAgainst = Number(form?.goals_against || 0);
  const recentPoints = Number(form?.points || 0);

  return {
    matches_played: matchesPlayed,
    points,
    wins,
    draws,
    losses,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_difference: goalDifference,
    clean_sheets: cleanSheets,
    btts_matches: bttsMatches,
    over_15_matches: over15Matches,
    over_25_matches: over25Matches,
    over_35_matches: over35Matches,

    points_per_match: roundNumber(
      safeDivide(points, matchesPlayed)
    ),

    win_rate: roundNumber(
      safeDivide(wins, matchesPlayed)
    ),

    draw_rate: roundNumber(
      safeDivide(draws, matchesPlayed)
    ),

    loss_rate: roundNumber(
      safeDivide(losses, matchesPlayed)
    ),

    goals_for_per_match: roundNumber(
      safeDivide(goalsFor, matchesPlayed)
    ),

    goals_against_per_match: roundNumber(
      safeDivide(goalsAgainst, matchesPlayed)
    ),

    goal_difference_per_match: roundNumber(
      safeDivide(goalDifference, matchesPlayed)
    ),

    clean_sheet_rate: roundNumber(
      safeDivide(cleanSheets, matchesPlayed)
    ),

    btts_rate: roundNumber(
      safeDivide(bttsMatches, matchesPlayed)
    ),

    over_15_rate: roundNumber(
      safeDivide(over15Matches, matchesPlayed)
    ),

    over_25_rate: roundNumber(
      safeDivide(over25Matches, matchesPlayed)
    ),

    over_35_rate: roundNumber(
      safeDivide(over35Matches, matchesPlayed)
    ),

    recent_matches: recentMatches,
    recent_wins: recentWins,
    recent_draws: recentDraws,
    recent_losses: recentLosses,
    recent_goals_for: recentGoalsFor,
    recent_goals_against: recentGoalsAgainst,
    recent_points: recentPoints,

    recent_points_per_match: roundNumber(
      safeDivide(recentPoints, recentMatches)
    ),

    recent_win_rate: roundNumber(
      safeDivide(recentWins, recentMatches)
    ),

    recent_goals_for_per_match: roundNumber(
      safeDivide(recentGoalsFor, recentMatches)
    ),

    recent_goals_against_per_match: roundNumber(
      safeDivide(recentGoalsAgainst, recentMatches)
    )
  };
}

function compareFeatures(home, away) {
  return {
    points_per_match_difference: roundNumber(
      home.points_per_match - away.points_per_match
    ),

    win_rate_difference: roundNumber(
      home.win_rate - away.win_rate
    ),

    goals_for_per_match_difference: roundNumber(
      home.goals_for_per_match -
      away.goals_for_per_match
    ),

    goals_against_per_match_difference: roundNumber(
      home.goals_against_per_match -
      away.goals_against_per_match
    ),

    goal_difference_per_match_difference: roundNumber(
      home.goal_difference_per_match -
      away.goal_difference_per_match
    ),

    clean_sheet_rate_difference: roundNumber(
      home.clean_sheet_rate -
      away.clean_sheet_rate
    ),

    btts_rate_difference: roundNumber(
      home.btts_rate -
      away.btts_rate
    ),

    over_15_rate_difference: roundNumber(
      home.over_15_rate -
      away.over_15_rate
    ),

    over_25_rate_difference: roundNumber(
      home.over_25_rate -
      away.over_25_rate
    ),

    over_35_rate_difference: roundNumber(
      home.over_35_rate -
      away.over_35_rate
    ),

    recent_points_per_match_difference: roundNumber(
      home.recent_points_per_match -
      away.recent_points_per_match
    ),

    recent_win_rate_difference: roundNumber(
      home.recent_win_rate -
      away.recent_win_rate
    ),

    recent_goals_for_per_match_difference: roundNumber(
      home.recent_goals_for_per_match -
      away.recent_goals_for_per_match
    ),

    recent_goals_against_per_match_difference: roundNumber(
      home.recent_goals_against_per_match -
      away.recent_goals_against_per_match
    )
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==================================================
    // HOME
    // ==================================================
    if (url.pathname === "/") {
      return new Response("GoalPredict API is running.", {
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // ==================================================
    // TEST D1
    // ==================================================
    if (url.pathname === "/api/test-db") {
      try {
        if (!env.DB) {
          throw new Error("D1 binding DB is not configured");
        }

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

    // ==================================================
    // TEST FOOTBALL-DATA.ORG
    // ==================================================
    if (url.pathname === "/api/test-football") {
      try {
        const data = await footballDataFetch(
          "/competitions",
          env
        );

        return json({
          success: true,
          source: "football-data.org",
          count: data.competitions?.length || 0,
          competitions: data.competitions || []
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    // ==================================================
    // SYNC COMPETITIONS
    // ==================================================
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

    // ==================================================
    // SYNC TEAMS
    //
    // /api/sync-teams?competition=PL
    // ==================================================
    if (url.pathname === "/api/sync-teams") {
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
          `/competitions/${encodeURIComponent(
            competitionCode
          )}`,
          env
        );

        const currentSeason = data.currentSeason;

        if (!currentSeason?.id) {
          throw new Error(
            `No current season was returned for ${competitionCode}`
          );
        }

        const providerSeasonId = currentSeason.id;
        const startDate = currentSeason.startDate || null;
        const endDate = currentSeason.endDate || null;
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

        const providerIds = teams
          .map((team) => team.id)
          .filter(Boolean);

        let existingTeams = [];

        if (providerIds.length > 0) {
          const placeholders =
            providerIds.map(() => "?").join(",");

          existingTeams = await env.DB
            .prepare(`
              SELECT
                id,
                provider_id
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
          const slug = slugify(name);

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

        const refreshedTeams =
          providerIds.length > 0
            ? await env.DB
                .prepare(`
                  SELECT
                    id,
                    provider_id
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

    // ==================================================
    // SYNC MATCHES
    //
    // /api/sync-matches?competition=PL
    // ==================================================
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

        const footballUrl =
          `${API_BASE_URL}/competitions/${encodeURIComponent(
            competitionCode
          )}/matches`;

        const response = await fetch(
          footballUrl,
          {
            headers: {
              "X-Auth-Token":
                env.FOOTBALL_DATA_TOKEN,
              "Accept": "application/json"
            }
          }
        );

        if (!response.ok) {
          const errorText =
            await response.text();

          throw new Error(
            `football-data.org returned ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();
        const matches = data.matches || [];

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

        const validMatches = [];
        let skipped = 0;

        for (const match of matches) {
          const homeProviderId =
            match.homeTeam?.id;

          const awayProviderId =
            match.awayTeam?.id;

          const homeTeamId =
            teamMap.get(
              Number(homeProviderId)
            );

          const awayTeamId =
            teamMap.get(
              Number(awayProviderId)
            );

          if (!homeTeamId || !awayTeamId) {
            skipped++;
            continue;
          }

          const fullTime =
            match.score?.fullTime || {};

          validMatches.push({
            providerId: match.id,
            competitionId: competition.id,
            seasonId: season.id,
            matchday: match.matchday || null,
            homeTeamId,
            awayTeamId,
            kickoffAt: match.utcDate || null,
            status:
              match.status || "SCHEDULED",
            homeScore:
              fullTime.home ?? null,
            awayScore:
              fullTime.away ?? null,
            winner:
              match.score?.winner || null
          });
        }

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

        for (
          const match
          of existingMatches.results || []
        ) {
          existingMatchMap.set(
            Number(match.provider_id),
            Number(match.id)
          );
        }

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
            total_from_provider:
              matches.length,
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

    // ==================================================
    // SYNC STATISTICS + FORM
    //
    // /api/sync-statistics?competition=PL
    //
    // IMPORTANT:
    // This route uses D1 only.
    // It does not call football-data.org.
    // ==================================================
    if (url.pathname === "/api/sync-statistics") {
      try {
        if (!env.DB) {
          throw new Error(
            "D1 binding DB is not configured"
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

        const competition =
          await env.DB
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

        const season =
          await env.DB
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

        const teamsResult =
          await env.DB
            .prepare(`
              SELECT DISTINCT
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

        const teams =
          teamsResult.results || [];

        const matchesResult =
          await env.DB
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
                AND status = 'FINISHED'
                AND home_score IS NOT NULL
                AND away_score IS NOT NULL
              ORDER BY kickoff_at ASC
            `)
            .bind(
              competition.id,
              season.id
            )
            .all();

        const finishedMatches =
          matchesResult.results || [];

        const teamMatches = new Map();

        for (const team of teams) {
          teamMatches.set(
            Number(team.id),
            []
          );
        }

        for (const match of finishedMatches) {
          const homeTeamId =
            Number(match.home_team_id);

          const awayTeamId =
            Number(match.away_team_id);

          if (teamMatches.has(homeTeamId)) {
            teamMatches
              .get(homeTeamId)
              .push(match);
          }

          if (teamMatches.has(awayTeamId)) {
            teamMatches
              .get(awayTeamId)
              .push(match);
          }
        }

        const statisticsResult =
          await env.DB
            .prepare(`
              SELECT
                id,
                team_id
              FROM team_statistics
              WHERE competition_id = ?
                AND season_id = ?
            `)
            .bind(
              competition.id,
              season.id
            )
            .all();

        const statisticsMap = new Map();

        for (
          const row
          of statisticsResult.results || []
        ) {
          statisticsMap.set(
            Number(row.team_id),
            Number(row.id)
          );
        }

        const formResult =
          await env.DB
            .prepare(`
              SELECT
                id,
                team_id
              FROM team_form
              WHERE competition_id = ?
                AND season_id = ?
            `)
            .bind(
              competition.id,
              season.id
            )
            .all();

        const formMap = new Map();

        for (
          const row
          of formResult.results || []
        ) {
          formMap.set(
            Number(row.team_id),
            Number(row.id)
          );
        }

        const statisticsStatements = [];
        const formStatements = [];

        let statisticsCreated = 0;
        let statisticsUpdated = 0;
        let formCreated = 0;
        let formUpdated = 0;

        for (const team of teams) {
          const teamId =
            Number(team.id);

          const matches =
            teamMatches.get(teamId) || [];

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
              Number(match.home_team_id) ===
              teamId;

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
              goalsScored +
              goalsConceded;

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

          if (statisticsMap.has(teamId)) {
            statisticsStatements.push(
              env.DB
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
                  statisticsMap.get(teamId)
                )
            );

            statisticsUpdated++;
          } else {
            statisticsStatements.push(
              env.DB
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
                  VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                  )
                `)
                .bind(
                  teamId,
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
            );

            statisticsCreated++;
          }

          const recentMatches =
            [...matches]
              .sort(
                (a, b) =>
                  String(b.kickoff_at).localeCompare(
                    String(a.kickoff_at)
                  )
              )
              .slice(0, 5);

          const chronologicalMatches =
            [...recentMatches].reverse();

          let recentWins = 0;
          let recentDraws = 0;
          let recentLosses = 0;
          let recentGoalsFor = 0;
          let recentGoalsAgainst = 0;
          let recentPoints = 0;
          let formString = "";

          for (
            const match
            of chronologicalMatches
          ) {
            const isHome =
              Number(match.home_team_id) ===
              teamId;

            const goalsScored = isHome
              ? Number(match.home_score)
              : Number(match.away_score);

            const goalsConceded = isHome
              ? Number(match.away_score)
              : Number(match.home_score);

            recentGoalsFor +=
              goalsScored;

            recentGoalsAgainst +=
              goalsConceded;

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

          if (formMap.has(teamId)) {
            formStatements.push(
              env.DB
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
                  formMap.get(teamId)
                )
            );

            formUpdated++;
          } else {
            formStatements.push(
              env.DB
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
                  VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                  )
                `)
                .bind(
                  teamId,
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
            );

            formCreated++;
          }
        }

        const STAT_BATCH_SIZE = 20;

        for (
          let start = 0;
          start < statisticsStatements.length;
          start += STAT_BATCH_SIZE
        ) {
          const batch =
            statisticsStatements.slice(
              start,
              start + STAT_BATCH_SIZE
            );

          if (batch.length > 0) {
            await env.DB.batch(batch);
          }
        }

        for (
          let start = 0;
          start < formStatements.length;
          start += STAT_BATCH_SIZE
        ) {
          const batch =
            formStatements.slice(
              start,
              start + STAT_BATCH_SIZE
            );

          if (batch.length > 0) {
            await env.DB.batch(batch);
          }
        }

        const statisticsCount =
          await env.DB
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

        const formCount =
          await env.DB
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

        return json({
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
            name: season.name,
            year: String(
              season.start_date
            ).slice(0, 4)
          },
          matches: {
            finished_used_for_statistics:
              finishedMatches.length
          },
          teams: {
            processed: teams.length
          },
          statistics: {
            created: statisticsCreated,
            updated: statisticsUpdated,
            records_in_database:
              statisticsCount?.total || 0
          },
          form: {
            created: formCreated,
            updated: formUpdated,
            maximum_matches_per_team: 5,
            records_in_database:
              formCount?.total || 0
          }
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    // ==================================================
    // TEST PREDICTION FEATURES
    //
    // /api/test-features?match=11
    //
    // D1 ONLY.
    // This endpoint does not create predictions.
    // It only calculates and displays feature values.
    // ==================================================
    if (url.pathname === "/api/test-features") {
      try {
        if (!env.DB) {
          throw new Error(
            "D1 binding DB is not configured"
          );
        }

        const matchIdParam =
          url.searchParams.get("match");

        if (!matchIdParam) {
          return json(
            {
              success: false,
              message:
                "Missing match parameter. Example: ?match=11"
            },
            400
          );
        }

        const matchId =
          Number(matchIdParam);

        if (!Number.isInteger(matchId) || matchId <= 0) {
          return json(
            {
              success: false,
              message:
                "The match parameter must be a valid positive D1 match ID."
            },
            400
          );
        }

        // ------------------------------------------------
        // LOAD MATCH
        // ------------------------------------------------
        const match =
          await env.DB
            .prepare(`
              SELECT
                m.id,
                m.provider_id,
                m.competition_id,
                m.season_id,
                m.kickoff_at,
                m.status,
                m.home_team_id,
                m.away_team_id,
                home.name AS home_team_name,
                away.name AS away_team_name
              FROM matches m
              INNER JOIN teams home
                ON home.id = m.home_team_id
              INNER JOIN teams away
                ON away.id = m.away_team_id
              WHERE m.id = ?
            `)
            .bind(matchId)
            .first();

        if (!match) {
          return json(
            {
              success: false,
              message:
                `Match ${matchId} was not found in D1.`
            },
            404
          );
        }

        // ------------------------------------------------
        // LOAD HOME TEAM STATISTICS
        // ------------------------------------------------
        const homeStatistics =
          await env.DB
            .prepare(`
              SELECT
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
                over_35_matches
              FROM team_statistics
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
              LIMIT 1
            `)
            .bind(
              match.home_team_id,
              match.competition_id,
              match.season_id
            )
            .first();

        // ------------------------------------------------
        // LOAD AWAY TEAM STATISTICS
        // ------------------------------------------------
        const awayStatistics =
          await env.DB
            .prepare(`
              SELECT
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
                over_35_matches
              FROM team_statistics
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
              LIMIT 1
            `)
            .bind(
              match.away_team_id,
              match.competition_id,
              match.season_id
            )
            .first();

        // ------------------------------------------------
        // LOAD HOME TEAM FORM
        // ------------------------------------------------
        const homeForm =
          await env.DB
            .prepare(`
              SELECT
                matches_considered,
                wins,
                draws,
                losses,
                goals_for,
                goals_against,
                points,
                form_string
              FROM team_form
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
              LIMIT 1
            `)
            .bind(
              match.home_team_id,
              match.competition_id,
              match.season_id
            )
            .first();

        // ------------------------------------------------
        // LOAD AWAY TEAM FORM
        // ------------------------------------------------
        const awayForm =
          await env.DB
            .prepare(`
              SELECT
                matches_considered,
                wins,
                draws,
                losses,
                goals_for,
                goals_against,
                points,
                form_string
              FROM team_form
              WHERE team_id = ?
                AND competition_id = ?
                AND season_id = ?
              LIMIT 1
            `)
            .bind(
              match.away_team_id,
              match.competition_id,
              match.season_id
            )
            .first();

        if (!homeStatistics || !awayStatistics) {
          throw new Error(
            "Statistics are missing for one or both teams. Run /api/sync-statistics?competition=PL first."
          );
        }

        if (!homeForm || !awayForm) {
          throw new Error(
            "Form data is missing for one or both teams. Run /api/sync-statistics?competition=PL first."
          );
        }

        // ------------------------------------------------
        // BUILD FEATURES
        // ------------------------------------------------
        const homeFeatures =
          buildTeamFeatures(
            homeStatistics,
            homeForm
          );

        const awayFeatures =
          buildTeamFeatures(
            awayStatistics,
            awayForm
          );

        const comparison =
          compareFeatures(
            homeFeatures,
            awayFeatures
          );

        return json({
          success: true,
          source: "D1 statistics and form",
          prediction_generated: false,

          match: {
            id: Number(match.id),
            provider_id: Number(match.provider_id),
            competition_id: Number(
              match.competition_id
            ),
            season_id: Number(match.season_id),
            kickoff_at: match.kickoff_at,
            status: match.status,
            home_team: {
              id: Number(match.home_team_id),
              name: match.home_team_name
            },
            away_team: {
              id: Number(match.away_team_id),
              name: match.away_team_name
            }
          },

          home: {
            team: match.home_team_name,
            statistics: homeFeatures,
            form: {
              form_string:
                homeForm.form_string || ""
            }
          },

          away: {
            team: match.away_team_name,
            statistics: awayFeatures,
            form: {
              form_string:
                awayForm.form_string || ""
            }
          },

          comparison
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    // ==================================================
    // NOT FOUND
    // ==================================================
    return new Response("Not found", {
      status: 404
    });
  }
};
