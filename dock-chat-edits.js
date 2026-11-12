/* Edit events for an open Dock DM, over Chat's socket: another of my devices (or this one) edited a message, and the
   Dock's apply() redraws it. Loaded when the conversation opens. Editing itself is the Dock's own (4.220.0: the box is the
   editor, a pencil at the bubble's corner starts it; no browser prompt). */
(function (root) {
    'use strict';
    root.OpenVibeDockChatEdits = function ({ id, apply, tokenOf, chatBase, active }) {
        let socket = null, timer = null, stopped = false;
        async function connect() {
            if (stopped || !active() || !root.WebSocket) return;
            const token = await tokenOf();
            if (!token || stopped || !active()) return;
            const ws = new root.WebSocket(chatBase().replace(/^http/, 'ws') + '/ws/chat');
            socket = ws;
            ws.onopen = () => ws.send(JSON.stringify({ type: 'join', token }));
            ws.onmessage = (event) => { let frame; try { frame = JSON.parse(event.data); } catch { return; } if (frame.type === 'dm_edited' && String(frame.conversation_id) === id && active()) apply(frame.message); };
            ws.onclose = () => { if (socket === ws) socket = null; if (!stopped && active()) timer = setTimeout(connect, 3000); };
        }
        connect().catch(() => {});
        return { stop() { stopped = true; clearTimeout(timer); if (socket) { socket.onclose = null; socket.close(); socket = null; } } };
    };
})(typeof window === 'undefined' ? globalThis : window);
