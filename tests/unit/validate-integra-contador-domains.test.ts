import { describe, expect, it } from "vitest";

import {
  REQUIRED_SECTIONS,
  validateDomainContract,
} from "../../scripts/validate-integra-contador-domains.mjs";

function validContract() {
  const sections = REQUIRED_SECTIONS.map(
    (heading) => `## ${heading}\n\nDefined ${heading.toLowerCase()} behavior.`,
  ).join("\n\n");

  return `---
contract_version: "1.0"
capability_key: "caixa_postal.new_message_indicator"
status: "approved"
---

# Fiscal Domain Contract: Caixa Postal Indicator

${sections}
`;
}

describe("Integra Contador domain contract validator", () => {
  it("accepts a complete versioned contract", () => {
    expect(validateDomainContract(validContract())).toEqual([]);
  });

  it("rejects missing and empty mandatory sections", () => {
    const invalid = validContract()
      .replace("## Security\n\nDefined security behavior.\n\n", "")
      .replace("## Tests\n\nDefined tests behavior.", "## Tests\n");

    expect(validateDomainContract(invalid)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing section '## Security'"),
        expect.stringContaining("section '## Tests' is empty"),
      ]),
    );
  });

  it("rejects invalid versions and unresolved template placeholders", () => {
    const invalid = validContract()
      .replace('contract_version: "1.0"', 'contract_version: "v1"')
      .replace(
        'capability_key: "caixa_postal.new_message_indicator"',
        'capability_key: "replace.with.capability"',
      );

    expect(validateDomainContract(invalid)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("contract_version must use MAJOR.MINOR"),
        expect.stringContaining("unresolved template placeholder"),
      ]),
    );
  });
});
