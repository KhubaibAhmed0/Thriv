import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Mail, MapPin, Clock, ArrowUpRight, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us - WhatsApp, Email & Support',
  description:
    'Get in touch with Thriv. Message us directly on WhatsApp (0324-8188616) or email admin@thriv.pk for order queries, measurements, or delivery assistance.',
};

export default function ContactPage() {
  const whatsappNumber = '923248188616';
  const whatsappMessage = encodeURIComponent('Hello Thriv! I have a question about an item or my order.');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-text mb-8">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black font-medium">Contact</span>
        </nav>

        {/* Hero Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-text mb-3">
            Customer Care · Karachi, Pakistan
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-black leading-[1.08] tracking-tight">
            Contact Us
          </h1>
          <p className="text-lg text-body mt-4 leading-relaxed max-w-2xl">
            Have questions about measurements, condition grades, or your dispatch? Reach out directly. We typically respond within 1–2 hours during business hours.
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">

          {/* WhatsApp Support (Primary) */}
          <div className="bg-card rounded-[20px] p-6 sm:p-7 border border-border flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mb-5 shadow-sm">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Fastest Response
              </div>
              <h2 className="text-xl font-extrabold text-black">WhatsApp Support</h2>
              <p className="text-xs text-body mt-2 leading-relaxed">
                Best for real-time sizing questions, order confirmation screenshots, and delivery updates.
              </p>
              <p className="text-sm font-mono font-bold text-black mt-3">
                0324-8188616
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-black text-white text-xs font-bold py-3 px-4 rounded-full hover:bg-black transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Email Support */}
          <div className="bg-card rounded-[20px] p-6 sm:p-7 border border-border flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center mb-5 shadow-sm border border-border">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-black">Official Email</h2>
              <p className="text-xs text-body mt-2 leading-relaxed">
                For order receipts, business correspondence, brand inquiries, or partnership opportunities.
              </p>
              <p className="text-sm font-mono font-bold text-black mt-3">
                admin@thriv.pk
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <a
                href="mailto:admin@thriv.pk"
                className="inline-flex items-center justify-center gap-2 w-full bg-white text-black border border-border hover:border-black text-xs font-bold py-3 px-4 rounded-full transition-colors"
              >
                <Mail className="w-4 h-4" />
                Send Email
              </a>
            </div>
          </div>

          {/* Dispatch Hub & Location */}
          <div className="bg-card rounded-[20px] p-6 sm:p-7 border border-border">
            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center mb-5 shadow-sm border border-border">
              <MapPin className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-black">Dispatch & Operation Hub</h2>
            <p className="text-xs text-body mt-2 leading-relaxed">
              All inventory is held, inspected, sanitized, and dispatched directly from Karachi. We ship nationwide across Pakistan with flat Rs 200 delivery fee.
            </p>
            <p className="text-xs text-black font-semibold mt-3">
              Karachi, Sindh, Pakistan
            </p>
          </div>

          {/* Operating Hours */}
          <div className="bg-card rounded-[20px] p-6 sm:p-7 border border-border">
            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center mb-5 shadow-sm border border-border">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-black">Support Hours</h2>
            <p className="text-xs text-body mt-2 leading-relaxed">
              Our team is active Monday through Saturday. Inquiries received outside hours are answered the following morning.
            </p>
            <p className="text-xs text-black font-semibold mt-3">
              Mon–Sat, 10:00 AM–8:00 PM PKT
            </p>
          </div>
        </div>

        {/* FAQs Callout */}
        <div className="bg-white rounded-[20px] p-6 sm:p-8 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-black">Frequently Asked Questions</h3>
              <p className="text-xs text-body mt-1 leading-relaxed">
                Find answers to common questions regarding measurements, delivery times, payment methods, and our final sale policy.
              </p>
            </div>
          </div>
          <Link
            href="/faq"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-black bg-card hover:bg-border px-4 py-2.5 rounded-full transition-colors"
          >
            Visit FAQs <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </main>
  );
}
