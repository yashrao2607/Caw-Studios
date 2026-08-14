# Module 05 BUILD evidence — error envelope + request logging

## 1. Validation error (4xx safe envelope)
POST /links {"long_url":"not-a-url"} with JWT -> HTTP 400
{statusCode:400, error:"Bad Request", message:["long_url must be a valid lowercase http(s) URL..."], requestId:"0f27ea7b-...", path:"/links", timestamp}
No stack trace in response.

## 2. Unhandled server error (safe 500)
Temporary unhandled throw on /health -> HTTP 500
{statusCode:500, error:"Internal Server Error", message:"Internal server error", requestId:"ba491c92-...", path:"/health"}
No stack trace in response. Server log records the stack + requestId for debugging only.

## 3. Secrets/PII not logged (sentinel)
Request with Authorization: Bearer DO_NOT_LOG_ME_123 (401) -> grep over server logs: sentinel NOT FOUND
(pino redact paths req.headers.authorization, req.headers.cookie -> [REDACTED]).

## 4. Request logging fields
RequestLoggingInterceptor logs per request: requestId, route (METHOD url), statusCode, latencyMs.
Sample: "request completed {req:{method:GET,url:/r/q4CBGI,...}, requestId, responseTime, status:302}".
Error path logs requestId in "Request failed" / "Unhandled exception".

## Building blocks
- common/request-id.middleware.ts -> req.requestId (incoming x-request-id or randomUUID)
- common/all-exceptions.filter.ts -> maps HttpException + Prisma known/validation errors, 500 default, safe body, requestId always attached
- common/request-logging.interceptor.ts -> requestId, route, statusCode, latencyMs
- main.ts wires middleware before filter; pino redacts Authorization + Cookie; ValidationPipe whitelist + forbidNonWhitelisted