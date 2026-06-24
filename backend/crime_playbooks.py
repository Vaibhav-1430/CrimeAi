"""Crime-type-specific investigative playbooks.

When the assistant grounds an answer in a specific FIR, we inject the relevant
playbook into the model's context so its reasoning follows established
investigative lines for that crime type (forensics, tracing, digital evidence,
etc.). This turns generic analysis into crime-specific intelligence.

The playbooks are guidance for the model — not facts — so they steer *how* it
reasons over the retrieved records, not *what* it claims happened.
"""

from __future__ import annotations

CRIME_PLAYBOOKS: dict[str, list[str]] = {
    "Drug Offences": [
        "Recommend forensic testing of seized substances (chemical assay, quantity/purity).",
        "Analyse the supply chain: source, couriers, distribution points, financial trail.",
        "Run repeat-offender checks on all suspects (prior drug FIRs, known networks).",
        "Recommend communication analysis (CDR/IPDR, messaging apps) for network mapping.",
        "Check for links to other drug FIRs in the same district (common suppliers).",
    ],
    "Theft": [
        "Recommend CCTV analysis at and around the scene and entry/exit routes.",
        "Initiate stolen-property tracing (serial numbers, pawn shops, online marketplaces).",
        "Detect repeat-theft patterns (same MO, locality, or suspect across recent FIRs).",
        "Check for fingerprints/forced-entry forensics if not already collected.",
    ],
    "Vehicle Theft": [
        "Issue alerts on vehicle registration/chassis/engine numbers across checkpoints.",
        "Recommend CCTV and toll/ANPR camera analysis along likely escape routes.",
        "Check chop-shop and resale networks; cross-reference recovered-parts records.",
        "Detect serial vehicle-theft patterns in the district.",
    ],
    "Cybercrime": [
        "Recommend IP tracking and ISP subscriber requests for the offending accounts.",
        "Initiate device forensics (seized phones/laptops) and preserve digital evidence.",
        "Recommend collection of transaction logs, UPI/bank trails, and chat exports.",
        "Advise on chain-of-custody for digital evidence and hash verification.",
        "Cross-reference with similar cyber FIRs (same modus, mule accounts, phishing kit).",
    ],
    "Fraud": [
        "Trace the financial flow (accounts, beneficiaries, withdrawal points).",
        "Collect documentary evidence (forged documents, agreements, communications).",
        "Identify other victims with the same modus operandi.",
        "Recommend forensic document examination where forgery is alleged.",
    ],
    "Robbery": [
        "Recommend CCTV analysis and witness canvassing near the scene.",
        "Trace stolen valuables and any weapon used (ballistics if firearm).",
        "Check for armed-robbery pattern links and known offender groups.",
    ],
    "Assault": [
        "Recommend medico-legal/injury report correlation with witness accounts.",
        "Identify and interview all bystander witnesses; secure CCTV.",
        "Assess motive (dispute history) and risk of escalation/retaliation.",
    ],
    "Murder": [
        "Prioritise forensic/post-mortem evidence and scene preservation.",
        "Establish timeline-of-death and last-seen movements; secure CCTV.",
        "Assess suspect risk (history of violence, flight risk) and motive.",
        "Recommend communication and financial analysis for premeditation.",
    ],
}


def playbook_for(crime_type: str) -> list[str]:
    return CRIME_PLAYBOOKS.get(crime_type, [])


def build_playbook_block(crime_types: list[str]) -> str:
    """Build a context block of investigative guidance for the given crime types."""
    seen: set[str] = set()
    lines: list[str] = []
    for ct in crime_types:
        if ct in seen:
            continue
        seen.add(ct)
        steps = playbook_for(ct)
        if steps:
            lines.append(f"### {ct} — standard investigative lines")
            lines.extend(f"- {s}" for s in steps)
    return "\n".join(lines)
