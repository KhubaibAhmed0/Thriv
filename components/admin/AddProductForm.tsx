'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Upload,
  X,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Package,
  Sparkles,
  Shirt,
  Scissors,
} from 'lucide-react';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';

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

export function AddProductForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Zara');
  const [customBrand, setCustomBrand] = useState('');
  const [category, setCategory] = useState<'jeans' | 'graphic-tees'>('jeans');
  const [subcategory, setSubcategory] = useState('wide-leg');
  const [condition, setCondition] = useState<'Premium' | 'Excellent' | 'Very Good'>('Premium');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');

  // Sizes
  const [size, setSize] = useState('32');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);

  // Measurements
  const [waist, setWaist] = useState('32 in');
  const [length, setLength] = useState('41 in');
  const [inseam, setInseam] = useState('30 in');
  const [rise, setRise] = useState('12 in');
  const [chest, setChest] = useState('22 in');
  const [shoulders, setShoulders] = useState('20 in');

  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Photos
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<any | null>(null);

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type.startsWith('image/'));
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
    if (!name.trim()) {
      setError('Please enter a product name.');
      return;
    }
    if (!finalBrand) {
      setError('Please specify a brand.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError('Please enter a valid price.');
      return;
    }
    if (imageFiles.length === 0) {
      setError('Please upload at least one photo for the product.');
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
        formData.append(
          'measurements',
          JSON.stringify({
            waist: waist.trim(),
            length: length.trim(),
            inseam: inseam.trim(),
            rise: rise.trim(),
          })
        );
      } else {
        formData.append('sizes', JSON.stringify(selectedSizes));
        formData.append(
          'measurements',
          JSON.stringify({
            chest: chest.trim(),
            shoulders: shoulders.trim(),
            length: length.trim(),
          })
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
    } catch (err: any) {
      setError(err?.message || 'Network error while creating product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setPrice('');
    setDescription('');
    setImageFiles([]);
    setPreviewUrls([]);
    setCreatedProduct(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white pb-20">
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
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-[24px] p-8 text-center max-w-lg mx-auto shadow-2xl animate-in zoom-in-95">
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
                className="flex-1 bg-white text-[#111111] hover:bg-neutral-200 font-bold text-xs py-3.5 px-4 rounded-full transition-colors text-center"
              >
                View in Store ↗
              </Link>
              <button
                onClick={handleReset}
                className="flex-1 bg-[#242424] hover:bg-[#2c2c2c] text-white font-semibold text-xs py-3.5 px-4 rounded-full transition-colors text-center cursor-pointer"
              >
                + Add Another Item
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Add New Item
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Upload photos, set pricing, and specify measurements for your inventory.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-[14px] flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Photo Upload Section */}
            <div className="bg-[#181818] border border-[#262626] rounded-[20px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Product Photos
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Upload up to 4 clear photos. First photo will be the main listing cover.
                  </p>
                </div>
                <span className="text-xs font-mono text-neutral-500">
                  {imageFiles.length}/4
                </span>
              </div>

              {/* Previews & Dropzone Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[4/5] rounded-[14px] overflow-hidden border border-[#333333] bg-[#202020] group"
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
                      className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {imageFiles.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/5] rounded-[14px] border-2 border-dashed border-[#333333] hover:border-neutral-400 bg-[#1b1b1b] hover:bg-[#222222] flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-white transition-all cursor-pointer p-4 text-center"
                  >
                    <Upload className="w-6 h-6 stroke-[1.5]" />
                    <span className="text-xs font-semibold">Upload Photo</span>
                    <span className="text-[10px] text-neutral-500">JPG, PNG, WEBP</span>
                  </button>
                )}
              </div>

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
            <div className="bg-[#181818] border border-[#262626] rounded-[20px] p-6 space-y-5">
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
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400 transition-colors"
                />
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const cat = e.target.value as 'jeans' | 'graphic-tees';
                      setCategory(cat);
                      setSubcategory(cat === 'jeans' ? 'wide-leg' : 'anime-tees');
                    }}
                    className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 transition-colors cursor-pointer"
                  >
                    <option value="jeans">Curated Jeans (Thrift 1-of-1)</option>
                    <option value="graphic-tees">Graphic T-Shirts (Merch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Style / Fit *
                  </label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 transition-colors cursor-pointer"
                  >
                    {(category === 'jeans' ? JEAN_SUBCATEGORIES : TEE_SUBCATEGORIES).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Brand & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Brand *
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 transition-colors cursor-pointer"
                  >
                    {KNOWN_BRANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="other">Other / Custom Brand</option>
                  </select>

                  {brand === 'other' && (
                    <input
                      type="text"
                      placeholder="Enter brand name"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="mt-2 w-full bg-[#202020] border border-[#303030] rounded-[12px] px-4 py-2 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                    />
                  )}
                </div>

                {category === 'jeans' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Condition Grade *
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as any)}
                      className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400 transition-colors cursor-pointer"
                    >
                      <option value="Premium">Premium (Near-new / pristine)</option>
                      <option value="Excellent">Excellent (Minimal wear)</option>
                      <option value="Very Good">Very Good (Authentic vintage character)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-3.5 py-2.5 text-sm text-white outline-none focus:border-neutral-400"
                    />
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
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono">
                      Rs
                    </span>
                    <input
                      id="product-price"
                      type="number"
                      placeholder="2199"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="w-full bg-[#202020] border border-[#303030] rounded-[12px] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400 font-mono"
                    />
                  </div>
                </div>

                {category === 'jeans' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Waist Size (Label) *
                    </label>
                    <input
                      type="text"
                      placeholder="32"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      required
                      className="w-full bg-[#202020] border border-[#303030] rounded-[12px] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Available Sizes
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      {['S', 'M', 'L', 'XL'].map((sz) => {
                        const active = selectedSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => toggleSize(sz)}
                            className={`w-9 h-9 rounded-[10px] text-xs font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-white text-[#111111] border-white'
                                : 'bg-[#202020] text-neutral-400 border-[#303030] hover:text-white'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Measurements Section */}
            <div className="bg-[#181818] border border-[#262626] rounded-[20px] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Garment Measurements (Inches)
                </h2>
              </div>

              {category === 'jeans' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Waist</label>
                    <input
                      type="text"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="32 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Length</label>
                    <input
                      type="text"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="41 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Inseam</label>
                    <input
                      type="text"
                      value={inseam}
                      onChange={(e) => setInseam(e.target.value)}
                      placeholder="30 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Rise</label>
                    <input
                      type="text"
                      value={rise}
                      onChange={(e) => setRise(e.target.value)}
                      placeholder="12 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Chest</label>
                    <input
                      type="text"
                      value={chest}
                      onChange={(e) => setChest(e.target.value)}
                      placeholder="22 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Shoulders</label>
                    <input
                      type="text"
                      value={shoulders}
                      onChange={(e) => setShoulders(e.target.value)}
                      placeholder="20 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Length</label>
                    <input
                      type="text"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="29 in"
                      className="w-full bg-[#202020] border border-[#303030] rounded-[10px] px-3 py-2 text-xs text-white outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Description */}
            <div className="bg-[#181818] border border-[#262626] rounded-[20px] p-6 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Description
              </h2>
              <textarea
                rows={3}
                placeholder="Heavyweight rigid denim in faded stone wash with clean hems and wide leg draping. Cleaned and pre-sanitized in Karachi. No visible scuffs."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#202020] border border-[#303030] rounded-[12px] p-4 text-xs sm:text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-400 leading-relaxed resize-y"
              />

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-[#303030] text-black focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-neutral-300 font-medium">
                  Feature this item on homepage hero/drops
                </span>
              </label>
            </div>

            {/* Action Bar */}
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
                className="inline-flex items-center justify-center gap-2 bg-white text-[#111111] hover:bg-neutral-200 font-bold text-sm px-8 py-3.5 rounded-full transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
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
