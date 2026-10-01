'use strict';

const { BRAND, BRAND_DEFAULTS, resolveBrandUrls, buildBrandFromRegistry } = require('./brand');
const { OpenVibeAuthClient } = require('./auth-client');
const { CSS_VARIABLES, DEFAULT_VARS, BUILTIN_THEMES, applyTheme, resolveBuiltinTheme, sanitizeCssValue, loadFromStorage, saveToStorage, syncThemeToServer } = require('./theme-sync');
const { extractToken, requireOpenVibeAuth, optionalOpenVibeAuth } = require('./middleware');
const { PRIORITY, CATEGORY, TYPES, SOUNDS, EMAIL_ELIGIBLE_CATEGORIES, createNotification, DEFAULT_NOTIFICATION_PREFS } = require('./notifications');
const { AnalyticsTracker, classifyRequest, parseUserAgent, ANALYTICS_SCHEMA, BOT_USER_AGENTS, SUSPICIOUS_PATTERNS } = require('./analytics');
const { URL_DEFINITIONS, normalizeValue, validateValue, resolveRegistryValues, formatRegistryEntry } = require('./url-resolver');
const seo = require('./seo');

module.exports = {
    // Brand
    BRAND,
    BRAND_DEFAULTS,
    buildBrandFromRegistry,
    // Auth
    OpenVibeAuthClient,
    extractToken,
    requireOpenVibeAuth,
    optionalOpenVibeAuth,
    // Themes
    CSS_VARIABLES,
    DEFAULT_VARS,
    BUILTIN_THEMES,
    applyTheme,
    resolveBuiltinTheme,
    sanitizeCssValue,
    loadFromStorage,
    saveToStorage,
    syncThemeToServer,
    // Notifications
    PRIORITY,
    CATEGORY,
    NOTIFICATION_TYPES: TYPES,
    SOUNDS,
    EMAIL_ELIGIBLE_CATEGORIES,
    createNotification,
    DEFAULT_NOTIFICATION_PREFS,
    // Analytics
    AnalyticsTracker,
    classifyRequest,
    parseUserAgent,
    ANALYTICS_SCHEMA,
    BOT_USER_AGENTS,
    SUSPICIOUS_PATTERNS,
    // URL Registry Resolver
    URL_DEFINITIONS,
    normalizeValue,
    validateValue,
    resolveRegistryValues,
    formatRegistryEntry,
    resolveBrandUrls,
    // SEO kit (also available from openvibe-shared/seo)
    seo,
    // Client-side modules (browser only — require() for bundlers, <script> tag for direct use)
    // OpenVibeNotifications: require('./notification-ui'),
    // OpenVibeUserCard: require('./user-card'),
    // OpenVibeNavbar: require('./navbar'),
    // OpenVibeAccountSwitcher: require('./account-switcher'),
};
