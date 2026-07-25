/**
 * Shared WhatsApp URL builder for member communications.
 * Only returns a URL when there's something important to communicate.
 */

export function buildWhatsAppUrl(member: any): string | null {
    if (!member.phone) return null;
    // Never show WhatsApp for suspended members (2+ months expired, no template)
    if (member.status === "SUSPENDED") return null;

    // Convert PK phone: strip dashes, replace leading 0 with 92
    const digits = member.phone.replace(/-/g, "");
    const intl = digits.startsWith("0") ? "92" + digits.slice(1) : digits;

    const name = `${member.firstName} ${member.lastName || ""}`.trim();
    const expiryDate = member.membershipEnd
        ? new Date(member.membershipEnd).toLocaleDateString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = member.membershipEnd
        ? Math.ceil(
            (new Date(member.membershipEnd).getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        )
        : null;

    let message = "";

    if (member.status === "LEAD") {
        // Template: Lead follow-up
        message = `Hi ${name}! Thanks for your interest in Workout. We'd love to welcome you to our gym.  Reply to this message or visit us to explore our membership plans and get started!`;
    } else if (member.status === 'ACTIVE' && daysLeft === 1) {
        // Template: Active members expiring in 1 day
        message = `Hi ${name}, your membership expires on ${expiryDate}. You have ${daysLeft} day left. Renew now to keep training without interruption. `;
    } else if (member.status === "EXPIRED") {
        const daysSinceExpiry = daysLeft !== null ? Math.abs(daysLeft) : 999;
        if (daysSinceExpiry <= 15) {
            // Template: Expired ≤15 days ago — come back message
            message = `Hi ${name}, your membership expired on ${expiryDate}. We'd love to have you back! Renew today and continue your fitness journey with Workout. `;
        } else {
            // Template: Expired >15 days — 2-month admission deadline warning
            const twoMonthDeadline = new Date(member.membershipEnd);
            twoMonthDeadline.setMonth(twoMonthDeadline.getMonth() + 2);
            const deadlineDate = twoMonthDeadline.toLocaleDateString("en-PK", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
            message = `Hi ${name}, your membership expired on ${expiryDate}. Please renew before ${deadlineDate} to keep your admission active and avoid paying the admission fee again.`;
        }
    } else {
        // No WhatsApp message for:
        // - ACTIVE members with > 1 day left (or 0 days left, as requested)
        // - INACTIVE members
        // - SUSPENDED members
        // - Members without a valid expiry date
        return null;
    }

    return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}