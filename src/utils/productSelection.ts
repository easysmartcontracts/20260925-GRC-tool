const PRODUCT_STORAGE_KEY = 'trust_center_selected_product_slug';

export function getLastSelectedProduct(): string | null {
  try {
    return localStorage.getItem(PRODUCT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLastSelectedProduct(slug: string | null | undefined) {
  try {
    if (slug) {
      localStorage.setItem(PRODUCT_STORAGE_KEY, slug);
      window.dispatchEvent(new CustomEvent('selected-product-change', { detail: slug }));
    }
  } catch {
    // Ignore storage exceptions
  }
}

/**
 * Resolves the target product slug for an overview page.
 * Priority:
 * 1. Current URL slug (if valid in available products)
 * 2. Last selected product from persistent storage (if valid in available products)
 * 3. First/top product available in the list
 */
export function resolveTargetProduct(
  currentSlug: string | undefined | null,
  availableProducts: { slug: string }[]
): string | null {
  if (!availableProducts || availableProducts.length === 0) {
    return null;
  }

  // 1. If current URL slug is present and valid for this overview
  if (currentSlug && availableProducts.some(p => p.slug === currentSlug)) {
    return currentSlug;
  }

  // 2. If a product was previously selected in another overview or page
  const lastSelected = getLastSelectedProduct();
  if (lastSelected && availableProducts.some(p => p.slug === lastSelected)) {
    return lastSelected;
  }

  // 3. Fallback to top available product on the list
  return availableProducts[0]?.slug || null;
}
