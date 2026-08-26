const API_BASE_URL = "https://api.football-data.org/v4";

export async function footballDataFetch(path, env) {
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
