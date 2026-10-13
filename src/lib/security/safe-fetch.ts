/**
 * Restricted server-side website reader. Exact HTTPS host allowlisting and public-IP
 * checks prevent fetching internal services. Pin the validated DNS address to the actual
 * connection; reject redirects, compressed/non-text responses, and oversized or slow pages.
 */
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { SecurityError } from "./errors";

export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

export function allowedWebsite(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.startsWith("https://") ? raw : `https://${raw}`);
  } catch {
    throw new SecurityError(
      400,
      "website",
      "Enter an approved HTTPS website address.",
    );
  }
  const hosts = (process.env.WEBSITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.search ||
    ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, "")) ||
    !hosts.includes(url.hostname)
  )
    throw new SecurityError(
      403,
      "website_not_approved",
      "This website is not approved. Ask your administrator to allow its exact hostname.",
    );
  return url;
}

// DNS translates a hostname into IP addresses. Server-side request forgery
// (SSRF) happens when an attacker makes the app fetch internal services. Check every
// resolved address, then connect to the checked address rather than resolving again.
// Promise.race waits for whichever finishes first: DNS lookup or a timeout rejection.
export async function safeWebsiteText(raw: string): Promise<string> {
  const url = allowedWebsite(raw);
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error("DNS timeout")), 5000);
      t.unref();
    }),
  ]);
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new SecurityError(
      403,
      "private_address",
      "This website resolves to a restricted network address.",
    );
  const selected = addresses[0];
  // Pin the validated address in the connection itself; no second DNS lookup.
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        servername: url.hostname,
        family: selected.family,
        lookup: (_host, _options, callback) =>
          callback(null, selected.address, selected.family),
        headers: {
          Accept: "text/html,text/plain",
          "Accept-Encoding": "identity",
          "User-Agent": "TenderEvidenceReader/1.0",
        },
      },
      (res) => {
        const fail = (message: string) => {
          res.destroy();
          reject(new SecurityError(422, "website_response", message));
        };
        if (res.statusCode !== 200)
          return fail(
            "The website could not be read. Redirects are disabled; use its final HTTPS address.",
          );
        if (
          !/^(text\/html|text\/plain)(;|$)/i.test(
            res.headers["content-type"] ?? "",
          )
        )
          return fail("The website did not return an HTML or text page.");
        if (
          res.headers["content-encoding"] &&
          res.headers["content-encoding"] !== "identity"
        )
          return fail("Compressed website responses are not accepted.");
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1_000_000)
            return fail("This web page exceeds the reading limit.");
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Website timeout")),
      12_000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
