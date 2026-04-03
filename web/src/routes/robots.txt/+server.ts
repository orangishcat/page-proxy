import { buildRobotsTxt } from "$lib/seo";

export const prerender = true;

export function GET() {
  return new Response(buildRobotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
