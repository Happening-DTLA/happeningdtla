import type { Metadata } from "next";
import { LegalPage } from "@/app/_components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — DTLAHappening",
  description: "Terms for using the DTLAHappening app and website.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="The practical agreement"
      title="Terms of use"
      intro="These terms govern use of the DTLAHappening mobile app and website. By using the service, you agree to them."
    >
      <section>
        <h2>What DTLAHappening provides</h2>
        <p>
          DTLAHappening provides an Art Night venue directory, maps, personal passport tools,
          artist-submission tools and, when enabled, event ticketing. Venue schedules, admission
          rules, accessibility, artwork and other details may change. Check important details with
          the participating venue before relying on them.
        </p>
      </section>

      <section>
        <h2>Walking Downtown</h2>
        <p>
          Maps, distances and location checks are aids, not turn-by-turn safety instructions.
          Remain aware of traffic, closures, private property and your surroundings. Do not use the
          app in a way that distracts you while crossing streets or operating a vehicle.
        </p>
      </section>

      <section>
        <h2>Accounts and acceptable use</h2>
        <p>
          Browsing and the local passport do not require an account. If you create an account, you
          are responsible for its security and for activity performed through it. Do not interfere
          with the service, probe private systems, impersonate another person, submit unlawful or
          infringing material, evade usage limits, or use automated means that burden the service.
        </p>
      </section>

      <section>
        <h2>Passport stamps</h2>
        <p>
          The passport is a personal record of your night, not proof of admission, identity,
          eligibility, attendance for legal purposes, or entitlement to a prize. Location can be
          inaccurate indoors, so the app may permit an unverified stamp rather than reject someone
          who is standing at a venue.
        </p>
      </section>

      <section>
        <h2>Artist submissions</h2>
        <p>
          You retain ownership of submitted work. You grant DTLAHappening and the participating Art
          Night organizers a non-exclusive license to store, reproduce and display the submitted
          materials as reasonably necessary to review the application, communicate with you, plan
          placement and promote an accepted exhibition. You represent that you have the rights
          needed to submit the material and that the information you provide is accurate.
        </p>
        <p>
          Submission does not guarantee acceptance, placement, promotion or sale. Any placement
          fee, commission, delivery obligation, insurance term or venue-specific rule must be
          disclosed and agreed separately before it becomes binding.
        </p>
      </section>

      <section>
        <h2>Tickets and payments</h2>
        <p>
          When ticketing is offered, the checkout shows the all-in price before payment. Event-
          specific refund, transfer, age and admission terms presented before purchase also apply.
          Participating venues remain responsible for operating their events. Nothing in these
          terms overrides rights that cannot legally be waived.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          The service may link to or rely on venues, map providers, payment processors and other
          third parties. Their services and policies are their responsibility. A link or listing is
          not a warranty or endorsement unless we explicitly say otherwise.
        </p>
      </section>

      <section>
        <h2>Availability and disclaimers</h2>
        <p>
          We work to keep the directory and service reliable, but provide them on an “as available”
          basis. To the extent permitted by law, we disclaim implied warranties and are not liable
          for indirect, incidental, special, consequential or punitive damages arising from use of
          the service. These limitations do not apply where prohibited by law.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the service changes. Material changes will be identified by
          a new effective date. Questions can be sent to{" "}
          <a href="mailto:info@dtlaartnight.com">info@dtlaartnight.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
