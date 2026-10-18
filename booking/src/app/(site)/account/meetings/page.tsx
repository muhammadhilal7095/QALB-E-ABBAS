import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AccountNav from "@/components/AccountNav";
import MeetingList from "@/components/MeetingList";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Meetings" };

export default async function Meetings() {
  const user = await requireUser(["CLIENT"]);
  const bookings = await prisma.booking.findMany({ where: { client: { userId: user.id } }, include: { service: true }, orderBy: { startAt: "desc" } });
  return (
    <div className="container-x py-10">
      <AccountNav active="/account/meetings" name={user.name} />
      <MeetingList bookings={bookings} empty="You haven't booked any meetings yet." />
    </div>
  );
}
