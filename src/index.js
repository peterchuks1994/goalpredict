export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test-football") {
      try {
        const response = await fetch(
          "https://api.football-data.org/v4/competitions",
          {
            headers: {
              "X-Auth-Token": env.FOOTBALL_DATA_TOKEN
            }
          }
        );

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              status: response.status,
              message: "Football data API request failed"
            }),
            {
              status: 502,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        }

        const data = await response.json();

        return new Response(
          JSON.stringify({
            success: true,
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
            message: "Unable to connect to football-data.org"
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

    return new Response("GoalPredict API is running.");
  }
};
