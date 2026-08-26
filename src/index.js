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

    return new Response("Not found", {
      status: 404
    });
  }
};
