import { AppShell } from "@/components/layout/AppShell";
import { ProfileSettings } from "@/features/profile/ProfileSettings";

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileSettings />
    </AppShell>
  );
}
