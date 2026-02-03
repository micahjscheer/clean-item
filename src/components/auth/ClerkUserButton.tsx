import { UserButton } from "@clerk/clerk-react";

const userButtonAppearance = {
  elements: {
    avatarBox: "w-8 h-8 border border-[var(--color-border)]",
  },
};

export function ClerkUserButton() {
  return <UserButton appearance={userButtonAppearance} />;
}
