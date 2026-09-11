import { OfferServiceWizard } from "../../components/offer-service-wizard";

export default function OfferAServicePage() {
  return (
    <main>
      <h1>Offer a service</h1>
      <p className="lede">
        Member → Offer a Service → select categories → add professional information → set a service
        area → submit. Categories are loaded from the API, not from this app.
      </p>
      <OfferServiceWizard />
    </main>
  );
}
