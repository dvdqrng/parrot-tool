// Stripe webhook handler for subscription events
// This function processes Stripe webhooks and updates subscriptions in Supabase

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "npm:stripe@17"
import { createClient } from "npm:@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-01-27.acacia",
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")!
  const body = await req.text()
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Error processing webhook:", err)
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id
  if (!userId) {
    console.error("No client_reference_id in session")
    return
  }

  const stripeCustomerId = session.customer as string
  const stripeSubscriptionId = session.subscription as string

  // Fetch the subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_ends_at: null, // Clear trial
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (error) {
    console.error("Error updating subscription:", error)
    throw error
  }

  console.log(`Subscription activated for user: ${userId}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeCustomerId = subscription.customer as string

  // Find user by stripe customer ID
  const { data: sub, error: findError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single()

  if (findError || !sub) {
    console.error("Could not find subscription for customer:", stripeCustomerId)
    return
  }

  const status = mapStripeStatus(subscription.status)
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000)

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      current_period_ends_at: currentPeriodEnd.toISOString(),
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", sub.user_id)

  if (error) {
    console.error("Error updating subscription:", error)
    throw error
  }

  console.log(`Subscription updated for user: ${sub.user_id}, status: ${status}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeCustomerId = subscription.customer as string

  const { data: sub, error: findError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single()

  if (findError || !sub) {
    console.error("Could not find subscription for customer:", stripeCustomerId)
    return
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", sub.user_id)

  if (error) {
    console.error("Error canceling subscription:", error)
    throw error
  }

  console.log(`Subscription canceled for user: ${sub.user_id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeCustomerId = invoice.customer as string

  const { data: sub, error: findError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single()

  if (findError || !sub) {
    console.error("Could not find subscription for customer:", stripeCustomerId)
    return
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", sub.user_id)

  if (error) {
    console.error("Error updating subscription status:", error)
    throw error
  }

  console.log(`Payment failed for user: ${sub.user_id}`)
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: "active",
    canceled: "canceled",
    incomplete: "expired",
    incomplete_expired: "expired",
    past_due: "past_due",
    paused: "canceled",
    trialing: "trialing",
    unpaid: "past_due",
  }
  return statusMap[stripeStatus] || "expired"
}
