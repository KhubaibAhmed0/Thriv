'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Upload,
  X,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Scissors,
} from 'lucide-react';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { errorMessage } from '@/lib/errors';
import { AdminDropdown } from '@/components/admin/AdminDropdown';

const KNOWN_BRANDS = ['Zara', 'Bershka', 'Calvin Klein', 'H&M', 'Old Navy', 'Thriv'];
const JEAN_SUBCATEGORIES = [
  'wide-leg',
  'baggy',
  'straight-leg',
  'relaxed-fit',
  'vintage-wash',
  'cargo-denim',
];
const TEE_SUBCATEGORIES = ['anime-tees', 'oversized-tees'];

const CATEGORY_OPTIONS = [
  { value: 'jeans', label: 'Curated Jeans (Thrift 1-of-1)' },
  { value: 'graphic-tees', label: 'Graphic T-Shirts (Merch)' },
];

const BRAND_OPTIONS = [
  ...KNOWN_BRANDS.map((b) => ({ value: b, label: b })),
  { value: 'other', label: 'Other / Custom Brand' },
];

const CONDITION_OPTIONS = [
  { value: 'Premium', label: 'Premium', sublabel: 'Near-new / pristine', dotColor: '#5A4A2F' },
  { value: 'Excellent', label: 'Excellent', sublabel: 'Minimal wear', dotColor: '#1E3A5F' },
  { value: 'Very Good', label: 'Very Good', sublabel: 'Authentic vintage character', dotColor: '#2E5E2E' },
];

type CreatedProduct = { name: string; slug: string };

