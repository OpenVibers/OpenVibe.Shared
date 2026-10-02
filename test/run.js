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
require('../test-runner').main({ dir: __dirname, timeoutMs: 60000, pad: 36, serial: /-chrome\.test\.js$/ });
