import { parse } from "cookie";

function getCookies(request: Request) {
  return parse(request.headers.get("Cookie") ?? "");
}

export { getCookies };
