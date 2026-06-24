import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/Hero";
import LandingNav from "@/components/landing/LandingNav";
import Showcases from "@/components/landing/Showcases";

export default function LandingPage() {
  return (
    <div className="bg-grid min-h-screen overflow-x-hidden">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <Showcases />
        <Footer />
      </main>
    </div>
  );
}
