import {
  BottomCta,
  Faq,
  FeatureGrid,
  Footer,
  FormatChips,
  Hero,
  IntegrateSnippet,
  TrustStrip,
  UseCases,
  WhyUs,
} from "./components/landing";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <FeatureGrid />
      <FormatChips />
      <IntegrateSnippet />
      <UseCases />
      <WhyUs />
      <BottomCta />
      <Faq />
      <Footer />
    </>
  );
}
