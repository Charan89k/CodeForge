import type { Metadata } from "next";

import { StatusScreen } from "@/components/common/status-screen";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false },
};

export default function AccountDeletedPage() {
  return (
    <StatusScreen
      title="Your account has been deleted"
      description="Your account and its data have been removed from the live system. Any backup copies last until those backups expire."
      primary={{ label: "Go to the home page", href: "/" }}
    />
  );
}
