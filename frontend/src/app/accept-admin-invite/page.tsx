import { AcceptAdministratorInvite } from "@/components/accept-administrator-invite";

export default async function AcceptAdminInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <AcceptAdministratorInvite token={token} />;
}
