import type { Metadata } from "next";
import { LegalPage } from "@/app/_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — DTLAHappening",
  description: "How DTLAHappening handles location, passport, submission and diagnostic data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Your night, not a tracking profile"
      title="Privacy policy"
      intro="DTLAHappening is built to help people explore Downtown Los Angeles without turning a night out into a detailed record of who they are or everywhere they went."
    >
      <section>
        <h2>What this policy covers</h2>
        <p>
          This policy covers the DTLAHappening mobile app and website. It explains what information
          we process, why we process it, where it is stored, and the choices available to you.
        </p>
      </section>

      <section>
        <h2>Information you choose to provide</h2>
        <ul>
          <li>
            <strong>Artist submissions:</strong> name, email, phone number, mailing address, social
            and website information, selected media, portfolio images, artwork details and your
            consent to receive submission updates.
          </li>
          <li>
            <strong>Accounts and organizer tools:</strong> account identifiers and contact details
            when you choose to sign in or manage a participating organization.
          </li>
          <li>
            <strong>Ticket orders, when ticketing is offered:</strong> purchaser contact details,
            order contents and fulfilment status. Payment-card details are entered with and handled
            by Stripe; DTLAHappening does not receive the full card number.
          </li>
          <li>
            <strong>Support:</strong> the email address and information you include when contacting
            us.
          </li>
        </ul>
      </section>

      <section>
        <h2>Location and passport stamps</h2>
        <p>
          If you grant location permission, the mobile app uses your current coordinates on the
          device to show your position, sort nearby venues and decide whether a passport stamp can
          be marked as location-verified. DTLAHappening does not send your coordinates to its
          server.
        </p>
        <p>
          A passport stamp is saved on your device first. To produce privacy-preserving venue
          attendance counts, the app may report a random per-install identifier, venue, Art Night,
          stamp time and a yes/no location-verification result. The report contains no name,
          contact detail or coordinates. Reinstalling the app creates a new identifier.
        </p>
        <p>
          Apple supplies the map on iOS and may process map or device information under Apple&apos;s
          own terms and privacy policy.
        </p>
      </section>

      <section>
        <h2>Information kept only on your device</h2>
        <p>
          Saved venues, your selected profile type and your visible passport are stored locally.
          Removing a stamp removes it from your device and from any report still waiting to sync.
          Deleting the app removes its local data, subject to the device platform&apos;s backup behavior.
        </p>
      </section>

      <section>
        <h2>Diagnostics and ordinary service logs</h2>
        <p>
          Our hosting providers process ordinary request information such as IP address, request
          time, route and response status to operate and protect the service. When diagnostic
          reporting is enabled, Sentry may receive crash stack traces, app version, device model,
          operating-system version, route and similar technical context. We do not intentionally
          attach precise location, artwork, submission fields or contact details to diagnostic
          events.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <ul>
          <li>Provide the venue directory, map, passport, submissions and optional ticketing.</li>
          <li>Send requested operational messages and respond to support questions.</li>
          <li>Measure aggregate venue attendance and improve route planning.</li>
          <li>Protect the service, diagnose failures and prevent abuse.</li>
          <li>Meet legal, accounting and security obligations.</li>
        </ul>
        <p>We do not sell personal information or use it for cross-app advertising.</p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>
          We use service providers only to run the product: Vercel for application hosting,
          Supabase for database and submission-image storage, Clerk for optional accounts, Stripe
          for payments, Resend for email, Sentry for diagnostics when configured, and Apple for
          maps on iOS. They process information under their own agreements and policies.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          We keep information only while it is reasonably needed for the purpose described above,
          to resolve disputes, maintain security, or satisfy legal and accounting obligations.
          Submission records may be retained through the review and placement process and then as
          an operational archive. Order records may be retained where tax, accounting or fraud
          rules require it. Diagnostic events follow the retention configured with the diagnostic
          provider. Anonymous check-in records may be aggregated before raw records are deleted.
        </p>
        <p>
          You may request access, correction or deletion by emailing the address below. Include
          enough information for us to locate the record. Anonymous passport reports cannot always
          be connected back to you because the identifier is deliberately not tied to your identity.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          People of all ages may browse public Art Night information. Artist submissions, organizer
          tools and purchases are not directed to children under 13. A parent or guardian who
          believes a child provided personal information may contact us to request deletion.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy as the product changes. The effective date above identifies the
          current version. Questions and privacy requests can be sent to{" "}
          <a href="mailto:info@dtlaartnight.com">info@dtlaartnight.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
