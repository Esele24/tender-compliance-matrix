/**
 * Shared company data contract. Evidence pairs a source label with its text; a profile
 * groups that evidence under a company name. Only the fictional sample is bundled.
 * Custom profiles are constructed on the server and carry an optional integrity proof.
 */
export type Evidence = {
  /** Human-readable label shown in the matrix as the citation. */
  source: string;
  /** The fact itself, phrased as it would appear in a bid. */
  content: string;
};

// A company profile is a plain object, not a database record automatically.
// id identifies it; name is its display label; caution explains evidence limits.
// evidence is a list of {source, content} objects. proof? means proof is optional:
// server-built custom profiles receive a signature, while the fictional sample does not.
export type CompanyProfile = {
  proof?: string;
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

/** Picker entries are bundled demo profiles; custom evidence is handled separately. */
export const PROFILES:CompanyProfile[]=[SAMPLE_COMPANY];
export function getProfile(id:string):CompanyProfile{return PROFILES.find(p=>p.id===id)??SAMPLE_COMPANY;}
