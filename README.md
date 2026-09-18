# Thriv (@thriv.pk) — Curated Thrift & Streetwear

> Karachi-based curated thrift & streetwear e-commerce platform. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4.

---

## 🌟 Brand & Domain Overview

Thriv is a Karachi-based curated thrift store specializing in 1-of-1 branded denim and an exclusive in-house anime graphic tee merch line.

* **1-of-1 Thrift Domain Rule**: Every thrift piece is an authentic one-of-one item with a single fixed size and a stock of exactly 1. There are no restocks, and quantities cannot exceed 1.
* **In-House Merch**: Heavyweight 240 GSM combed cotton anime tees (Akira, Evangelion, Berserk, Cowboy Bebop) with multi-size selection (S, M, L, XL) and batch stock.
* **Condition Grading**: Exactly 3 condition grades: `Premium`, `Excellent`, `Very Good`.
* **Nationwide Flat Delivery**: Flat Rs 200 delivery fee anywhere across Pakistan.
* **Payment Methods**: Cash on Delivery, Bank Transfer, EasyPaisa, JazzCash, Card.
* **Final Sale Policy**: Strictly all sales are final (no returns or exchanges) due to unique 1-of-1 inventory.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Language**: TypeScript (Strict Mode)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom `@theme` tokens
* **State Management**: React Context + `useReducer` with `localStorage` persistence
* **Validation**: [Zod](https://zod.dev/)
* **Icons**: [Lucide React](https://lucide.dev/)

---

## 📁 Key Routes & Architecture

* `/` — Complete 10-section homepage (Hero carousel, Browse shop with stacked drop card, Shop The Look, You May Also Like, Why Choose Thriv trust pillars).
* `/shop` — Catalog with URL query synchronization, category pills (Jeans, Graphic Tees), custom popover filter dropdowns, and responsive 4-column grid.
* `/product/[slug]` — Static-rendered product detail pages (SSG) with laid-flat measurements, thrift 1-of-1 locking vs merch size pickers, and trust cues.
* `/about` — Real brand story, sourcing and disinfection processes, and curation philosophy.
* `/faq` — CSS-only accordion covering sizing, delivery, payment methods, and returns.
* `/cart` — Cart management with 1-of-1 thrift enforcement and delivery fee calculation.
* `/checkout` — Checkout form with Pakistani WhatsApp number validation, payment selection, and mandatory final sale policy consent.
* `/order/[orderNumber]` — Order confirmation with step-by-step next steps and direct WhatsApp confirmation deep link.
* `/styleguide` — Living design system and token reference.
* `/api/orders` — Orders endpoint generating `THR-YYYYMMDD-XXXXXX` order references.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 3. Production Build
```bash
npm run build
npm start
```
