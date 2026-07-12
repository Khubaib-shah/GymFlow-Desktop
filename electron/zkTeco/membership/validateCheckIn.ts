export function validateCheckIn(member: any): { allowed: boolean; reason?: string } {
  if (!member) {
    return { allowed: false, reason: "Member not found" };
  }

  if (member.status !== "ACTIVE") {
    return { allowed: false, reason: `Member status is ${member.status}` };
  }

  if (!member.planId) {
    return { allowed: false, reason: "No active plan" };
  }

  if (member.membershipEnd) {
    const end = new Date(member.membershipEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { allowed: false, reason: "Membership expired" };
    }
  }

  return { allowed: true };
}