export function AddProductForm() {
  const [name, setName] = useState('');
  // Audit F-22: nothing below ships pre-filled with fabricated specs. Brand,
  // grade, sizes and measurements all start empty and must be entered.
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [category, setCategory] = useState<'jeans' | 'graphic-tees'>('jeans');
  const [subcategory, setSubcategory] = useState('wide-leg');
  const [condition, setCondition] = useState<'' | 'Premium' | 'Excellent' | 'Very Good'>('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');

  // Sizes
  const [size, setSize] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  // Measurements
  const [waist, setWaist] = useState('');
  const [length, setLength] = useState('');
  const [inseam, setInseam] = useState('');
  const [rise, setRise] = useState('');
  const [chest, setChest] = useState('');
  const [shoulders, setShoulders] = useState('');

  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Photos
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Audit F-36: per-field errors, an error summary near the submit button and
  // focus moved to the first invalid control.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(null);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  // Audit F-53: mirror the server-side upload gate (JPG/PNG/WebP, 5 MB) so
  // oversized or mislabelled files are rejected in the browser first.
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const addFiles = (newFiles: File[]) => {
    const rejected = newFiles.filter(
      (f) => !ALLOWED_PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO_BYTES
    );
    const validFiles = newFiles.filter(
      (f) =>
        ALLOWED_PHOTO_TYPES.includes(f.type) && f.size > 0 && f.size <= MAX_PHOTO_BYTES
    );

    if (rejected.length > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        'product-photos': `${rejected.length} file${rejected.length > 1 ? 's' : ''} skipped — JPG/PNG/WebP up to 5 MB only.`,
      }));
    } else {
      clearFieldError('product-photos');
    }

    if (validFiles.length === 0) return;

    const combined = [...imageFiles, ...validFiles].slice(0, 4); // Max 4 photos
    setImageFiles(combined);

    // Create previews
    const urls = combined.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
  };

  const removeFile = (index: number) => {
    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedUrls = previewUrls.filter((_, i) => i !== index);
    setImageFiles(updatedFiles);
    setPreviewUrls(updatedUrls);
  };

  // Toggle merch size
  const toggleSize = (sz: string) => {
    clearFieldError('product-sizes');
    if (selectedSizes.includes(sz)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== sz));
    } else {
      setSelectedSizes([...selectedSizes, sz]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalBrand = brand === 'other' ? customBrand.trim() : brand;

    // Audit F-36: collect every problem, mark each field, focus the first
    // invalid control (topmost in the form) and show a summary by the submit.
    const errs: Record<string, string> = {};
    if (imageFiles.length === 0) errs['product-photos'] = 'Upload at least one photo.';
    if (!name.trim()) errs['product-name'] = 'Enter a product name.';
    if (!finalBrand) errs['product-brand'] = 'Select or enter a brand.';
    if (category === 'jeans' && !condition) {
      errs['product-condition'] = 'Select a condition grade.';
    }
    if (category === 'graphic-tees' && selectedSizes.length === 0) {
      errs['product-sizes'] = 'Select at least one available size.';
    }
    if (
      category === 'graphic-tees' &&
      (!stock.trim() || isNaN(Number(stock)) || Number(stock) < 0)
    ) {
      errs['product-stock'] = 'Enter the stock quantity.';
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      errs['product-price'] = 'Enter a valid price in PKR.';
    }
    if (category === 'jeans' && !size.trim()) {
      errs['product-size'] = 'Enter the waist size.';
    }

    setFieldErrors(errs);
    const firstInvalid = Object.keys(errs)[0];
    if (firstInvalid) {
      const el = document.getElementById(firstInvalid);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('brand', finalBrand);
      formData.append('category', category);
      formData.append('subcategory', subcategory);
      formData.append('price', price.trim());
      formData.append('isMerch', category === 'graphic-tees' ? 'true' : 'false');
      formData.append('stock', stock.trim() || '1');
      formData.append('description', description.trim());
      formData.append('isFeatured', isFeatured ? 'true' : 'false');

      if (category === 'jeans') {
        formData.append('condition', condition);
        formData.append('size', size.trim());
        const jeanMeasurements = {
          waist: waist.trim(),
          length: length.trim(),
          inseam: inseam.trim(),
          rise: rise.trim(),
        };
        // Blank fields are omitted so the storefront states "not provided"
        // instead of publishing invented numbers (audit F-22).
        formData.append(
          'measurements',
          JSON.stringify(
            Object.fromEntries(Object.entries(jeanMeasurements).filter(([, v]) => v !== ''))
          )
        );
      } else {
        formData.append('sizes', JSON.stringify(selectedSizes));
        const teeMeasurements = {
          chest: chest.trim(),
          shoulders: shoulders.trim(),
          length: length.trim(),
        };
        formData.append(
          'measurements',
          JSON.stringify(
            Object.fromEntries(Object.entries(teeMeasurements).filter(([, v]) => v !== ''))
          )
        );
      }

      for (const file of imageFiles) {
        formData.append('images', file);
      }

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create product.');
        setSubmitting(false);
        return;
      }

      setCreatedProduct(data.product);
    } catch (err) {
      setError(errorMessage(err, 'Network error while creating product.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setBrand('');
    setCustomBrand('');
    setSubcategory('wide-leg');
    setCondition('');
    setPrice('');
    setStock('1');
    setSize('');
    setSelectedSizes([]);
    setWaist('');
    setLength('');
    setInseam('');
    setRise('');
    setChest('');
    setShoulders('');
    setDescription('');
    setIsFeatured(false);
    setImageFiles([]);
    setPreviewUrls([]);
    setCreatedProduct(null);
    setError(null);
    setFieldErrors({});
  };

  return (
    <div data-admin className="min-h-screen bg-black text-white pb-20">
      <AdminNavHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Inventory
          </Link>
        </div>

        {/* Success Card */}
        {createdProduct ? (
          <div className="bg-admin-bg border border-admin-line rounded-[24px] p-8 text-center max-w-lg mx-auto shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">Item Published!</h2>
            <p className="text-sm text-neutral-400 mt-2">
              <strong>{createdProduct.name}</strong> is now live in the store catalog.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href={`/product/${createdProduct.slug}`}
                target="_blank"
                className="flex-1 bg-white text-black hover:bg-neutral-200 font-bold text-xs py-3.5 px-4 rounded-full transition-colors text-center"
              >
                View in Store ↗
              </Link>
              <button
                onClick={handleReset}
                className="flex-1 bg-admin-raised hover:bg-admin-line-strong text-white font-semibold text-xs py-3.5 px-4 rounded-full transition-colors text-center cursor-pointer"
              >
                + Add Another Item
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Add New Item
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Upload photos, set pricing, and specify measurements for your inventory.
              </p>
            </div>

            {/* Error Banner (server / network) */}
            {error && (
              <div
                role="alert"
                className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-[14px] flex items-start gap-3 text-rose-300 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Photo Upload Section */}
            <div className="bg-admin-bg border border-admin-line rounded-[20px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Product Photos
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Upload up to 4 clear photos. First photo will be the main listing cover.
                  </p>
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  {imageFiles.length}/4
                </span>
              </div>

              {/* Previews & Dropzone Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[4/5] rounded-[14px] overflow-hidden border border-admin-line-strong bg-admin-field group"
                  >
                    <Image
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/80 px-2 py-0.5 rounded-full text-white">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                      title="Remove image"
                      aria-label={`Remove photo ${idx + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {imageFiles.length < 4 && (
                  <button
                    type="button"
                    id="product-photos"
                    onClick={() => fileInputRef.current?.click()}
                    aria-describedby={fieldErrors['product-photos'] ? 'product-photos-error' : undefined}
                    className="aspect-[4/5] rounded-[14px] border-2 border-dashed border-admin-line-strong hover:border-neutral-400 bg-admin-bg hover:bg-admin-field flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-white transition-all cursor-pointer p-4 text-center"
                  >
                    <Upload className="w-6 h-6 stroke-[1.5]" />
                    <span className="text-xs font-semibold">Upload Photo</span>
                    <span className="text-[10px] text-neutral-400">JPG, PNG, WEBP</span>
                  </button>
                )}
              </div>

              {fieldErrors['product-photos'] && (
                <p id="product-photos-error" className="text-[11px] text-rose-400">
                  {fieldErrors['product-photos']}
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* 2. Basic Details Section */}
            <div className="bg-admin-bg border border-admin-line rounded-[20px] p-6 space-y-5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Item Details
              </h2>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-name">
                  Product Name *
                </label>
                <input
                  id="product-name"
                  type="text"
                  placeholder="e.g. Zara Wide-Leg Vintage Wash Denim"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('product-name');
                  }}
                  required
                  aria-invalid={fieldErrors['product-name'] ? true : undefined}
                  aria-describedby={fieldErrors['product-name'] ? 'product-name-error' : undefined}
                  className={`w-full bg-admin-field border rounded-[12px] px-4 py-2.5 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors ${
                    fieldErrors['product-name'] ? 'border-rose-500/60' : 'border-admin-line-strong'
                  }`}
                />
                {fieldErrors['product-name'] && (
                  <p id="product-name-error" className="text-[11px] text-rose-400 mt-1">
                    {fieldErrors['product-name']}
                  </p>
                )}
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-category">
                    Category *
                  </label>
                  <AdminDropdown
                    id="product-category"
                    options={CATEGORY_OPTIONS}
                    value={category}
                    onChange={(val) => {
                      const cat = val as 'jeans' | 'graphic-tees';
                      setCategory(cat);
                      setSubcategory(cat === 'jeans' ? 'wide-leg' : 'anime-tees');
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-subcategory">
                    Style / Fit *
                  </label>
                  <AdminDropdown
                    id="product-subcategory"
                    options={(category === 'jeans' ? JEAN_SUBCATEGORIES : TEE_SUBCATEGORIES).map((sub) => ({
                      value: sub,
                      label: sub.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    }))}
                    value={subcategory}
                    onChange={(val) => setSubcategory(val)}
                  />
                </div>
              </div>

              {/* Brand & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-brand">
                    Brand *
                  </label>
                  <AdminDropdown
                    id="product-brand"
                    options={BRAND_OPTIONS}
                    value={brand}
                    placeholder="Select brand"
                    invalid={!!fieldErrors['product-brand']}
                    describedBy="product-brand-error"
                    onChange={(val) => {
                      setBrand(val);
                      clearFieldError('product-brand');
                    }}
                  />

                  {brand === 'other' && (
                    <input
                      id="product-custom-brand"
                      type="text"
                      aria-label="Custom brand name"
                      placeholder="Enter brand name"
                      value={customBrand}
                      onChange={(e) => {
                        setCustomBrand(e.target.value);
                        clearFieldError('product-brand');
                      }}
                      className="mt-2 w-full bg-admin-field border border-admin-line-strong rounded-[12px] px-4 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  )}
                  {fieldErrors['product-brand'] && (
                    <p id="product-brand-error" className="text-[11px] text-rose-400 mt-1">
                      {fieldErrors['product-brand']}
                    </p>
                  )}
                </div>

                {category === 'jeans' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-condition">
                      Condition Grade *
                    </label>
                    <AdminDropdown
                      id="product-condition"
                      options={CONDITION_OPTIONS}
                      value={condition}
                      placeholder="Select grade"
                      invalid={!!fieldErrors['product-condition']}
                      describedBy="product-condition-error"
                      onChange={(val) => {
                        setCondition(val as 'Premium' | 'Excellent' | 'Very Good');
                        clearFieldError('product-condition');
                      }}
                    />
                    {fieldErrors['product-condition'] && (
                      <p id="product-condition-error" className="text-[11px] text-rose-400 mt-1">
                        {fieldErrors['product-condition']}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-stock">
                      Stock Quantity *
                    </label>
                    <input
                      id="product-stock"
                      type="number"
                      min="1"
                      value={stock}
                      onChange={(e) => {
                        setStock(e.target.value);
                        clearFieldError('product-stock');
                      }}
                      aria-invalid={fieldErrors['product-stock'] ? true : undefined}
                      aria-describedby={fieldErrors['product-stock'] ? 'product-stock-error' : undefined}
                      className={`w-full bg-admin-field border rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 ${
                        fieldErrors['product-stock'] ? 'border-rose-500/60' : 'border-admin-line-strong'
                      }`}
                    />
                    {fieldErrors['product-stock'] && (
                      <p id="product-stock-error" className="text-[11px] text-rose-400 mt-1">
                        {fieldErrors['product-stock']}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Price & Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-price">
                    Price in PKR *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">
                      Rs
                    </span>
                    <input
                      id="product-price"
                      type="number"
                      placeholder="2199"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        clearFieldError('product-price');
                      }}
                      required
                      aria-invalid={fieldErrors['product-price'] ? true : undefined}
                      aria-describedby={fieldErrors['product-price'] ? 'product-price-error' : undefined}
                      className={`w-full bg-admin-field border rounded-[12px] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 font-mono ${
                        fieldErrors['product-price'] ? 'border-rose-500/60' : 'border-admin-line-strong'
                      }`}
                    />
                  </div>
                  {fieldErrors['product-price'] && (
                    <p id="product-price-error" className="text-[11px] text-rose-400 mt-1">
                      {fieldErrors['product-price']}
                    </p>
                  )}
                </div>

                {category === 'jeans' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5" htmlFor="product-size">
                      Waist Size (Label) *
                    </label>
                    <input
                      id="product-size"
                      type="text"
                      placeholder="32"
                      value={size}
                      onChange={(e) => {
                        setSize(e.target.value);
                        clearFieldError('product-size');
                      }}
                      required
                      aria-invalid={fieldErrors['product-size'] ? true : undefined}
                      aria-describedby={fieldErrors['product-size'] ? 'product-size-error' : undefined}
                      className={`w-full bg-admin-field border rounded-[12px] px-4 py-2.5 text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 ${
                        fieldErrors['product-size'] ? 'border-rose-500/60' : 'border-admin-line-strong'
                      }`}
                    />
                    {fieldErrors['product-size'] && (
                      <p id="product-size-error" className="text-[11px] text-rose-400 mt-1">
                        {fieldErrors['product-size']}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5" id="product-sizes-label">
                      Available Sizes *
                    </label>
                    <div
                      id="product-sizes"
                      role="group"
                      aria-labelledby="product-sizes-label"
                      tabIndex={-1}
                      className="flex items-center gap-2 pt-1 outline-none"
                    >
                      {['S', 'M', 'L', 'XL'].map((sz) => {
                        const active = selectedSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => toggleSize(sz)}
                            aria-pressed={active}
                            className={`w-11 h-11 rounded-[10px] text-xs font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-white text-black border-white'
                                : 'bg-admin-field text-neutral-400 border-admin-line-strong hover:text-white'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors['product-sizes'] && (
                      <p className="text-[11px] text-rose-400 mt-1">{fieldErrors['product-sizes']}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Measurements Section */}
            <div className="bg-admin-bg border border-admin-line rounded-[20px] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Garment Measurements (Inches)
                </h2>
              </div>

              <p className="text-[11px] text-neutral-400 -mt-1">
                Optional — leave a field blank if it hasn&apos;t been measured. Blank
                measurements are hidden on the product page instead of guessed.
              </p>

              {category === 'jeans' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-waist">Waist</label>
                    <input
                      id="product-waist"
                      type="text"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="32 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-length">Length</label>
                    <input
                      id="product-length"
                      type="text"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="41 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-inseam">Inseam</label>
                    <input
                      id="product-inseam"
                      type="text"
                      value={inseam}
                      onChange={(e) => setInseam(e.target.value)}
                      placeholder="30 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-rise">Rise</label>
                    <input
                      id="product-rise"
                      type="text"
                      value={rise}
                      onChange={(e) => setRise(e.target.value)}
                      placeholder="12 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-chest">Chest</label>
                    <input
                      id="product-chest"
                      type="text"
                      value={chest}
                      onChange={(e) => setChest(e.target.value)}
                      placeholder="22 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-shoulders">Shoulders</label>
                    <input
                      id="product-shoulders"
                      type="text"
                      value={shoulders}
                      onChange={(e) => setShoulders(e.target.value)}
                      placeholder="20 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1" htmlFor="product-tee-length">Length</label>
                    <input
                      id="product-tee-length"
                      type="text"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="29 in"
                      className="w-full bg-admin-field border border-admin-line-strong rounded-[10px] px-3 py-2 text-xs text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Description */}
            <div className="bg-admin-bg border border-admin-line rounded-[20px] p-6 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Description
              </h2>
              <textarea
                id="product-description"
                aria-label="Product description"
                rows={3}
                placeholder="Heavyweight rigid denim in faded stone wash with clean hems and wide leg draping. Cleaned and pre-sanitized in Karachi. No visible scuffs."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-admin-field border border-admin-line-strong rounded-[12px] p-4 text-xs sm:text-sm text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 leading-relaxed resize-y"
              />

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-admin-line-strong text-black focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-neutral-300 font-medium">
                  Feature this item on homepage hero/drops
                </span>
              </label>
            </div>

            {/* Error summary + Action Bar (audit F-36: summary near submit) */}
            {Object.keys(fieldErrors).length > 0 && (
              <div
                id="form-error-summary"
                role="alert"
                className="p-3.5 bg-rose-950/40 border border-rose-800/40 rounded-[14px] text-rose-300 text-xs"
              >
                {Object.keys(fieldErrors).length}{' '}
                {Object.keys(fieldErrors).length > 1 ? 'fields need' : 'field needs'} attention —
                see the highlighted inputs above.
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link
                href="/admin/products"
                className="px-5 py-3 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 font-bold text-sm px-8 py-3.5 rounded-full transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Publish to Store
                  </>
                )}
              </button>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}
