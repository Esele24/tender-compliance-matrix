/**
 * A finished matrix, pre-computed and shipped with the app.
 *
 * WHY THIS EXISTS: the page used to open on an empty form — a dropdown and a
 * blank box — so a first-time visitor saw a tool with nothing in it and no
 * indication of what to do first. (Verbatim feedback, 2026-08-22: "there are no
 * documents to see there. Seems you have not loaded any document.") The fix is
 * to land on a worked example instead of an invitation to work.
 *
 * WHY IT IS A FILE AND NOT AN API CALL ON LOAD: every visitor would otherwise
 * spend a Gemini call before touching anything, and the free tier on this key is
 * roughly twenty requests. A demo that burns its own quota on people who are
 * only looking is a demo that is broken by the time the buyer opens it. This
 * renders instantly, offline, and costs nothing.
 *
 * HOW IT WAS PRODUCED: SAMPLE_TENDER was posted to the real /api/analyse route
 * against the `sample` profile — the same code path a live run takes — and the
 * response was saved verbatim to example-matrix.json. It is not hand-written,
 * so it cannot flatter the product. Regenerate it if the sample tender or the
 * sample company profile changes, or the example stops matching what the page
 * says it is.
 *
 * Generated 2026-08-22 · the real Renaissance slickline advert (CW67348) against
 * the fictional Delta Rivers profile · 48 requirements · 28 MET / 4 PARTIAL /
 * 16 GAP, of which 7 mandatory.
 */

import raw from "./example-matrix.json";
import type { MatrixResult } from "./matrix";
import { SAMPLE_COMPANY } from "./company";

/** The JSON is untyped on import; this asserts it into the shape the UI reads. */
export const EXAMPLE_MATRIX = raw as MatrixResult;

/** The profile the example was run against — must stay the page's initial pick. */
export const EXAMPLE_PROFILE_ID = SAMPLE_COMPANY.id;
