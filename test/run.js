#!/usr/bin/env node
/**
 * Runs every test in test/ — the files named *.test.js — each in its own process, a few at a
 * time, and fails if any of them fails (openvibe-shared/test-runner, this package's own copy).
 *
 *   npm test                  # everything
 *   npm test -- navbar icons  # only files whose name contains one of the words
 *   npm test -- --strict      # a skipped test fails the run too
 *
 * Plain Node with stubbed browser globals: no network, no running site. The exceptions are the
 * *-chrome.test.js files, which start headless Chrome against a local fixture when Chrome is
 * installed and print `<name>: skipped (no Chrome; …)` otherwise (OV_SKIP_BROWSER=1 skips them too):
 * a skipped file is listed with ○ and never counted as passed.
 */
'use strict';
// A headless-Chrome file that fails is run once more (a slow runner, not a wrong page); the summary names any that
// needed it. 90 s, not 60: dock-chrome takes ~57 s on a macos runner (2026-11-10), so 60 killed a healthy test.
require('../test-runner').main({ dir: __dirname, timeoutMs: 90000, pad: 36, serial: /-chrome\.test\.js$/, retry: /-chrome\.test\.js$/ });
