/* Shared OpenVibe upload UI. Sites supply their upload(file, {onProgress}) transport. */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) root.OVUpload = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function size(bytes) {
        if (!Number.isFinite(bytes)) return '0 B';
        if (bytes < 1024) return Math.round(bytes) + ' B';
        var unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
        return (bytes / Math.pow(1024, unit)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][unit];
    }
    function timeLeft(seconds) {
        if (!Number.isFinite(seconds)) return 'Estimating time left';
        if (seconds < 5) return 'Almost done';
        if (seconds < 60) return 'About ' + Math.ceil(seconds / 5) * 5 + ' sec left';
        if (seconds < 3600) return 'About ' + Math.ceil(seconds / 60) + ' min left';
        return 'About ' + Math.ceil(seconds / 3600) + ' hr left';
    }
    // SubtleCrypto has no streaming digest API. Read in slices to keep file access responsive,
    // then hash only modest files so hashing cannot become an unbounded pre-upload cost.
    async function sha256(file, maxBytes) {
        if (!globalThis.crypto || !globalThis.crypto.subtle || file.size > (maxBytes || 32 * 1024 * 1024)) return null;
        var sampleSize = Math.min(file.size, 1024 * 1024);
        var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        var sample = await file.slice(0, sampleSize).arrayBuffer();
        await globalThis.crypto.subtle.digest('SHA-256', sample);
        var measuredMs = Math.max(1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        var uploadMbps = typeof navigator !== 'undefined' && navigator.connection && Number(navigator.connection.downlink) > 0
            ? Number(navigator.connection.downlink) : 10;
        var estimatedHashMs = (file.size / Math.max(1, sampleSize)) * measuredMs + 4;
        var estimatedUploadMs = 600 + (file.size / (uploadMbps * 125000)) * 1000;
        if (estimatedHashMs > estimatedUploadMs) return null;
        var chunks = [], size = 0, step = 1024 * 1024;
        for (var at = 0; at < file.size; at += step) {
            var part = await file.slice(at, Math.min(file.size, at + step)).arrayBuffer();
            chunks.push(part); size += part.byteLength;
        }
        var all = new Uint8Array(size), offset = 0;
        chunks.forEach(function (part) { all.set(new Uint8Array(part), offset); offset += part.byteLength; });
        var digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', all));
        return Array.from(digest, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    // Seconds are smoothed by measured bytes per second, not the last network burst.
    function rate(previous, deltaBytes, deltaSeconds, alpha) {
        if (deltaBytes <= 0 || deltaSeconds <= 0) return previous || 0;
        var sample = deltaBytes / deltaSeconds;
        return previous > 0 ? (alpha || 0.25) * sample + (1 - (alpha || 0.25)) * previous : sample;
    }
    // Line icons (constants, never data): upload, a file, close.
    var ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0-4.5 4.5M12 4l4.5 4.5"/><path d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/></svg>';
    var ICON_FILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
    var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    function node(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = text;
        return el;
    }
    function progress(el, options) {
        options = options || {};
        el.classList.add('ov-progress');
        if (options.compact) el.classList.add('ov-progress--row');
        var label = node('span', 'ov-progress__label', 'Waiting');
        var percent = node('strong', 'ov-progress__percent', '0%');
        var heading = node('div', 'ov-progress__heading');
        heading.append(label, percent);
        var track = node('div', 'ov-progress__track');
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        var fill = node('div', 'ov-progress__fill');
        track.append(fill);
        var detail = node('p', 'ov-progress__detail', 'Ready when you are');
        var retry = node('button', 'ov-progress__retry', 'Retry');
        retry.type = 'button'; retry.hidden = true;
        retry.addEventListener('click', function () { if (options.onRetry) options.onRetry(); });
        el.replaceChildren(heading, track, detail, retry);
        var current = { state: 'waiting', done: 0, total: 0, rate: 0, at: 0, lastBytes: 0, message: '' };
        function render() {
            var state = current.state;
            var pct = current.total ? Math.min(100, Math.floor(current.done / current.total * 100)) : 0;
            el.dataset.state = state;
            label.textContent = ({ waiting: 'Waiting', sending: 'Uploading', paused: 'Paused: no connection', processing: 'Processing: making it playable', done: 'Uploaded', failed: 'Upload failed' })[state] || state;
            if (state === 'done') percent.innerHTML = '<svg class="ov-progress__check" viewBox="0 0 24 24" role="img" aria-label="Done"><path d="M4 12l5 5L20 6"/></svg>';
            else percent.textContent = pct + '%';
            fill.style.width = (state === 'done' ? 100 : pct) + '%';
            track.setAttribute('aria-valuenow', String(pct));
            track.setAttribute('aria-valuetext', label.textContent + ', ' + pct + '%');
            var meta = current.total ? size(current.done) + ' of ' + size(current.total) : '';
            if (state === 'sending') detail.textContent = [meta, current.rate ? size(current.rate) + '/s' : '', timeLeft((current.total - current.done) / current.rate)].filter(Boolean).join(' · ');
            else if (state === 'paused') detail.textContent = 'Your upload resumes when the connection returns.';
            else if (state === 'processing') detail.textContent = current.message || 'Finishing your file';
            else if (state === 'failed') detail.textContent = current.message || 'The upload did not go through.';
            else if (state === 'done') detail.textContent = current.message || 'Your file is ready.';
            else detail.textContent = meta || 'Ready when you are';
            retry.hidden = state !== 'failed';
        }
        function update(next) {
            next = next || {};
            var now = Date.now();
            var done = Math.max(0, Number(next.done == null ? current.done : next.done) || 0);
            var total = Math.max(0, Number(next.total == null ? current.total : next.total) || 0);
            if (done > current.lastBytes && current.at) current.rate = rate(current.rate, done - current.lastBytes, (now - current.at) / 1000);
            if (done !== current.lastBytes) { current.lastBytes = done; current.at = now; }
            current.done = done; current.total = total;
            if (next.state) current.state = next.state;
            if (next.message !== undefined) current.message = next.message;
            render();
        }
        var timer = typeof window === 'undefined' ? null : window.setInterval(function () {
            if (current.state !== 'sending') return;
            if (Date.now() - current.at > 5000) current.rate *= 0.65;
            render();
        }, 1000);
        render();
        return { update: update, destroy: function () { if (timer) clearInterval(timer); } };
    }
    async function preflight(file, lookup, row, callbacks, maxBytes) {
        if (typeof lookup !== 'function') return null;
        var hash = await sha256(file, maxBytes);
        if (!hash) return null;
        var existing = await lookup(file, hash);
        if (!existing) return null;
        var target = existing.object || existing;
        var actions = node('div', 'ov-upload__duplicate-actions');
        var note = node('p', 'ov-upload__duplicate-note', 'You already uploaded this on ' + (target.date || target.created_at || 'an earlier date') + '.');
        var open = node('a', 'ovk-btn ovk-btn--quiet', 'Open it'); open.href = target.address || target.url || '#';
        var use = node('button', 'ovk-btn ovk-btn--quiet', 'Use that one'); use.type = 'button';
        use.addEventListener('click', function () { if (callbacks && callbacks.onUse) callbacks.onUse(target); });
        var again = node('button', 'ovk-btn ovk-btn--quiet', 'Upload again'); again.type = 'button';
        again.addEventListener('click', function () { actions.remove(); if (callbacks && callbacks.onAgain) callbacks.onAgain(); });
        actions.append(note, open, use, again); row.append(actions);
        row.dispatchEvent(new CustomEvent('ov-upload:duplicate', { detail: { file: file, existing: target } }));
        if (callbacks && callbacks.onDuplicate) callbacks.onDuplicate(target);
        return target;
    }
    function picker(root, options) {
        options = options || {};
        var input = node('input', 'ov-upload__input');
        input.type = 'file'; input.accept = options.accept || ''; input.multiple = !!options.multiple;
        input.setAttribute('aria-label', options.label || 'Choose a file');
        var card = node('button', 'ov-upload__picker');
        card.type = 'button';
        card.innerHTML = '<span class="ov-upload__icon" aria-hidden="true">' + ICON_UP + '</span><strong></strong><span class="ov-upload__drop">or drop ' + (options.multiple ? 'them' : 'it') + ' here</span>';
        card.querySelector('strong').textContent = options.label || 'Choose a file';
        card.addEventListener('click', function () { input.click(); });
        var rows = node('div', 'ov-upload__rows');
        root.classList.add('ov-upload'); root.append(input, card, rows);
        function add(files) {
            Array.prototype.forEach.call(options.multiple ? files : Array.prototype.slice.call(files, 0, 1), function (file) {
                var row = node('div', 'ov-upload__row');
                var preview = node('div', 'ov-upload__preview'); preview.innerHTML = ICON_FILE;
                if (file.type.indexOf('image/') === 0 || file.type.indexOf('video/') === 0) {
                    var url = URL.createObjectURL(file);
                    var media = node(file.type.indexOf('image/') === 0 ? 'img' : 'video');
                    media.src = url; media.muted = true; media.preload = 'metadata'; media.setAttribute('aria-hidden', 'true');
                    media.addEventListener('loadeddata', function () { if (media.tagName === 'VIDEO') media.currentTime = Math.min(0.1, media.duration || 0); }, { once: true });
                    row.addEventListener('remove', function () { URL.revokeObjectURL(url); });
                    preview.replaceChildren(media);
                }
                var text = node('div', 'ov-upload__file');
                text.append(node('strong', '', file.name), node('small', '', size(file.size)));
                var remove = node('button', 'ov-upload__remove'); remove.type = 'button'; remove.innerHTML = ICON_X;
                remove.setAttribute('aria-label', 'Remove ' + file.name); remove.title = 'Remove';
                remove.addEventListener('click', function () { row.dispatchEvent(new Event('remove')); row.remove(); if (options.onRemove) options.onRemove(file); });
                row.append(preview, text, remove); rows.append(row);
                if (options.onFile) options.onFile(file, row);
            });
        }
        input.addEventListener('change', function () { add(input.files); input.value = ''; });
        root.addEventListener('dragover', function (e) { e.preventDefault(); root.classList.add('is-dragging'); });
        root.addEventListener('dragleave', function () { root.classList.remove('is-dragging'); });
        root.addEventListener('drop', function (e) { e.preventDefault(); root.classList.remove('is-dragging'); if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files); });
        return { input: input, add: add, rows: rows };
    }
    function queue(root, options) {
        options = options || {};
        if (typeof options.upload !== 'function') throw new TypeError('OVUpload.queue: upload(file, {onProgress, signal}) is required');
        var pickRoot = node('div');
        var totalRoot = node('div', 'ov-upload__total');
        totalRoot.hidden = true;
        root.append(pickRoot);
        var items = [], active = 0;
        var total = progress(totalRoot);
        function refresh() {
            var bytes = items.reduce(function (n, item) { return n + item.file.size; }, 0);
            var done = items.reduce(function (n, item) { return n + item.done; }, 0);
            var state = items.some(function (item) { return item.state === 'sending'; }) ? 'sending'
                : items.some(function (item) { return item.state === 'failed'; }) ? 'failed'
                    : items.length && items.every(function (item) { return item.state === 'done' || item.state === 'duplicate'; }) ? 'done' : 'waiting';
            total.update({ done: done, total: bytes, state: state, message: state === 'failed' ? 'A file needs a retry.' : '' });
            totalRoot.hidden = items.length < 2;
        }
        function pump() {
            while (active < (options.concurrency || 3)) {
                var item = items.find(function (x) { return x.state === 'waiting'; });
                if (!item) break;
                item.state = 'checking'; active++;
                item.meter.update({ state: 'sending', done: item.done, total: item.file.size }); refresh();
                (function (entry) {
                    entry.controller = new AbortController();
                    Promise.resolve().then(async function () {
                        if (options.checkDuplicate && !entry.keepBoth) {
                            var hash = await sha256(entry.file, options.hashLimitBytes);
                            if (hash) {
                                var existing = await options.checkDuplicate(entry.file, hash);
                                entry.sha256 = hash;
                                if (existing) {
                                    existing = existing.object || existing;
                                    entry.state = 'duplicate'; entry.duplicate = existing;
                                    entry.meter.update({ state: 'done', done: entry.file.size, total: entry.file.size, message: 'You already uploaded this on ' + (existing.date || existing.created_at || 'an earlier date') + '.' });
                                    entry.duplicateActions = duplicateActions(entry, existing);
                                    if (options.onDuplicate) options.onDuplicate(entry.file, existing);
                                    root.dispatchEvent(new CustomEvent('ov-upload:duplicate', { detail: { file: entry.file, existing: existing } }));
                                    refresh(); return { __duplicate: true };
                                }
                            }
                        }
                        return options.upload(entry.file, {
                        signal: entry.controller.signal,
                        keepBoth: !!entry.keepBoth,
                        sha256: entry.sha256 || null,
                        onProgress: function (value) {
                            entry.done = Math.max(0, Math.min(entry.file.size, Number(value.uploadedBytes == null ? value.done : value.uploadedBytes) || 0));
                            entry.meter.update({ state: 'sending', done: entry.done, total: entry.file.size }); refresh();
                        }
                    }); }).then(function (result) {
                        if (entry.removed) return;
                        if (result && result.__duplicate) return;
                        entry.done = entry.file.size; entry.state = 'done';
                        entry.meter.update({ state: 'done', done: entry.done, total: entry.file.size });
                        if (options.onDone) options.onDone(entry.file, result);
                    }).catch(function (error) {
                        if (entry.removed) return;
                        entry.state = 'failed';
                        entry.meter.update({ state: 'failed', message: error && error.message || 'The upload did not go through.' });
                    }).finally(function () { active--; refresh(); pump(); });
                })(item);
            }
        }
        function duplicateActions(entry, existing) {
            var actions = node('div', 'ov-upload__duplicate-actions');
            var open = node('a', 'ovk-btn ovk-btn--quiet', 'Open it'); open.href = existing.url || existing.address || '#';
            open.addEventListener('click', function () { if (options.onOpenDuplicate) options.onOpenDuplicate(entry.file, existing); });
            var use = node('button', 'ovk-btn ovk-btn--quiet', 'Use that one'); use.type = 'button';
            use.addEventListener('click', function () { entry.done = entry.file.size; entry.state = 'done'; entry.meter.update({ state: 'done', done: entry.done, total: entry.file.size, message: 'Using the picture you already uploaded.' }); refresh(); if (options.onDone) options.onDone(entry.file, existing); root.dispatchEvent(new CustomEvent('ov-upload:done', { detail: { file: entry.file, result: existing, duplicate: true } })); });
            var again = node('button', 'ovk-btn ovk-btn--quiet', 'Upload again'); again.type = 'button';
            again.addEventListener('click', function () { entry.keepBoth = true; entry.state = 'waiting'; entry.meter.update({ state: 'waiting', done: 0, total: entry.file.size, message: '' }); actions.remove(); entry.duplicate = null; pump(); });
            actions.append(open, use, again); entry.row.append(actions); return actions;
        }
        var pick = picker(pickRoot, {
            label: options.label, accept: options.accept, multiple: options.multiple !== false,
            onFile: function (file, row) {
                var meterRoot = node('div', 'ov-upload__meter'); row.append(meterRoot); row.classList.add('has-meter');
                var item = { file: file, row: row, meterRoot: meterRoot, done: 0, state: 'waiting' };
                item.meter = progress(meterRoot, { compact: true, onRetry: function () { item.state = 'waiting'; pump(); } });
                items.push(item); refresh(); pump();
            },
            onRemove: function (file) {
                var item = items.find(function (x) { return x.file === file; });
                if (!item) return;
                item.removed = true;
                if (item.controller) item.controller.abort();
                item.meter.destroy(); item.meterRoot.remove();
                items.splice(items.indexOf(item), 1); refresh();
            }
        });
        pick.rows.before(totalRoot);   // the total sits between the picker and the files
        return { picker: pick, total: total, items: items };
    }
        return { progress: progress, picker: picker, queue: queue, preflight: preflight, rate: rate, timeLeft: timeLeft, size: size, sha256: sha256 };
});
