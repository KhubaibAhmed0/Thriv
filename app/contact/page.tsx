import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Mail, MapPin, Clock, ArrowUpRight, HelpCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us — WhatsApp, Email & Support',
  description:
    'Get in touch with Thriv. Message us directly on WhatsApp (0324-8188616) or email admin@thriv.pk for order queries, measurements, or delivery assistance.',
};

export default function ContactPage() {
  const whatsappNumber = '923248188616';
  const whatsappMessage = encodeURIComponent('Hello Thriv! I have a question about an item or my order.');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <main className="min-h-screen bg-[#F5F3F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#9A9A9A] mb-8">
          <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#111111] font-medium">Contact</span>
        </nav>

        {/* Hero Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A] mb-3">
            Customer Care · Karachi, Pakistan
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#111111] leading-[1.08] tracking-tight">
            Contact Us
          </h1>
          <p className="text-lg text-[#444444] mt-4 leading-relaxed max-w-2xl">
            Have questions about measurements, condition grades, or your dispatch? Reach out directly — we typically respond within 1–2 hours during business hours.
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">

          {/* WhatsApp Support (Primary) */}
          <div className="bg-[#EDEBE8] rounded-[20px] p-6 sm:p-7 border border-[#E2E0DC] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-[#111111] text-white flex items-center justify-center mb-5 shadow-sm">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Fastest Response
              </div>
              <h2 className="text-xl font-extrabold text-[#111111]">WhatsApp Support</h2>
              <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                Best for real-time sizing questions, order confirmation screenshots, and delivery updates.
              </p>
              <p className="text-sm font-mono font-bold text-[#111111] mt-3">
                0324-8188616
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E2E0DC]">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-[#111111] text-white text-xs font-bold py-3 px-4 rounded-full hover:bg-black transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Email Support */}
          <div className="bg-[#EDEBE8] rounded-[20px] p-6 sm:p-7 border border-[#E2E0DC] flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-white text-[#111111] flex items-center justify-center mb-5 shadow-sm border border-[#E2E0DC]">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-[#111111]">Official Email</h2>
              <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                For order receipts, business correspondence, brand inquiries, or partnership opportunities.
              </p>
              <p className="text-sm font-mono font-bold text-[#111111] mt-3">
                admin@thriv.pk
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E2E0DC]">
              <a
                href="mailto:admin@thriv.pk"
                className="inline-flex items-center justify-center gap-2 w-full bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111] text-xs font-bold py-3 px-4 rounded-full transition-colors"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </a>
            </div>
          </div>

          {/* Dispatch Hub & Location */}
          <div className="bg-[#EDEBE8] rounded-[20px] p-6 sm:p-7 border border-[#E2E0DC]">
            <div className="w-12 h-12 rounded-full bg-white text-[#111111] flex items-center justify-center mb-5 shadow-sm border border-[#E2E0DC]">
              <MapPin className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-[#111111]">Dispatch & Operation Hub</h2>
            <p className="text-xs text-[#666666] mt-2 leading-relaxed">
              All inventory is held, inspected, sanitized, and dispatched directly from Karachi. We ship nationwide across Pakistan with flat Rs 200 delivery fee.
            </p>
            <p className="text-xs text-[#111111] font-semibold mt-3">
              Karachi, Sindh, Pakistan
            </p>
          </div>

          {/* Operating Hours */}
          <div className="bg-[#EDEBE8] rounded-[20px] p-6 sm:p-7 border border-[#E2E0DC]">
            <div className="w-12 h-12 rounded-full bg-white text-[#111111] flex items-center justify-center mb-5 shadow-sm border border-[#E2E0DC]">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-[#111111]">Support Hours</h2>
            <p className="text-xs text-[#666666] mt-2 leading-relaxed">
              Our team is active Monday through Saturday. Inquiries received outside hours are answered the following morning.
            </p>
            <p className="text-xs text-[#111111] font-semibold mt-3">
              Mon – Sat: 10:00 AM – 8:00 PM PKT
            </p>
          </div>
        </div>

        {/* FAQs Callout */}
        <div className="bg-white rounded-[20px] p-6 sm:p-8 border border-[#E2E0DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#F5F3F0] flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#111111]">Frequently Asked Questions</h3>
              <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                Find answers to common questions regarding measurements, delivery times, payment methods, and our final sale policy.
              </p>
            </div>
          </div>
          <Link
            href="/faq"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] bg-[#EDEBE8] hover:bg-[#E2E0DC] px-4 py-2.5 rounded-full transition-colors"
          >
            Visit FAQs <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </main>
  );
}
