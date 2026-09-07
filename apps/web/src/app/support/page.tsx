import type { Metadata } from "next";
import { LegalPage } from "@/app/_components/legal-page";

export const metadata: Metadata = {
  title: "Support — DTLAHappening",
  description: "Get help with DTLAHappening, Art Night listings, passports and submissions.",
};

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="Help from a person"
      title="Support"
      intro="Tell us what happened, which screen you were on, and the venue or submission involved. Never email a password, access token or full payment-card number."
    >
      <section>
        <h2>Contact</h2>
        <p>
          Email <a href="mailto:info@dtlaartnight.com">info@dtlaartnight.com</a>. Include
          “DTLAHappening support” in the subject so the message reaches the right person.
        </p>
      </section>

      <section>
        <h2>Map or venue information</h2>
        <p>
          Send the venue name and the detail that appears wrong. The participating-venue directory
          changes monthly, so corrections are reviewed against the organizers&apos; current map before
          publication.
        </p>
      </section>

      <section>
        <h2>Passport</h2>
        <p>
          Passport stamps are saved on the device and work without signal. If a location check is
          inaccurate inside a building, the app can record an unverified stamp. Reinstalling the app
          removes the local passport and creates a new anonymous device identifier.
        </p>
      </section>

      <section>
        <h2>Artist submissions</h2>
        <p>
          If an upload or submission fails, keep the original images and contact support before
          submitting repeatedly. Include the artist name and approximate submission time, but do
          not attach sensitive documents unless support asks for them through an approved channel.
        </p>
      </section>

      <section>
        <h2>Privacy requests</h2>
        <p>
          Use the contact address above to request access, correction or deletion. State the email
          address used for the relevant account, order or submission so we can verify and locate the
          record. Anonymous passport analytics may not be linkable to a person by design.
        </p>
      </section>
    </LegalPage>
  );
}
