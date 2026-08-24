import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <SignUp appearance={clerkAppearance} />
    </main>
  );
}
