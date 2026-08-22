/**
 * Company evidence profiles.
 *
 * Two of them, and the distinction matters commercially:
 *
 *  - SAMPLE_COMPANY is FICTIONAL. Use it for every demo shown to a prospect,
 *    because the prospect list for this product is other oil servicing firms.
 *  - PEGIS is built from https://pegisglobal.com, scraped 2026-08-03. Public
 *    marketing copy only. Use it ONLY when demoing to Pegis themselves. Showing
 *    one servicing firm's capability profile to a competitor ends the meeting,
 *    and Pegis's client list is exactly the sort of thing not to wave around.
 *
 * Every entry carries a `source` label because the matrix has to cite where its
 * evidence came from. In step 2 these are replaced by uploaded documents.
 */

export type Evidence = {
  /** Human-readable label shown in the matrix as the citation. */
  source: string;
  /** The fact itself, phrased as it would appear in a bid. */
  content: string;
};

export type CompanyProfile = {
  id: string;
  name: string;
  /** Shown under the picker so nobody demos the wrong profile by accident. */
  caution: string;
  evidence: Evidence[];
};

/**
 * Every fact below is INVENTED. The RC number, the certificate dates, the
 * project references and the man-hours are all made up, and the company does
 * not exist — that is the point, because the prospect list for this product is
 * other servicing firms and no real company's capability data may appear here.
 *
 * It is written as a plausible SLICKLINE contractor because the demo tender is
 * the Renaissance slickline advert (see sample-tender.ts). A profile and a
 * tender from different service lines makes an incoherent example: anyone in
 * this industry knows slickline is not wellhead fabrication, and the mismatch
 * reads as carelessness before the tool gets a chance to be judged.
 *
 * The MET / PARTIAL / GAP spread is deliberate, and the two PARTIALs are the
 * most valuable rows in the demo:
 *
 *  - NJQS registration covers Categories A, B and C; the tender asks for
 *    A, B, C, D and U. Right registration, short by two categories.
 *  - The slickline units are rated to 10,000 psi; Module 4 asks for 20,000 psi.
 *
 * Both are the kind of near-miss a human skim-reading at 11pm signs off as
 * "yes, we have that" — and both are disqualifying. Do not tidy them away.
 *
 * The genuine absences (Nigerian Content Execution Plan, organograms, NCEC
 * category SS, the OGTAN training undertaking, swamp barges, big bore) are
 * likewise deliberate: a real bidder often does have some of these and simply
 * has not filed them, which is exactly the conversation the gap list starts.
 */
export const SAMPLE_COMPANY: CompanyProfile = {
  id: "sample",
  name: "Delta Rivers Energy Services Limited",
  caution:
    "Fictional company, invented for demos — every figure here is made up. Safe to show to anyone.",
  evidence: [
    {
      source: "Corporate — CAC registration",
      content:
        "Incorporated in Nigeria with the Corporate Affairs Commission, RC 1094882, since 2011. Certified true copies of CAC forms 10, 02 and 07 on file, together with the memorandum and articles of association.",
    },
    {
      source: "Corporate — shareholding",
      content:
        "100% Nigerian shareholding, held by three Nigerian individuals. Ownership and shareholding structure filed with the Corporate Affairs Commission.",
    },
    {
      source: "Corporate — NipeX NJQS registration",
      content:
        "Registered and live on the NipeX Joint Qualification System under Product Code 3.04.20 Slickline Services, Categories A, B and C.",
    },
    {
      source: "Corporate — NCDMB",
      content:
        "Registered with the Nigerian Content Development and Monitoring Board; NOGIC JQS certificate current, expires 31 December 2026.",
    },
    {
      source: "Corporate — NUPRC permit",
      content:
        "Holds a valid NUPRC general purpose permit covering well intervention and slickline services, renewed annually.",
    },
    {
      source: "Quality — ISO certification",
      content:
        "ISO 9001:2015 certified for quality management. ISO 45001:2018 certified for occupational health and safety.",
    },
    {
      source: "HSE — safety record",
      content:
        "2,180,000 man-hours worked without Lost Time Injury as at June 2026. LTIF 0.00 over the last three years. HSE policy signed by the Managing Director and reviewed annually.",
    },
    {
      source: "HSE — training",
      content:
        "All field personnel hold current BOSIET and HUET certification. Twelve staff hold NEBOSH IGC.",
    },
    {
      source: "Personnel — key staff",
      content:
        "34 permanent staff. Operations Manager holds a B.Eng Mechanical Engineering with 18 years well intervention experience and COREN registration. Six slickline operators hold current well control certification.",
    },
    {
      source: "Personnel — Nigerian workforce",
      content:
        "97% of the total workforce are Nigerian nationals. Eight of the nine key management positions are held by Nigerians.",
    },
    {
      source: "Equipment — slickline units",
      content:
        "Owns four truck-mounted slickline units and two skid-mounted slickline units with dedicated power packs. All units are owned outright, not hired, and are based in Nigeria.",
    },
    {
      source: "Equipment — pressure rating",
      content:
        "Slickline units and pressure control equipment are rated to 10,000 psi working pressure, certified and recertified annually by an independent third party.",
    },
    {
      source: "Equipment — downhole tool inventory",
      content:
        "Maintains a downhole tool string inventory covering gauge cutters, bailers, Kinley callipers, and standard fishing tools for 2-3/8 in to 4-1/2 in completions.",
    },
    {
      source: "Facilities — in-country base",
      content:
        "Operates a workshop, tool store and redress facility at Trans-Amadi, Port Harcourt, Rivers State, with in-house machining capability for downhole spares.",
    },
    {
      source: "Experience — project reference 1",
      content:
        "Slickline campaign covering 46 well interventions for an indigenous E&P operator in OML 18, 2023-2024 — including SCSSV changeouts, gas lift valve changeouts and plug setting and pulling. Contract value N480 million. Completed on schedule with no HSE incidents.",
    },
    {
      source: "Experience — project reference 2",
      content:
        "Electronic BHP/BHT survey programme and wax cutting across 22 land wells for a marginal field operator in Delta State, 2022. Contract value N310 million.",
    },
    {
      source: "Financial — turnover",
      content:
        "Audited turnover of N1.42 billion in FY2025 and N1.08 billion in FY2024. Audited accounts available for the last three financial years.",
    },
    {
      source: "Financial — banking",
      content:
        "Banks with a tier-1 Nigerian commercial bank; reference letter available on request.",
    },
  ],
};

