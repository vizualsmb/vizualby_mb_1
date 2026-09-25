import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy information for VIZUAL BY MB.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="legal-page" id="main-content">
        <p className="eyebrow">Privacy</p>
        <h1>Your inquiry stays private.</h1>
        <div className="legal-copy">
          <p>The contact form collects your name, email address, and project message only so VIZUAL BY MB can respond to your inquiry.</p>
          <p>Messages are delivered through Resend and are not sold or used for advertising. Information is retained only as long as needed to discuss or complete a project.</p>
          <p>You may request access, correction, or deletion of your information by emailing <a href="mailto:hello@vizualbymb.com">hello@vizualbymb.com</a>.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
