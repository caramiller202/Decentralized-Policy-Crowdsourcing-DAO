import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, listCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_TITLE = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_INVALID_CATEGORY = 103;
const ERR_INVALID_TAGS = 104;
const ERR_INVALID_VOTING_DEADLINE = 105;
const ERR_PROPOSAL_ALREADY_EXISTS = 106;
const ERR_PROPOSAL_NOT_FOUND = 107;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_MIN_VOTES = 110;
const ERR_INVALID_QUORUM = 111;
const ERR_MAX_PROPOSALS_EXCEEDED = 114;
const ERR_INVALID_PROPOSAL_TYPE = 115;
const ERR_INVALID_IMPACT_RATING = 116;
const ERR_INVALID_BUDGET_REQUEST = 117;
const ERR_INVALID_LOCATION = 118;

interface Proposal {
  title: string;
  description: string;
  category: string;
  tags: string[];
  votingDeadline: number;
  minVotes: number;
  quorum: number;
  timestamp: number;
  creator: string;
  proposalType: string;
  impactRating: number;
  budgetRequest: number;
  location: string;
  status: boolean;
}

interface ProposalUpdate {
  updateTitle: string;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProposalFactoryMock {
  state: {
    nextProposalId: number;
    maxProposals: number;
    creationFee: number;
    authorityContract: string | null;
    proposals: Map<number, Proposal>;
    proposalUpdates: Map<number, ProposalUpdate>;
    proposalsByTitle: Map<string, number>;
  } = {
    nextProposalId: 0,
    maxProposals: 1000,
    creationFee: 1000,
    authorityContract: null,
    proposals: new Map(),
    proposalUpdates: new Map(),
    proposalsByTitle: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProposalId: 0,
      maxProposals: 1000,
      creationFee: 1000,
      authorityContract: null,
      proposals: new Map(),
      proposalUpdates: new Map(),
      proposalsByTitle: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createProposal(
    title: string,
    description: string,
    category: string,
    tags: string[],
    votingDeadline: number,
    minVotes: number,
    quorum: number,
    proposalType: string,
    impactRating: number,
    budgetRequest: number,
    location: string
  ): Result<number> {
    if (this.state.nextProposalId >= this.state.maxProposals) return { ok: false, value: ERR_MAX_PROPOSALS_EXCEEDED };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!category || category.length > 50) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (tags.length > 10 || tags.some(tag => !tag || tag.length > 20)) return { ok: false, value: ERR_INVALID_TAGS };
    if (votingDeadline <= this.blockHeight) return { ok: false, value: ERR_INVALID_VOTING_DEADLINE };
    if (minVotes <= 0) return { ok: false, value: ERR_INVALID_MIN_VOTES };
    if (quorum <= 0 || quorum > 100) return { ok: false, value: ERR_INVALID_QUORUM };
    if (!["policy", "funding", "governance"].includes(proposalType)) return { ok: false, value: ERR_INVALID_PROPOSAL_TYPE };
    if (impactRating > 10) return { ok: false, value: ERR_INVALID_IMPACT_RATING };
    if (budgetRequest < 0) return { ok: false, value: ERR_INVALID_BUDGET_REQUEST };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (this.state.proposalsByTitle.has(title)) return { ok: false, value: ERR_PROPOSAL_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextProposalId;
    const proposal: Proposal = {
      title,
      description,
      category,
      tags,
      votingDeadline,
      minVotes,
      quorum,
      timestamp: this.blockHeight,
      creator: this.caller,
      proposalType,
      impactRating,
      budgetRequest,
      location,
      status: true,
    };
    this.state.proposals.set(id, proposal);
    this.state.proposalsByTitle.set(title, id);
    this.state.nextProposalId++;
    return { ok: true, value: id };
  }

  getProposal(id: number): Proposal | null {
    return this.state.proposals.get(id) || null;
  }

  updateProposal(id: number, updateTitle: string, updateDescription: string): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.creator !== this.caller) return { ok: false, value: false };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: false };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: false };
    if (this.state.proposalsByTitle.has(updateTitle) && this.state.proposalsByTitle.get(updateTitle) !== id) {
      return { ok: false, value: false };
    }

    const updated: Proposal = {
      ...proposal,
      title: updateTitle,
      description: updateDescription,
      timestamp: this.blockHeight,
    };
    this.state.proposals.set(id, updated);
    this.state.proposalsByTitle.delete(proposal.title);
    this.state.proposalsByTitle.set(updateTitle, id);
    this.state.proposalUpdates.set(id, {
      updateTitle,
      updateDescription,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getProposalCount(): Result<number> {
    return { ok: true, value: this.state.nextProposalId };
  }

  checkProposalExistence(title: string): Result<boolean> {
    return { ok: true, value: this.state.proposalsByTitle.has(title) };
  }
}

describe("ProposalFactory", () => {
  let contract: ProposalFactoryMock;

  beforeEach(() => {
    contract = new ProposalFactoryMock();
    contract.reset();
  });

  it("creates a proposal successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const proposal = contract.getProposal(0);
    expect(proposal?.title).toBe("Green Energy");
    expect(proposal?.description).toBe("Promote solar panel installation");
    expect(proposal?.category).toBe("Environment");
    expect(proposal?.tags).toEqual(["solar", "renewable"]);
    expect(proposal?.votingDeadline).toBe(100);
    expect(proposal?.minVotes).toBe(50);
    expect(proposal?.quorum).toBe(75);
    expect(proposal?.proposalType).toBe("policy");
    expect(proposal?.impactRating).toBe(8);
    expect(proposal?.budgetRequest).toBe(1000);
    expect(proposal?.location).toBe("CityX");
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate proposal titles", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    const result = contract.createProposal(
      "Green Energy",
      "Different description",
      "Health",
      ["healthcare"],
      200,
      100,
      80,
      "funding",
      5,
      2000,
      "CityY"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_ALREADY_EXISTS);
  });

  it("rejects invalid title", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createProposal(
      "",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects invalid voting deadline", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.blockHeight = 100;
    const result = contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      50,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VOTING_DEADLINE);
  });

  it("updates a proposal successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    const result = contract.updateProposal(0, "Updated Energy", "New solar initiative");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.title).toBe("Updated Energy");
    expect(proposal?.description).toBe("New solar initiative");
    const update = contract.state.proposalUpdates.get(0);
    expect(update?.updateTitle).toBe("Updated Energy");
    expect(update?.updateDescription).toBe("New solar initiative");
  });

  it("rejects update for non-existent proposal", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateProposal(99, "Updated Energy", "New solar initiative");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateProposal(0, "Updated Energy", "New solar initiative");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(2000);
  });

  it("checks proposal existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createProposal(
      "Green Energy",
      "Promote solar panel installation",
      "Environment",
      ["solar", "renewable"],
      100,
      50,
      75,
      "policy",
      8,
      1000,
      "CityX"
    );
    const result = contract.checkProposalExistence("Green Energy");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProposalExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses Clarity types correctly", () => {
    const title = stringUtf8CV("Green Energy");
    const votingDeadline = uintCV(100);
    const tags = listCV(["solar", "renewable"].map(t => stringUtf8CV(t)));
    expect(title.value).toBe("Green Energy");
    expect(votingDeadline.value).toEqual(BigInt(100));
    expect(tags.value.map((t: any) => t.value)).toEqual(["solar", "renewable"]);
  });

});