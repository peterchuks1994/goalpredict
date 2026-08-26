import { footballDataFetch } from "./football-data.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("GoalPredict API is running.", {
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    if (url.pathname === "/api/test-football") {
      try {
        const data = await footballDataFetch(
          "/competitions",
          env
        );

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
