import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Fitlog",
  description: "How Fitlog collects, uses and protects account and fitness data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Your data" title="Privacy policy" updated="31 August 2026">
      <p>
        Fitlog is a personal fitness-tracking service. This policy explains what information Fitlog handles, why it is used, which providers help operate the service, and the choices available to you. Fitness and body information can be sensitive, so each account&apos;s records are separated from every other user&apos;s records.
      </p>

      <h2>Information you provide</h2>
      <p>Depending on the features you use, Fitlog stores:</p>
      <ul>
        <li>account information such as your name, email address and authentication identifier;</li>
        <li>profile and goal information, including age, biological sex, height, body weight and target weight;</li>
        <li>workouts, exercise performance, routines, fatigue check-ins and training schedules;</li>
        <li>foods, quantities, calorie and macro intake, meal templates and manually entered Garmin energy expenditure;</li>
        <li>measurements, progress photos, notes, goals and goal-phase dates; and</li>
        <li>questions sent to the AI coach, the coach responses shown or saved in Fitlog, and a small set of coach-authored notes about durable patterns it observes over time (reviewable and deletable from the Coach page).</li>
      </ul>

      <h2>Information collected automatically</h2>
      <p>
        Fitlog uses authentication cookies to keep you signed in. Vercel Analytics and Speed Insights may collect limited device, page-view and performance information so the service can be maintained and improved. Fitlog does not use this information to sell advertising profiles.
      </p>

      <h2>How information is used</h2>
      <p>
        Information is used to provide your private log, calculate deterministic calorie and macro targets, track progressive overload and nutrition phases, personalize recommendations, secure accounts, diagnose failures and improve service performance. Fitlog does not sell your personal information.
      </p>

      <h2>AI coach</h2>
      <p>
        When you use coach features, Fitlog may send aggregated workout, nutrition, weight and manually entered Garmin data to OpenAI to produce an explanation or suggestion. Progress photos and private measurement notes are excluded. Model requests are made with storage disabled, although the provider&apos;s limited abuse-monitoring retention may still apply. Fitlog also keeps a short, coach-authored memory of durable patterns or preferences it notices about you across sessions &mdash; not raw conversation content &mdash; to make future guidance more relevant; you can review and delete this memory at any time from the Coach page. AI output is guidance only and never changes your plan automatically.
      </p>

      <h2>Service providers and data sources</h2>
      <p>
        Fitlog relies on Neon for authentication and database hosting, Vercel for application hosting and performance analytics, and OpenAI for optional coach features. Food search may query USDA FoodData Central and Open Food Facts; official PortFIR and Swiss food-composition records are also stored in the shared catalog. Google receives information under its own policy when you choose Google sign-in.
      </p>

      <h2>Retention and your choices</h2>
      <p>
        Account and fitness records are kept while your account is active and for as long as reasonably necessary to operate, secure and comply with legal obligations for the service. You may stop adding information at any time. You may request access, correction, export or deletion of your account and personal records. Some information may be retained when required for security, fraud prevention or legal compliance.
      </p>

      <h2>Security and account separation</h2>
      <p>
        Fitlog uses authenticated sessions and user-scoped database queries. Other members cannot browse your workouts, nutrition, measurements, photos or coach history. No internet service can guarantee absolute security, so use a strong password and protect access to your Google account and devices.
      </p>

      <h2>Children</h2>
      <p>Fitlog is not intended for children under 16, and accounts should not be created for them.</p>

      <h2>Changes and contact</h2>
      <p>
        This policy may change as Fitlog develops. Material changes will be reflected here with a new update date. A dedicated contact mailbox at <strong>support@fitlog.site</strong> is reserved for privacy and support requests; it must be activated before relying on email delivery.
      </p>
      <p className="legal-note">
        This page describes the service&apos;s current technical behavior and is not a substitute for legal advice about obligations that may apply to its operator.
      </p>
    </LegalPage>
  );
}
