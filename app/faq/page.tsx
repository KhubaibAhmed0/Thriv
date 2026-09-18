import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQs — Sizing, Delivery, Payment & Returns',
  description:
    'Answers to common questions about Thriv: how to order, sizing for thrift vs. merch, delivery times, payment methods, condition grades, and our no-returns policy.',
};

const faqs: { q: string; a: string | React.ReactNode }[] = [
  {
    q: 'How do I figure out the right size for a thrift piece?',
    a: (
      <span>
        Every thrift listing includes exact garment measurements — waist, length, inseam, and rise — measured flat in inches. The listed size (e.g. &quot;Size 32&quot;) is the label size on the garment. <strong>We strongly recommend comparing the measurements against a pair of jeans you already own</strong> and are comfortable in, rather than relying on the label size alone, because thrift sizes vary significantly between brands and years. Measurements are the most reliable guide. All sales are final — no returns or exchanges.
      </span>
    ),
  },
  {
    q: 'What sizes are available for graphic tees?',
    a: 'All five anime graphic tee designs are available in S, M, L, and XL. These are oversized/boxy streetwear fits — they are intended to fit large. If you are between sizes, size down. Chest and shoulder measurements for size L are listed on each product page.',
  },
  {
    q: 'How long does delivery take?',
    a: 'We dispatch from Karachi. Estimated delivery is 3–7 working days depending on your city. Karachi deliveries typically arrive within 2–3 days. Further cities (Peshawar, Quetta, Gilgit) may take closer to 7 days. A tracking number from the courier will be sent on WhatsApp after dispatch. We cannot guarantee exact delivery dates — this depends on the courier.',
  },
  {
    q: 'How much does delivery cost?',
    a: 'Delivery is flat Rs 200 nationwide, regardless of the number of items in your order. Whether you order one pair of jeans or three graphic tees, the delivery fee is Rs 200.',
  },
  {
    q: 'What payment methods do you accept?',
    a: (
      <span>
        We accept five payment methods:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>Cash on Delivery (COD)</strong> — pay in cash when your parcel arrives.</li>
          <li><strong>Bank Transfer</strong> — transfer to our bank account; send the payment screenshot on WhatsApp.</li>
          <li><strong>EasyPaisa</strong> — send to our EasyPaisa number; share the confirmation screenshot on WhatsApp.</li>
          <li><strong>JazzCash</strong> — same process as EasyPaisa.</li>
          <li><strong>Card</strong> — card payments are coming soon and are not yet live.</li>
        </ul>
        <span className="block mt-2 text-[#9A9A9A]">For Bank Transfer, EasyPaisa, and JazzCash, account details are displayed at checkout after you select the payment method.</span>
      </span>
    ),
  },
  {
    q: 'Can I return or exchange an item?',
    a: 'No. All sales at Thriv are strictly final — no returns and no exchanges, on any item, for any reason. This applies equally to thrift jeans and graphic tees. Thrift inventory is one-of-one: once a piece ships, it cannot be re-listed in the same condition. Please read each listing carefully, check the measurements, and review the condition grade before ordering. We provide accurate photography and honest descriptions to help you make an informed decision.',
  },
  {
    q: 'What are the condition grades and what do they mean?',
    a: (
      <span>
        All thrift items are graded using exactly three grades:
        <ul className="mt-2 space-y-2">
          <li>
            <strong className="text-[#5A4A2F]">Premium</strong> — The piece shows no visible signs of wear. Hardware, stitching, wash colour, and structure are all in as-close-to-new condition as a pre-loved garment can be. Typically sourced from wardrobes where it was worn rarely or gently.
          </li>
          <li>
            <strong className="text-[#1E3A5F]">Excellent</strong> — Light signs of natural wear consistent with regular use: minimal fading, no structural flaws, pockets in good condition. This is the most common grade in our inventory.
          </li>
          <li>
            <strong className="text-[#2E5E2E]">Very Good</strong> — Visible signs of wear — surface fade, minor whisker marks, or softened cotton — that are characteristic of authentic pre-loved denim. No holes, tears, or structural damage. Still a great everyday piece.
          </li>
        </ul>
        <span className="block mt-2 text-[#9A9A9A]">No item outside these three grades is listed. If a piece doesn&apos;t meet Very Good, it doesn&apos;t get listed.</span>
      </span>
    ),
  },
  {
    q: 'Is there a stock of more than 1 for thrift items?',
    a: 'No. Every thrift piece is one-of-one — a single item with a single fixed size, stock of exactly 1. When it sells, it is gone. There is no restock. Thrift items cannot be ordered in multiples. The graphic tees (in-house merch) are the only products with real batch stock and multiple sizes.',
  },
  {
    q: 'How do I place an order?',
    a: (
      <span>
        <strong>Online:</strong> Browse the shop, add items to your cart, and proceed to checkout. Fill in your delivery details, select your payment method, and place the order. You will receive a confirmation with your order number.
        <br /><br />
        <strong>WhatsApp:</strong> You can also message us directly on WhatsApp with the product name and size. We will confirm availability and share payment details.
        <br /><br />
        Order confirmation is sent via both email and WhatsApp after the order is placed.
      </span>
    ),
  },
  {
    q: 'Do you deliver outside Pakistan?',
    a: 'Not at this time. Thriv currently delivers within Pakistan only.',
  },
  {
    q: 'Can I see the item before paying (for COD)?',
    a: 'With Cash on Delivery, you can open the package in front of the courier before paying. However, this is limited to a visual inspection only — it does not constitute a try-on and the no-returns policy still applies once you accept the parcel.',
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8">
          <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#111111] font-medium">FAQs</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A] mb-3">
            Frequently Asked Questions
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#111111] leading-tight tracking-tight">
            Sizing, Delivery &amp;<br />Everything Else
          </h1>
          <p className="text-sm text-[#444444] mt-4 max-w-xl leading-relaxed">
            Answers to common questions about how Thriv works. If your question isn&apos;t here, message us on WhatsApp.
          </p>
        </div>

        {/* CSS-only accordion using <details>/<summary> — zero JavaScript, keyboard accessible */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <details
              key={idx}
              className="group bg-[#EDEBE8] border border-[#E2E0DC] rounded-[16px] overflow-hidden open:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            >
              <summary className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer list-none select-none hover:bg-[#E8E5E0] transition-colors focus-visible:outline-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 rounded-[16px]">
                <span className="text-sm font-semibold text-[#111111] leading-snug">
                  {faq.q}
                </span>
                {/* Plus/minus toggle indicator */}
                <span
                  className="shrink-0 w-6 h-6 rounded-full border border-[#E2E0DC] bg-white flex items-center justify-center text-[#111111] text-base font-bold transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <div className="px-5 sm:px-6 pb-5 pt-2 text-sm text-[#444444] leading-relaxed border-t border-[#E2E0DC] mt-0">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* Final sale reminder */}
        <div className="mt-10 bg-[#F5E6E6] rounded-[16px] p-5 border border-[#E2C2C2]">
          <p className="text-xs font-bold text-[#8B2020] uppercase tracking-wider mb-1">
            No Returns · No Exchanges
          </p>
          <p className="text-xs text-[#8B2020] leading-relaxed">
            All Thriv sales are strictly final. Check measurements before ordering. If you are unsure, message us on WhatsApp before placing your order.
          </p>
        </div>

        {/* Help CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-[#444444] mb-4">Still have a question?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://wa.me/923001234567?text=Hi+Thriv!+I+have+a+question."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#111111] text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-black transition-colors"
            >
              Message on WhatsApp <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111] font-semibold text-sm px-6 py-3 rounded-full transition-colors"
            >
              Browse the Shop
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
