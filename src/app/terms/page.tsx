import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use · Fitlog",
  description: "Terms governing use of the Fitlog fitness-tracking service.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="The agreement" title="Terms of use" updated="30 August 2026">
      <p>
        These terms govern your use of Fitlog. By creating an account or using the service, you agree to them. If you do not agree, do not use Fitlog.
      </p>

      <h2>Who may use Fitlog</h2>
      <p>
        You must be at least 16 years old and legally able to agree to these terms. You must provide accurate account information, keep your sign-in credentials secure and promptly report suspected unauthorized access.
      </p>

      <h2>Your account and content</h2>
      <p>
        Your account is personal. You remain responsible for the workouts, foods, body information, photos, notes and other content you enter. You grant Fitlog permission to process that content only as needed to operate, secure and improve the service as described in the Privacy Policy.
      </p>

      <h2>Fitness and health disclaimer</h2>
      <p>
        Fitlog provides tracking tools, calculations and general fitness information. It is not a medical service and does not diagnose, treat or prevent any condition. Calorie targets, macro targets, progressive-overload prompts and AI coach responses are estimates or general guidance. Consult a qualified health professional before making decisions that may affect your health, particularly if you have an injury, medical condition, eating disorder history, are pregnant or take medication. Stop exercising and seek appropriate care if you experience concerning symptoms.
      </p>

      <h2>Acceptable use</h2>
      <p>You may not:</p>
      <ul>
        <li>access or attempt to access another person&apos;s account or private records;</li>
        <li>interfere with the service, bypass security controls or probe it without authorization;</li>
        <li>upload unlawful, harmful or rights-infringing material;</li>
        <li>use automated traffic in a way that degrades the service or its providers; or</li>
        <li>misrepresent Fitlog&apos;s recommendations as medical advice.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        Authentication, hosting, AI and food-data features rely on third-party services. Their availability and separate terms or privacy practices may affect those features. Fitlog is not responsible for changes to third-party data or services outside its control.
      </p>

      <h2>Availability and changes</h2>
      <p>
        Fitlog may add, change, suspend or discontinue features. Reasonable efforts are made to keep the service accurate and available, but uninterrupted operation, permanent storage and error-free calculations are not guaranteed. Keep an independent copy of information that is important to you.
      </p>

      <h2>Suspension and termination</h2>
      <p>
        Access may be disabled when necessary to protect users or the service, respond to legal requirements, investigate abuse or enforce these terms. You may stop using Fitlog at any time and request deletion of your account data.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        To the extent permitted by applicable law, Fitlog is provided “as is” without warranties of fitness for a particular purpose. The operator is not liable for indirect or consequential loss arising from reliance on fitness guidance, third-party services, data loss or service interruption. Nothing in these terms excludes rights or liability that cannot legally be excluded.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        Updated terms will be posted on this page with a revised effective date. Continued use after an update means you accept the revised terms where permitted by law. Applicable mandatory consumer and data-protection law continues to apply.
      </p>

      <h2>Contact</h2>
      <p>
        The intended support address is <strong>support@fitlog.site</strong>. The domain can host this mailbox, but it must be activated with an email provider before relying on delivery.
      </p>
      <p className="legal-note">
        These are practical beta terms and are not a substitute for a lawyer&apos;s review before a commercial or broad public launch.
      </p>
    </LegalPage>
  );
}
