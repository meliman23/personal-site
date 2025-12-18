import Stripe from "stripe";
import { buffer } from "micro";

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  let event;

  try {
    const rawBody = await buffer(req);
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Runs when a payment is completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const variant_id = session.metadata.variant_id; // size selected by user

    console.log("💰 Payment complete for variant:", variant_id);

    try {
      // Create order in Printify
      const result = await fetch(
        `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_id: session.id,
            label: "Stripe Auto Order",
            line_items: [
              {
                product_id: process.env.PRINTIFY_PRODUCT_ID,
                variant_id: Number(variant_id), // Important
                quantity: 1,
              },
            ],
            shipping_address: {
              first_name: session.customer_details?.name?.split(" ")[0] || "",
              last_name: session.customer_details?.name?.split(" ")[1] || "",
              email: session.customer_details?.email || "",
              address1: session.shipping_details?.address?.line1,
              city: session.shipping_details?.address?.city,
              region: session.shipping_details?.address?.state,
              zip: session.shipping_details?.address?.postal_code,
              country: session.shipping_details?.address?.country,
            },
          }),
        }
      );

      const data = await result.json();
      console.log("🟢 Printify order response:", data);

    } catch (error) {
      console.error("❌ Error creating Printify order:", error);
    }
  }

  return res.status(200).json({ received: true });
}