/**
 * Built entirely from the public website on 2026-08-03. Nothing here was
 * inferred, rounded or filled in — where the site is silent, there is no entry,
 * and the matrix will correctly report a GAP. That is the honest result and it
 * is the more useful one: the gaps are the sales conversation.
 */
export const PEGIS: CompanyProfile = {
  id: "pegis",
  name: "PEGIS Global Services Limited",
  caution:
    "Built from pegisglobal.com, public marketing copy only. Show this to Pegis — never to another servicing firm.",
  evidence: [
    {
      source: "Website — corporate registration",
      content:
        "PEGIS Global Services Limited, incorporated with the Corporate Affairs Commission, RC 1479740. Established 2018. Described as a 100% indigenous Nigerian company.",
    },
    {
      source: "Website — services offered",
      content:
        "Wellhead maintenance; well intervention services; mechanical construction and fabrication; onshore and offshore construction and installation; corrosion control and facility inspection; instrumentation and control; consultancy and training; procurement services; marine services; renewables; civil work.",
    },
    {
      source: "Website — regulatory registrations listed",
      content:
        "Lists association with NUPRC, NMDPRA, NCDMB, NIMASA, NIPEX, COREN, Bureau of Public Procurement, Federal Ministry of Environment, ISPON, PETAN, and Dun & Bradstreet.",
    },
    {
      source: "Website — quality and management standards",
      content:
        "States ISO 9001 (quality management) and ISO 14001 (environmental management).",
    },
    {
      source: "Website — HSE statement",
      content:
        "States 0 LTI. Quoted: \"Rigorous Health, Safety & Environment protocols embedded in every operation. Zero LTI is not a target; it is our standard.\"",
    },
    {
      source: "Website — clients named",
      content:
        "Names Chevron, NNPC, Seplat Energy, TotalEnergies, Heritage, GEIL, AMNI and Shell as clients.",
    },
    {
      source: "Website — experience",
      content:
        "Describes over 8 years of operation and 8 offices. States managers with 25+ years of oil and gas industry experience across the Niger Delta.",
    },
    {
      source: "Website — facilities",
      content:
        "Principal address No. 1 Fubara Lane, Trans-Amadi, Port Harcourt, Nigeria.",
    },
    {
      source: "Website — equipment (non-specific)",
      content:
        "States \"state-of-the-art equipment maintained to the highest international standards\". No equipment inventory is published.",
    },
  ],
};

export const PROFILES: CompanyProfile[] = [SAMPLE_COMPANY, PEGIS];

export function getProfile(id: string): CompanyProfile {
  return PROFILES.find((p) => p.id === id) ?? SAMPLE_COMPANY;
}
