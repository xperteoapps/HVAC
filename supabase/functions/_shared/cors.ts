// Wspólne nagłówki CORS i pomocnicze odpowiedzi JSON dla Edge Functions.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Zwraca odpowiedź na preflight (OPTIONS) albo null, gdy to zwykłe żądanie. */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code?: string,
): Response {
  return jsonResponse({ error: { message, code: code ?? statusCode(status) } }, status);
}

/** Błąd z kodem HTTP — rzucany w handlerach, zamieniany na errorResponse w catch. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? statusCode(status);
  }
}

/** Mapuje dowolny wyjątek na odpowiedź JSON (komunikaty po polsku; szczegóły tylko w logach). */
export function errorToResponse(err: unknown, context: string): Response {
  if (err instanceof HttpError) {
    return errorResponse(err.message, err.status, err.code);
  }
  console.error(`[${context}] nieoczekiwany błąd:`, err);
  return errorResponse(
    "Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.",
    500,
    "INTERNAL",
  );
}

/** Parsuje body JSON; rzuca HttpError 400 przy błędnym JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Nieprawidłowe body żądania (oczekiwano JSON).", "BAD_JSON");
  }
}

function statusCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 409:
      return "CONFLICT";
    case 501:
      return "NOT_IMPLEMENTED";
    default:
      return status >= 500 ? "INTERNAL" : "ERROR";
  }
}
