export default {
  async fetch(request, env) {
    return new Response("GoalPredict is coming soon.", {
      headers: {
        "content-type": "text/plain; charset=UTF-8"
      }
    });
  }
};
