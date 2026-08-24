import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <SignIn appearance={clerkAppearance} />
    </main>
  );
}
