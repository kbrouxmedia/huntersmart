import { NextRequest } from "next/server";
import { runAgent14 } from "@/lib/agents/agent14";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return new Response(
      JSON.stringify({ success: false, error: "Se requiere el campo 'query'" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode("data: searching\n\n"));
        const leads = await runAgent14(query);
        const payload = JSON.stringify({ success: true, leads, count: leads.length });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        const payload = JSON.stringify({ success: false, error: message });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
