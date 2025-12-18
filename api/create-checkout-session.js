import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { size } = req.body; 
  // size = Printify variant_id (like 40123, 40124, etc.)

  if (!size) {
    return res.status(400).json({ error: "Missing size/variant" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: "https://your-site.com/success",
      cancel_url: "https://your-site.com/cancel",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Your Shirt",
            },
            unit_amount: 2500, // $25.00
          },
          quantity: 1,
        },
      ],

      // we pass the variant ID to webhook
      metadata: {
        variant_id: size,
      },

      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
