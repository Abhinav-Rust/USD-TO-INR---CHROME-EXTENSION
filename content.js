// USD to INR Real-time Converter Content Script
// Automatically scans text nodes on web pages, extracts USD prices,
// fetches exchange rates (cached for 4 hours), and appends INR conversions.

const CACHE_KEY_RATE = 'usd_to_inr_rate';
const CACHE_KEY_TIME = 'usd_to_inr_last_fetched';
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_FALLBACK_RATE = 83.50; // Standard fallback rate

const processedNodes = new WeakSet();
let usdToInrRate = null;
let mutationObserver = null;

// Regex matches both prefix ($100, USD 100) and suffix (100 USD) formats:
// Group 1: Prefix price match
// Group 2: Suffix price match
// Supports any number of decimals (crucial for fractional API token pricing like $0.00015 or $0.105)
const usdRegex = /(?:\$\s*|USD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)|\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*USD\b/gi;

// HTML tags to skip scanning to avoid breaking page functionality or styling
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'IFRAME', 'CODE', 'PRE', 'CANVAS', 'SVG']);

function shouldSkipNode(node) {
  if (!node) return true;
  // Check the element itself or its parent element
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element) return false;
  
  if (SKIP_TAGS.has(element.tagName.toUpperCase())) {
    return true;
  }
  return false;
}

function isEditable(node) {
  let parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (parent) {
    if (parent.contentEditable === 'true' || parent.designMode === 'on') {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

function convertTextNode(node) {
  if (!usdToInrRate) return;
  if (shouldSkipNode(node) || isEditable(node)) return;

  if (processedNodes.has(node)) {
    // If the website updated the text node content and wiped out our conversion, re-process it
    if (!node.nodeValue.includes('(~₹')) {
      processedNodes.delete(node);
    } else {
      return;
    }
  }

  const originalVal = node.nodeValue;
  if (!originalVal || !originalVal.trim()) return;

  usdRegex.lastIndex = 0;
  if (!usdRegex.test(originalVal)) return;

  usdRegex.lastIndex = 0;
  const newVal = originalVal.replace(usdRegex, (match, p1, p2) => {
    const priceStr = p1 || p2;
    // Strip commas from numbers like 1,299.99
    const price = parseFloat(priceStr.replace(/,/g, ''));
    if (isNaN(price)) return match;

    const inrPrice = price * usdToInrRate;
    const hasDecimals = priceStr.includes('.');
    const decimalPlaces = hasDecimals ? (priceStr.split('.')[1] || '').length : 0;
    
    // Format the number in Indian standard numbering system (e.g. 1,00,000)
    // Matches the decimal precision of the input price (at least 2 decimals if decimals exist)
    const formattedInr = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: hasDecimals ? Math.max(2, decimalPlaces) : 0,
      maximumFractionDigits: hasDecimals ? Math.max(2, decimalPlaces) : 0
    }).format(inrPrice);

    return `${match} (~${formattedInr})`;
  });

  if (newVal !== originalVal) {
    node.nodeValue = newVal;
    processedNodes.add(node);
  }
}

function processSubtree(root) {
  if (!root) return;
  
  if (root.nodeType === Node.TEXT_NODE) {
    convertTextNode(root);
    return;
  }
  
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (shouldSkipNode(root) || isEditable(root)) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (shouldSkipNode(node) || isEditable(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach(convertTextNode);
}

function startObserving() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    // Pause observer while modifying the DOM to avoid infinite mutation loop
    mutationObserver.disconnect();

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          processSubtree(node);
        });
      } else if (mutation.type === 'characterData') {
        convertTextNode(mutation.target);
      }
    }

    // Resume observing
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

async function getExchangeRate() {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get([CACHE_KEY_RATE, CACHE_KEY_TIME], resolve);
    });

    const cachedRate = data[CACHE_KEY_RATE];
    const lastFetched = data[CACHE_KEY_TIME];

    if (cachedRate && lastFetched && (Date.now() - lastFetched < CACHE_DURATION)) {
      return cachedRate;
    }

    // Fetch fresh exchange rate
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('API response not successful');

    const json = await response.json();
    if (json && json.rates && json.rates.INR) {
      const newRate = json.rates.INR;
      chrome.storage.local.set({
        [CACHE_KEY_RATE]: newRate,
        [CACHE_KEY_TIME]: Date.now()
      });
      return newRate;
    }
    throw new Error('Invalid rate response format');
  } catch (error) {
    console.warn('[USD-to-INR] Failed to get live rate; checking cache. Error:', error);
    // If API fetch fails, fallback to older cache
    const data = await new Promise((resolve) => {
      chrome.storage.local.get([CACHE_KEY_RATE], resolve);
    });
    if (data[CACHE_KEY_RATE]) {
      return data[CACHE_KEY_RATE];
    }
    // Absolute fallback if no cache exists
    console.warn(`[USD-to-INR] Fallback rate of ${DEFAULT_FALLBACK_RATE} applied.`);
    return DEFAULT_FALLBACK_RATE;
  }
}

async function init() {
  usdToInrRate = await getExchangeRate();
  if (usdToInrRate) {
    processSubtree(document.body);
    startObserving();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
