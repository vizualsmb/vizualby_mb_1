import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="not-found" id="main-content">
        <p>404 / Frame not found</p>
        <h1>Out of shot.</h1>
        <Link href="/"><ArrowLeft size={18} /> Return home</Link>
      </main>
      <Footer />
    </>
  );
}
