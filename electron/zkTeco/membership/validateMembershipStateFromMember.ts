export type MembershipValidationState =
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "FROZEN"
  | "PENDING"
  | "BLOCKED"
  | "UNKNOWN";

// Map Prisma member.status + membershipEnd rules into integration states.
export function validateMembershipStateFromMember(
  member: any,
): MembershipValidationState {
  const status: string = String(member?.status ?? "UNKNOWN").toUpperCase();

  if (!member) return "UNKNOWN";

  // Existing DB uses: ACTIVE, EXPIRED, INACTIVE, SUSPENDED, (maybe others)
  if (status === "ACTIVE") {
    // If membershipEnd passed, treat as EXPIRED
    if (member.membershipEnd) {
      const end = new Date(member.membershipEnd);
      if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
        return "EXPIRED";
      }
    }
    return "ACTIVE";
  }

  if (status === "EXPIRED") return "EXPIRED";
  if (status === "SUSPENDED") return "SUSPENDED";

  // Not in schema today, but we keep forward-compat with spec
  if (status === "FROZEN") return "FROZEN";
  if (status === "PENDING") return "PENDING";
  if (status === "INACTIVE") return "BLOCKED";

  return "BLOCKED";
}
