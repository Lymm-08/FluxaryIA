const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(access_token|refresh_token|password|service_role|anon_key|api_key)\b\s*[:=]\s*["']?[^,\s;"']+/gi,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

export function formatErrorDetails(reason: unknown, fallback: string): string {
  const error = isRecord(reason) ? reason : undefined;
  const values = error
    ? ["message", "code", "details", "hint"].flatMap((key) => {
      const value = error[key];
      return typeof value === "string" && value.trim() ? [`${key === "message" ? "" : `${key}: `}${value.trim()}`] : [];
    })
    : [];
  const detail = values.length
    ? values.join(" · ")
    : reason instanceof Error && reason.message.trim()
      ? reason.message.trim()
      : fallback;

  return SECRET_PATTERNS.reduce((message, pattern) => message.replace(pattern, "[redigido]"), detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
