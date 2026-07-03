# USD to INR Real-Time Chrome Extension

A lightweight, high-performance Google Chrome Extension (Manifest V3) that automatically detects USD prices on any webpage and appends the equivalent INR price in real-time.

Designed specifically for developers and users browsing American websites, e-commerce stores, and AI compute/API pricing pages.

## Features

- **Real-Time Exchange Rates**: Fetches live rates from a reliable exchange rate API.
- **Smart Caching**: Caches the conversion rate in `chrome.storage.local` for 4 hours to keep page loading times instant and prevent API rate limiting.
- **Fractional Pricing Support**: Accurately detects and converts prices with arbitrary decimal places (e.g., `$0.105` or `$0.00015` per token), making it perfect for AI model API pricing pages.
- **Dynamic Content Injection**: Uses `MutationObserver` and `TreeWalker` to convert dynamically loaded content (such as infinite scroll or React updates) without infinite rendering loops.
- **Safe DOM Parsing**: Ignores inputs, textareas, code blocks (`<pre>`, `<code>`), and style sheets to avoid altering code snippets or breaking page layouts.

## Installation (Developer Mode)

Since this extension is not hosted on the Chrome Web Store, you can load it locally:

1. **Get the files**: [Download the ZIP](https://github.com/Abhinav-Rust/usd-to-inr-chrome-extension/archive/refs/heads/main.zip) directly and extract it, or clone the repository using the command below:
   ```bash
   git clone https://github.com/Abhinav-Rust/usd-to-inr-chrome-extension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the folder containing these files (`usd-to-inr-extension`).

The extension is now active! Open any webpage containing USD prices (e.g. OpenAI Pricing) to see it in action.

## Project Structure

- `manifest.json`: Configuration file defining permissions, scripts, and details.
- `content.js`: Main script running price detection, storage caching, DOM traversal, and MutationObserving.
