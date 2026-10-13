/**
 * Server entry for /. Check the invited user and authenticator session before
 * rendering the workspace. Pass permission flags to the browser; API routes independently
 * check permissions again because browser state cannot authorize server operations.
 */
import { redirect } from "next/navigation";
import { identity } from "@/lib/security/auth";
import { approvedForAI, permittedForAI } from "@/lib/security/config";
import { SecurityError } from "@/lib/security/errors";
import Home from "./tender-client";
export const dynamic = "force-dynamic";
// START HERE: Next.js maps src/app/page.tsx to the home URL (/).
// A component is a function returning a description of the screen, written in JSX
// (the HTML-like syntax below). This component runs on the server, where secrets
// and authentication checks belong. Home in tender-client.tsx handles interaction.
// async means this function can await work such as checking the user's identity.
// await pauses this function until that work completes, without freezing the browser.
export default async function Page() {
  let member;
  try {
    member = await identity();
  } catch (error) {
    if (error instanceof SecurityError && error.status === 503)
      return (
        <main className="p-10">
          <h1>Workspace setup required</h1>
          <p>
            Access is locked until your administrator configures the security
            services.
          </p>
        </main>
      );
    redirect("/login");
  }
  // Props are inputs passed from a parent component to a child: aiEnabled and
  // evaluation tell Home which controls to show. These booleans contain no secrets.
  // force-dynamic above means render for the current request instead of reusing a
  // prebuilt page. One person's authentication must never decide another person's view.
  return <Home aiEnabled={permittedForAI(member)} evaluation={!approvedForAI(member.tenantId) && permittedForAI(member)} />;
}
