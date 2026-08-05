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

export const SAMPLE_COMPANY: CompanyProfile = {
  id: "sample",
  name: "Delta Rivers Energy Services Limited",
  caution:
    "Fictional company, invented for demos. Safe to show to anyone.",
  evidence: [
    {
      source: "Corporate — CAC registration",
      content:
        "Incorporated in Nigeria with the Corporate Affairs Commission, RC 1094882, since 2011. Wholly Nigerian-owned indigenous company.",
    },
    {
      source: "Corporate — NCDMB",
      content:
        "Registered with the Nigerian Content Development and Monitoring Board; NOGIC JQS certificate current, expires 31 December 2026.",
    },
    {
      source: "Corporate — NUPRC permit",
      content:
        "Holds a valid NUPRC general purpose permit for wellhead maintenance and intervention services, renewed annually.",
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
        "34 permanent staff. Operations Manager holds a B.Eng Mechanical Engineering with 18 years wellhead experience and COREN registration. Two lead technicians hold City & Guilds certification.",
    },
    {
      source: "Equipment — register",
      content:
        "Owns two wireline units, one hydraulic workover unit, a 30-tonne crane, and a fabrication yard at Trans-Amadi, Port Harcourt with certified welding bays.",
    },
    {
      source: "Experience — project reference 1",
      content:
        "Wellhead maintenance across 14 land wells for an indigenous E&P operator in OML 18, 2023-2024. Contract value N480 million. Completed on schedule with no HSE incidents.",
    },
    {
      source: "Experience — project reference 2",
      content:
        "Fabrication and installation of production manifolds for a marginal field operator in Delta State, 2022. Contract value N310 million.",
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
    {
      source: "Local content — Nigerian content plan",
      content:
        "97% of workforce are Nigerian nationals. Nigerian Content Plan filed with NCDMB covering employment, training and technology transfer commitments.",
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
