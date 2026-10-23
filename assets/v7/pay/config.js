/* The pay plugin's settings, in one place. Nothing here is secret: keys and passphrases live only in the server's
   environment (standalone/PAYMENTS.md). Change a line here, rebuild, and every part of giving follows it. */
export const PAY = {
  cur: 'ZAR',                      // every gift is in rand; the gates' working figures stay in their own currency
  // Card gifts, in rand. The server keeps its own limits (PAY_MIN_ZAR, PAY_MAX_ZAR) and is the one that decides.
  min: 10,
  max: 50000,
  pledgeMax: 200000000,            // a sanity ceiling for a pledge arranged with a steward, far above any gate
  // How long the page waits for the provider's confirmation before it says it may take a few minutes.
  confirmWait: 90000,
  fn: 'pay-checkout',              // the edge function that starts a card checkout on Mahala's own site
  // The providers this code can use. `checkout`: where a checkout may send the giver (https, these domains and their
  // subdomains: the server builds those addresses). `links`: the exact hosts a steward's payment link may point to on
  // claude.ai (anything else is refused, so a link can never lead a giver to a look-alike page).
  providers: {
    payfast: { name: 'PayFast', checkout: ['payfast.co.za'], links: ['www.payfast.co.za', 'sandbox.payfast.co.za', 'payment.payfast.io'] },
    yoco: { name: 'Yoco', checkout: ['yoco.com'], links: ['pay.yoco.com'] },
    paystack: { name: 'Paystack', checkout: ['paystack.com'], links: ['paystack.com'] },
  },
};
