/**
 * openvibe-shared/components.js — the OpenVibe kit's components as a contract that is not HTML, so the web, Android and
 * iOS can each draw them natively (the owner, 2026-10-29: "translate it to official and optimized Android and iOS apps …
 * that aren't just web browser reskin kiosks").
 *
 * Every component is described by data: what it is for, its parts (anatomy) and the design tokens each part wears
 * (openvibe-shared/tokens' names), its props, variants, states, accessibility and how it behaves on a phone, a tablet and
 * a computer. The web draws it with kit.js today; `native` holds a reference view for Jetpack Compose and for SwiftUI
 * that uses the same tokens (Material 3 roles from the theme's colour scheme, OvScale for the scales).
 *
 * A screen can then be sent as a **kit document**, a JSON tree of components that any client renders with its own
 * views (the server-driven UI pattern of Airbnb's Ghost Platform and Yandex's DivKit):
 *
 *   { type: 'section', props: { title: 'Right now' }, children: [
 *       { type: 'rail', props: { id: 'now', title: 'Live', more: { href: '/live', label: 'See all' } }, children: [
 *           { type: 'card', props: { href: '/c/1', title: 'Night walk', type: 'stream', live: true, who: 'goosely' } } ] } ] }
 *
 *   const components = require('openvibe-shared/components');   // in a page: /shared/components.js → OpenVibeComponents
 *   components.SPECS                       the contract: [{ id, name, summary, role, anatomy, props, variants, … }]
 *   components.get(id)                     one spec
 *   components.validate(doc)               → { ok, errors: ['card.props.title: required', …] }
 *   components.render(doc, kit)            → HTML through kit.js (refuses an invalid document); kit defaults to window.OpenVibeKit
 *
 * validate() is strict: known types and props only, typed values, enums, required props, which children a component
 * takes, at most 8 levels and 400 nodes, strings at most 2,000 characters. render() goes through kit.js, which escapes
 * every text and keeps only http(s) or same-site links, so a document from anywhere renders safely.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeComponents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const VERSION = 1;
    const LIMITS = Object.freeze({ depth: 8, nodes: 400, string: 2000, items: 60 });

    // Prop types: 'string', 'text' (long string), 'url', 'boolean', 'number', 'icon', ['a', 'b'] (one of), 'link'
    // ({ href, label }), 'count' ([n, 'word'] or n), 'stats' ([[value, label, href?]…]), 'tabs' ([{ key, label, count }]).
    const STATES = { press: ['default', 'hover', 'pressed', 'focused', 'disabled'], read: ['default', 'empty', 'loading'] };

    const SPECS = [
        {
            id: 'button', name: 'Button', web: 'kit.button',
            summary: 'One action: a link or a form button. Primary for the one thing to do, quiet beside it, danger for what cannot be undone.',
            role: 'button (link when it has href)',
            anatomy: [
                { part: 'container', tokens: { background: 'color.accent.strong', radius: 'radius.pill', minHeight: 'size.tap', paddingX: 'space.lg' } },
                { part: 'label', tokens: { color: 'color.accent.onStrong', size: 'type.size.body', weight: 'type.weight.bold' } },
                { part: 'icon', optional: true, tokens: { size: 'size.icon', color: 'color.accent.onStrong' } },
            ],
            props: { label: { type: 'string', required: true }, href: { type: 'url' }, icon: { type: 'icon' }, kind: { type: ['primary', 'quiet', 'danger'], default: 'primary' }, small: { type: 'boolean' } },
            variants: { kind: { primary: 'container color.accent.strong, label color.accent.onStrong', quiet: 'container transparent with a color.line.strong outline, label color.text.primary', danger: 'container color.status.bad.base, label color.accent.onStrong' } },
            states: STATES.press,
            a11y: { name: 'its label', keys: 'Enter (and Space as a button)', minTarget: '44 × 44 on touch' },
            layout: { phone: 'full width in a form\'s last row; two side by side in a hero', computer: 'its own width' },
            native: {
                compose: `@Composable
fun OvButton(label: String, onClick: () -> Unit, kind: OvKind = OvKind.Primary, icon: ImageVector? = null) {
    val c = MaterialTheme.colorScheme
    val colors = when (kind) {
        OvKind.Primary -> ButtonDefaults.buttonColors(containerColor = c.primaryContainer, contentColor = c.onPrimaryContainer)
        OvKind.Danger -> ButtonDefaults.buttonColors(containerColor = c.error, contentColor = c.onError)
        OvKind.Quiet -> ButtonDefaults.outlinedButtonColors(contentColor = c.onSurface)
    }
    val content: @Composable RowScope.() -> Unit = {
        if (icon != null) { Icon(icon, contentDescription = null, Modifier.size(OvScale.SizeIcon)); Spacer(Modifier.width(OvScale.SpaceSm)) }
        Text(label, fontWeight = FontWeight.Bold)
    }
    val m = Modifier.heightIn(min = OvScale.SizeTap)
    if (kind == OvKind.Quiet) OutlinedButton(onClick, m, shape = RoundedCornerShape(OvScale.RadiusPill), colors = colors, border = BorderStroke(1.dp, c.outline), content = content)
    else Button(onClick, m, shape = RoundedCornerShape(OvScale.RadiusPill), colors = colors, content = content)
}`,
                swiftui: `struct OvButton: View {
    let label: String
    var kind: OvKind = .primary
    var icon: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label { Text(label).fontWeight(.bold) } icon: { if let icon { Image(systemName: icon) } }
                .frame(minHeight: OvScale.sizeTap)
                .padding(.horizontal, OvScale.spaceLg)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .tint(kind == .danger ? OvTokens.colorStatusBadBase : kind == .quiet ? .clear : OvTokens.colorAccentStrong)
        .foregroundStyle(kind == .quiet ? OvTokens.colorTextPrimary : OvTokens.colorAccentOnStrong)
    }
}`,
            },
        },
        {
            id: 'card', name: 'Card', web: 'kit.card',
            summary: 'One thing, the same anatomy everywhere: a stream, a clip, a listing, a game, a paste. The whole card is one link.',
            role: 'article with a heading link',
            anatomy: [
                { part: 'media', tokens: { background: 'color.bg.hover', radius: 'radius.md' }, note: 'in the type\'s shape (16:9 streams and clips, 1:1 listings and memes, 4:3 games and reports); a picture, a text preview or the type\'s icon' },
                { part: 'badge', optional: true, tokens: { background: 'rgba(0,0,0,.74)', color: '#fff' }, note: 'top left, one word; LIVE is color.status.live.base' },
                { part: 'corner', optional: true, note: 'bottom right: a length or a price' },
                { part: 'title', tokens: { color: 'color.text.primary', size: 'type.size.body', weight: 'type.weight.bold' }, note: 'two lines at most' },
                { part: 'sub', optional: true, tokens: { color: 'color.text.secondary', size: 'type.size.meta' }, note: 'one plain line' },
                { part: 'meta', optional: true, tokens: { color: 'color.text.muted', size: 'type.size.meta' }, note: 'who · one count · when; a count of 0 is left out' },
                { part: 'more', optional: true, note: 'the ⋯ menu: Save, Remind, Share' },
            ],
            props: { href: { type: 'url', required: true }, title: { type: 'string', required: true }, type: { type: 'string' }, ratio: { type: 'string' }, image: { type: 'url' }, alt: { type: 'string' }, badge: { type: 'string' }, live: { type: 'boolean' }, corner: { type: 'string' }, sub: { type: 'string' }, preview: { type: 'text' }, who: { type: 'string' }, avatar: { type: 'url' }, count: { type: 'count' }, when: { type: 'string' }, level: { type: 'number' } },
            variants: { type: { stream: '16:9, a LIVE badge when live', clip: '16:9 with its length', listing: '1:1 with its price', game: '4:3', post: '16:9, a text preview when it has no picture' } },
            states: ['default', 'hover (the picture zooms, the peek shows)', 'focused', 'live'],
            a11y: { name: 'its title (the heading\'s link)', keys: 'Tab to the card, Enter opens it; the menu is its own stop', minTarget: 'the whole card' },
            layout: { phone: 'about 1.2 to a rail, swiped', computer: 'a fixed width in a rail, or a grid' },
            native: {
                compose: `@Composable
fun OvCard(title: String, onOpen: () -> Unit, image: String? = null, ratio: Float = 16f / 9f, badge: String? = null, sub: String? = null, meta: String? = null) {
    val c = MaterialTheme.colorScheme
    Column(Modifier.clickable(onClickLabel = title, onClick = onOpen).semantics(mergeDescendants = true) { heading() }) {
        Box(Modifier.fillMaxWidth().aspectRatio(ratio).clip(RoundedCornerShape(OvScale.RadiusMd)).background(c.surfaceVariant)) {
            if (image != null) AsyncImage(image, contentDescription = null, Modifier.matchParentSize(), contentScale = ContentScale.Crop)
            if (badge != null) Text(badge, Modifier.padding(OvScale.SpaceSm).background(Color(0xBD000000), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp)
        }
        Spacer(Modifier.height(OvScale.SpaceMd))
        Text(title, color = c.onSurface, fontWeight = FontWeight.Bold, fontSize = OvScale.TypeSizeBody, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (sub != null) Text(sub, color = c.onSurfaceVariant, fontSize = OvScale.TypeSizeMeta, maxLines = 1)
        if (meta != null) Text(meta, color = c.onSurfaceVariant, fontSize = OvScale.TypeSizeMeta, maxLines = 1)
    }
}`,
                swiftui: `struct OvCard: View {
    let title: String
    var image: URL? = nil
    var ratio: CGFloat = 16 / 9
    var badge: String? = nil
    var sub: String? = nil
    var meta: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: OvScale.radiusMd).fill(OvTokens.colorBgHover)
                if let image { AsyncImage(url: image) { $0.resizable().scaledToFill() } placeholder: { Color.clear } }
                if let badge { Text(badge).font(.caption2.weight(.heavy)).foregroundStyle(.white).padding(.horizontal, 8).background(.black.opacity(0.74), in: .rect(cornerRadius: 6)).padding(OvScale.spaceSm) }
            }
            .aspectRatio(ratio, contentMode: .fit).clipShape(.rect(cornerRadius: OvScale.radiusMd))
            .padding(.bottom, OvScale.spaceSm)
            Text(title).font(.system(size: OvScale.typeSizeBody, weight: .bold)).foregroundStyle(OvTokens.colorTextPrimary).lineLimit(2)
            if let sub { Text(sub).font(.system(size: OvScale.typeSizeMeta)).foregroundStyle(OvTokens.colorTextSecondary).lineLimit(1) }
            if let meta { Text(meta).font(.system(size: OvScale.typeSizeMeta)).foregroundStyle(OvTokens.colorTextMuted).lineLimit(1) }
        }
        .accessibilityElement(children: .combine).accessibilityAddTraits(.isLink)
    }
}`,
            },
        },
        {
            id: 'rail', name: 'Rail', web: 'kit.rail',
            summary: 'A row of cards that scrolls sideways and snaps, with its heading and one See all link. From 760 px it can wrap into a grid.',
            role: 'region named by its heading; a list of cards',
            children: ['card'],
            anatomy: [
                { part: 'head', tokens: { size: 'type.size.lead', weight: 'type.weight.heavy' }, note: 'the title and See all (44 px to the touch)' },
                { part: 'track', tokens: { gap: 'space.md' }, note: 'snaps to each card; bleeds to the screen\'s edge on a phone' },
                { part: 'arrows', optional: true, note: '‹ › on computers only, each hidden at its end' },
            ],
            props: { id: { type: 'string' }, title: { type: 'string' }, more: { type: 'link' }, size: { type: ['s', 'm', 'l'], default: 'm' }, wrap: { type: 'boolean' }, label: { type: 'string' } },
            variants: { size: { s: 'square things (memes, deals), 190 px', m: '16:9 pictures, 280 px', l: 'wide features, 400 px' } },
            states: STATES.read,
            a11y: { name: 'its title', keys: 'Tab moves card to card; the arrows are buttons', minTarget: 'See all 44 px' },
            layout: { phone: 'about 1.2 cards showing, swiped', tablet: 'as many as fit', computer: 'arrows, or a grid with wrap' },
            native: {
                compose: `@Composable
fun OvRail(title: String, seeAll: (() -> Unit)? = null, content: LazyListScope.() -> Unit) {
    Column(Modifier.semantics { heading() }) {
        Row(Modifier.fillMaxWidth().padding(horizontal = OvScale.SpaceLg), verticalAlignment = Alignment.CenterVertically) {
            Text(title, Modifier.weight(1f), fontWeight = FontWeight.ExtraBold, fontSize = OvScale.TypeSizeLead)
            if (seeAll != null) TextButton(seeAll, Modifier.heightIn(min = OvScale.SizeTap)) { Text("See all") }
        }
        val state = rememberLazyListState()
        LazyRow(state = state, flingBehavior = rememberSnapFlingBehavior(state), contentPadding = PaddingValues(horizontal = OvScale.SpaceLg),
            horizontalArrangement = Arrangement.spacedBy(OvScale.SpaceMd), content = content)
    }
}`,
                swiftui: `struct OvRail<Content: View>: View {
    let title: String
    var seeAll: (() -> Void)? = nil
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: OvScale.spaceMd) {
            HStack {
                Text(title).font(.system(size: OvScale.typeSizeLead, weight: .heavy)).accessibilityAddTraits(.isHeader)
                Spacer()
                if let seeAll { Button("See all", action: seeAll).frame(minHeight: OvScale.sizeTap) }
            }.padding(.horizontal, OvScale.spaceLg)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: OvScale.spaceMd) { content() }.scrollTargetLayout().padding(.horizontal, OvScale.spaceLg)
            }.scrollTargetBehavior(.viewAligned)
        }
    }
}`,
            },
        },
        {
            id: 'row', name: 'Row', web: 'kit.row',
            summary: 'One item in a list: its mark, the title with a badge and the time on one line, one muted line under it, a trailing control.',
            role: 'listitem (a link when it has href)',
            anatomy: [
                { part: 'mark', optional: true, tokens: { size: 'size.avatar' }, note: 'a picture, or up to two letters on a colour from the name' },
                { part: 'title', tokens: { color: 'color.text.primary', weight: 'type.weight.bold' } },
                { part: 'meta', optional: true, tokens: { color: 'color.text.muted', size: 'type.size.meta' }, note: 'the time, on the title\'s line' },
                { part: 'sub', optional: true, tokens: { color: 'color.text.muted', size: 'type.size.meta' }, note: 'one line, cut with …' },
                { part: 'trail', optional: true, note: 'a count, a switch or a button' },
            ],
            props: { href: { type: 'url' }, rel: { type: 'string' }, title: { type: 'string', required: true }, meta: { type: 'string' }, sub: { type: 'string' }, mark: { type: 'string' }, unread: { type: 'number' } },
            variants: { unread: { '0': 'plain', 'n': 'bold title and a dot with the count' } },
            states: STATES.press,
            a11y: { name: 'its title and sub-line', keys: 'Enter opens it', minTarget: 'the row, at least 56 px tall' },
            layout: { phone: 'full width, divided by lines', computer: 'the same, in a panel' },
            native: {
                compose: `@Composable
fun OvRow(title: String, onOpen: (() -> Unit)? = null, sub: String? = null, meta: String? = null, mark: (@Composable () -> Unit)? = null, trail: (@Composable () -> Unit)? = null) {
    ListItem(
        headlineContent = { Text(title, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = sub?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = OvScale.TypeSizeMeta) } },
        leadingContent = mark, trailingContent = trail ?: meta?.let { { Text(it, fontSize = OvScale.TypeSizeMeta) } },
        modifier = (if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier).heightIn(min = 56.dp),
    )
}`,
                swiftui: `struct OvRow: View {
    let title: String
    var sub: String? = nil
    var meta: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).fontWeight(.bold).lineLimit(1)
                if let sub { Text(sub).font(.system(size: OvScale.typeSizeMeta)).foregroundStyle(OvTokens.colorTextMuted).lineLimit(1) }
            }
            Spacer()
            if let meta { Text(meta).font(.system(size: OvScale.typeSizeMeta)).foregroundStyle(OvTokens.colorTextMuted) }
        }
        .frame(minHeight: 56)
        .accessibilityElement(children: .combine)
    }
}`,
            },
        },
        {
            id: 'list', name: 'List', web: 'kit.list',
            summary: 'Rows in one rounded panel, with a small heading and one link to the whole list; an empty list says so in a line.',
            role: 'list',
            children: ['row'],
            anatomy: [
                { part: 'head', optional: true, tokens: { color: 'color.text.muted', size: 'type.size.caption', weight: 'type.weight.heavy' }, note: 'uppercase, with its link' },
                { part: 'panel', tokens: { background: 'color.bg.raised', line: 'color.line.base', radius: 'radius.md' } },
            ],
            props: { title: { type: 'string' }, more: { type: 'link' }, empty: { type: 'string' }, flush: { type: 'boolean' } },
            states: STATES.read,
            a11y: { name: 'its heading', keys: 'Tab row to row', minTarget: 'rows 56 px' },
            layout: { phone: 'full width', computer: 'in its column' },
            native: {
                compose: `@Composable
fun OvList(title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Column {
        if (title != null) Text(title.uppercase(), Modifier.padding(OvScale.SpaceMd).semantics { heading() }, fontSize = OvScale.TypeSizeCaption, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Surface(shape = RoundedCornerShape(OvScale.RadiusMd), tonalElevation = 1.dp) { Column(content = content) }
    }
}`,
                swiftui: `struct OvList<Content: View>: View {
    var title: String? = nil
    @ViewBuilder let content: () -> Content
    var body: some View {
        Section { content() } header: { if let title { Text(title).font(.system(size: OvScale.typeSizeCaption, weight: .heavy)) } }
    }
}`,
            },
        },
        {
            id: 'section', name: 'Section', web: 'kit.section',
            summary: 'A card with a small heading for one part of a page or a group of settings; a note is one muted line under the title.',
            role: 'region named by its heading',
            children: '*',
            anatomy: [
                { part: 'panel', tokens: { background: 'color.bg.raised', line: 'color.line.base', radius: 'radius.md' } },
                { part: 'title', tokens: { color: 'color.text.muted', size: 'type.size.caption', weight: 'type.weight.heavy' } },
                { part: 'note', optional: true, tokens: { color: 'color.text.muted', size: 'type.size.meta' } },
            ],
            props: { id: { type: 'string' }, title: { type: 'string' }, count: { type: 'number' }, note: { type: 'string' } },
            states: ['default'],
            a11y: { name: 'its title', keys: 'none of its own', minTarget: '' },
            layout: { phone: 'full width', computer: 'in its column' },
            native: {
                compose: `@Composable
fun OvSection(title: String, note: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Surface(shape = RoundedCornerShape(OvScale.RadiusMd), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(vertical = OvScale.SpaceMd)) {
            Text(title.uppercase(), Modifier.padding(horizontal = OvScale.SpaceMd).semantics { heading() }, fontSize = OvScale.TypeSizeCaption, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (note != null) Text(note, Modifier.padding(horizontal = OvScale.SpaceMd), fontSize = OvScale.TypeSizeMeta, color = MaterialTheme.colorScheme.onSurfaceVariant)
            content()
        }
    }
}`,
                swiftui: `struct OvSection<Content: View>: View {
    let title: String
    var note: String? = nil
    @ViewBuilder let content: () -> Content
    var body: some View {
        GroupBox {
            VStack(alignment: .leading) { content() }
        } label: {
            VStack(alignment: .leading) { Text(title.uppercased()).font(.system(size: OvScale.typeSizeCaption, weight: .heavy)); if let note { Text(note).font(.system(size: OvScale.typeSizeMeta)) } }
        }
    }
}`,
            },
        },
        {
            id: 'fold', name: 'Fold', web: 'kit.fold',
            summary: 'A card that opens and closes, for what is read once: setup, extras, details, the danger zone. Closed unless told.',
            role: 'disclosure (details/summary)',
            children: '*',
            anatomy: [
                { part: 'summary', tokens: { minHeight: 'size.tap', weight: 'type.weight.bold' }, note: 'the title, a muted word after it, a chevron that turns' },
                { part: 'body', tokens: { padding: 'space.md' } },
            ],
            props: { id: { type: 'string' }, title: { type: 'string', required: true }, meta: { type: 'string' }, open: { type: 'boolean' }, tone: { type: ['', 'danger'] } },
            states: ['closed', 'open', 'focused'],
            a11y: { name: 'its title', keys: 'Enter or Space opens and closes', minTarget: '44 px' },
            layout: { phone: 'full width', computer: 'in its column' },
            native: {
                compose: `@Composable
fun OvFold(title: String, meta: String? = null, initiallyOpen: Boolean = false, content: @Composable () -> Unit) {
    var open by rememberSaveable { mutableStateOf(initiallyOpen) }
    Surface(shape = RoundedCornerShape(OvScale.RadiusMd)) {
        Column {
            Row(Modifier.fillMaxWidth().heightIn(min = OvScale.SizeTap).clickable(onClickLabel = if (open) "Close" else "Open") { open = !open }.padding(horizontal = OvScale.SpaceMd),
                verticalAlignment = Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), fontWeight = FontWeight.Bold)
                if (meta != null) Text(meta, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Icon(Icons.Default.ExpandMore, null, Modifier.rotate(if (open) 180f else 0f))
            }
            AnimatedVisibility(open) { Box(Modifier.padding(OvScale.SpaceMd)) { content() } }
        }
    }
}`,
                swiftui: `struct OvFold<Content: View>: View {
    let title: String
    var meta: String? = nil
    @State var open = false
    @ViewBuilder let content: () -> Content
    var body: some View {
        DisclosureGroup(isExpanded: $open) { content().padding(.top, OvScale.spaceSm) } label: {
            HStack { Text(title).fontWeight(.bold); if let meta { Text(meta).foregroundStyle(OvTokens.colorTextMuted) } }.frame(minHeight: OvScale.sizeTap)
        }
    }
}`,
            },
        },
        {
            id: 'tabs', name: 'Tabs', web: 'kit.tabs',
            summary: 'A long page as a few short ones: each tab is a link (?tab=key), the server builds only the open one, so nothing needs JavaScript.',
            role: 'navigation; the open tab is aria-current',
            anatomy: [
                { part: 'pill', tokens: { minHeight: 'size.tap', radius: 'radius.pill', color: 'color.text.muted' }, note: 'the open one on color.bg.hover with a line, color.text.primary' },
                { part: 'count', optional: true, tokens: { size: 'type.size.caption', weight: 'type.weight.heavy' } },
            ],
            props: { base: { type: 'url' }, items: { type: 'tabs', required: true }, active: { type: 'string' }, param: { type: 'string' }, label: { type: 'string' } },
            states: ['default', 'current', 'focused'],
            a11y: { name: 'its label (Sections)', keys: 'Tab between links; Enter opens', minTarget: '44 px on touch' },
            layout: { phone: 'one strip that scrolls sideways', computer: 'in a row' },
            native: {
                compose: `@Composable
fun OvTabs(tabs: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    ScrollableTabRow(selectedTabIndex = selected, edgePadding = OvScale.SpaceLg) {
        tabs.forEachIndexed { i, t -> Tab(selected = i == selected, onClick = { onSelect(i) }, modifier = Modifier.heightIn(min = OvScale.SizeTap), text = { Text(t) }) }
    }
}`,
                swiftui: `struct OvTabs: View {
    let tabs: [String]
    @Binding var selected: Int
    var body: some View {
        Picker("Sections", selection: $selected) { ForEach(tabs.indices, id: \\.self) { Text(tabs[$0]).tag($0) } }
            .pickerStyle(.segmented)
    }
}`,
            },
        },
        {
            id: 'stats', name: 'Numbers', web: 'kit.stats',
            summary: 'A strip of real numbers; zero and unknown values are left out. A number with a link makes its whole tile the link.',
            role: 'description list (label: value)',
            anatomy: [
                { part: 'tile', tokens: { background: 'color.bg.raised', line: 'color.line.base', radius: 'radius.md' } },
                { part: 'value', tokens: { color: 'color.text.primary', size: 'type.size.title', weight: 'type.weight.heavy' }, note: 'tabular figures' },
                { part: 'label', tokens: { color: 'color.text.muted', size: 'type.size.caption' } },
            ],
            props: { items: { type: 'stats', required: true }, label: { type: 'string' } },
            states: ['default'],
            a11y: { name: 'each label with its value', keys: 'a linked tile is one Tab stop', minTarget: 'the tile' },
            layout: { phone: 'one strip that scrolls sideways', tablet: 'a grid of 130 px tiles', computer: 'the same' },
            native: {
                compose: `@Composable
fun OvStats(items: List<Pair<String, String>>) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(OvScale.SpaceSm), contentPadding = PaddingValues(horizontal = OvScale.SpaceLg)) {
        items(items) { (value, label) ->
            Surface(shape = RoundedCornerShape(OvScale.RadiusMd), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.widthIn(min = 104.dp).padding(horizontal = 14.dp, vertical = 8.dp).semantics(mergeDescendants = true) {}) {
                    Text(value, fontWeight = FontWeight.ExtraBold, fontSize = OvScale.TypeSizeTitle, style = LocalTextStyle.current.copy(fontFeatureSettings = "tnum"))
                    Text(label, fontSize = OvScale.TypeSizeCaption, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}`,
                swiftui: `struct OvStats: View {
    let items: [(value: String, label: String)]
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: OvScale.spaceSm) {
                ForEach(items, id: \\.label) { item in
                    VStack(alignment: .leading) {
                        Text(item.value).font(.system(size: OvScale.typeSizeTitle, weight: .heavy)).monospacedDigit()
                        Text(item.label).font(.system(size: OvScale.typeSizeCaption)).foregroundStyle(OvTokens.colorTextMuted)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 8).frame(minWidth: 104, alignment: .leading)
                    .background(OvTokens.colorBgRaised, in: .rect(cornerRadius: OvScale.radiusMd))
                    .accessibilityElement(children: .combine)
                }
            }.padding(.horizontal, OvScale.spaceLg)
        }
    }
}`,
            },
        },
        {
            id: 'notice', name: 'Notice', web: 'kit.notice',
            summary: 'A line in the page that tells the person what happened: ok, info, warn, or an error (announced at once).',
            role: 'status, or alert for errors',
            anatomy: [
                { part: 'icon', tokens: { size: 'size.icon' } },
                { part: 'text', tokens: { color: 'color.text.primary' } },
            ],
            props: { kind: { type: ['ok', 'info', 'warn', 'error'], default: 'info' }, text: { type: 'string', required: true } },
            variants: { kind: { ok: 'color.status.ok.text', info: 'color.status.info.text', warn: 'color.status.warn.text', error: 'color.status.bad.text, role alert' } },
            states: ['default'],
            a11y: { name: 'its text', keys: 'none; errors are announced', minTarget: '' },
            layout: { phone: 'full width', computer: 'in its column' },
            native: {
                compose: `@Composable
fun OvNotice(text: String, kind: OvNoticeKind = OvNoticeKind.Info) {
    val c = MaterialTheme.colorScheme
    val tint = when (kind) { OvNoticeKind.Error -> c.error; OvNoticeKind.Ok -> c.primary; else -> c.tertiary }
    Row(Modifier.fillMaxWidth().semantics { liveRegion = if (kind == OvNoticeKind.Error) LiveRegionMode.Assertive else LiveRegionMode.Polite }
        .background(tint.copy(alpha = .12f), RoundedCornerShape(OvScale.RadiusSm)).padding(OvScale.SpaceMd), horizontalArrangement = Arrangement.spacedBy(OvScale.SpaceSm)) {
        Icon(if (kind == OvNoticeKind.Error) Icons.Default.Error else Icons.Default.Info, null, tint = tint)
        Text(text, color = c.onSurface)
    }
}`,
                swiftui: `struct OvNotice: View {
    let text: String
    var isError = false
    var body: some View {
        Label(text, systemImage: isError ? "exclamationmark.triangle" : "info.circle")
            .padding(OvScale.spaceMd).frame(maxWidth: .infinity, alignment: .leading)
            .background((isError ? OvTokens.colorStatusBadText : OvTokens.colorStatusInfoText).opacity(0.12), in: .rect(cornerRadius: OvScale.radiusSm))
            .accessibilityAddTraits(isError ? [.updatesFrequently] : [])
    }
}`,
            },
        },
        {
            id: 'empty', name: 'Empty state', web: 'kit.empty',
            summary: 'What an empty list says: a title, one line, and the one thing to do next.',
            role: 'status',
            anatomy: [
                { part: 'icon', optional: true, tokens: { color: 'color.accent.base' } },
                { part: 'title', tokens: { weight: 'type.weight.bold' } },
                { part: 'text', optional: true, tokens: { color: 'color.text.muted' } },
                { part: 'action', optional: true, note: 'a primary button' },
            ],
            props: { title: { type: 'string', required: true }, text: { type: 'string' }, icon: { type: 'icon' }, action: { type: 'link' } },
            states: ['default'],
            a11y: { name: 'its title and line', keys: 'the action is one Tab stop', minTarget: '44 px' },
            layout: { phone: 'centred in the space', computer: 'the same' },
            native: {
                compose: `@Composable
fun OvEmpty(title: String, text: String? = null, action: Pair<String, () -> Unit>? = null) {
    Column(Modifier.fillMaxWidth().padding(OvScale.SpaceXl), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(OvScale.SpaceSm)) {
        Text(title, fontWeight = FontWeight.Bold)
        if (text != null) Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        if (action != null) OvButton(action.first, action.second)
    }
}`,
                swiftui: `struct OvEmpty: View {
    let title: String
    var text: String? = nil
    var body: some View {
        ContentUnavailableView { Text(title).fontWeight(.bold) } description: { if let text { Text(text) } }
    }
}`,
            },
        },
    ];

    // What the reference views share, once per app: the kinds, and (iOS) which theme's tokens the app wears. The theme
    // files come from openvibe-shared/tokens (OpenVibe.Design /tokens): Compose reads MaterialTheme's colour scheme
    // (VibeDarkColorScheme…) and OvScale; SwiftUI reads OvTokens (an alias of the theme's enum) and OvScale.
    const PREAMBLE = Object.freeze({
        compose: `// OpenVibe kit for Jetpack Compose: add the theme file from openvibe.design/tokens (Android) and wrap the app in
// MaterialTheme(colorScheme = if (isSystemInDarkTheme()) VibeDarkColorScheme else VibeLightColorScheme) { … }
enum class OvKind { Primary, Quiet, Danger }
enum class OvNoticeKind { Ok, Info, Warn, Error }`,
        swiftui: `// OpenVibe kit for SwiftUI: add the theme file from openvibe.design/tokens (iOS) and say which half the app wears.
typealias OvTokens = VibeDarkTokens   // or VibeLightTokens, from @Environment(\\.colorScheme)
enum OvKind { case primary, quiet, danger }`,
    });

    const byId = new Map(SPECS.map((c) => [c.id, c]));
    const get = (id) => byId.get(String(id)) || null;

    // ── Validation ──
    const isStr = (v) => typeof v === 'string' && v.length <= LIMITS.string;
    const isUrl = (v) => isStr(v) && /^(https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*|#[\w-]*)$/.test(v.trim());
    function checkType(type, v) {
        if (Array.isArray(type)) return type.includes(v);
        switch (type) {
            case 'string': case 'text': case 'icon': return isStr(v);
            case 'url': return isUrl(v);
            case 'boolean': return typeof v === 'boolean';
            case 'number': return typeof v === 'number' && Number.isFinite(v);
            case 'link': return !!v && typeof v === 'object' && isUrl(v.href) && (v.label == null || isStr(v.label));
            case 'count': return (typeof v === 'number' && Number.isFinite(v)) || (Array.isArray(v) && v.length <= 2 && Number.isFinite(Number(v[0])) && (v[1] == null || isStr(v[1])));
            case 'stats': return Array.isArray(v) && v.length <= LIMITS.items && v.every((x) => Array.isArray(x) && x.length >= 2 && x.length <= 3 && (isStr(x[0]) || Number.isFinite(x[0])) && isStr(x[1]) && (x[2] == null || isUrl(x[2])));
            case 'tabs': return Array.isArray(v) && v.length <= LIMITS.items && v.every((x) => x && typeof x === 'object' && isStr(x.key) && isStr(x.label) && (x.count == null || Number.isFinite(Number(x.count))) && (x.href == null || isUrl(x.href)));
            default: return false;
        }
    }
    /** A kit document against the contract → { ok, errors }. */
    function validate(doc) {
        const errors = [];
        let nodes = 0;
        (function walk(node, at, depth) {
            if (errors.length > 50) return;
            nodes++;
            if (nodes > LIMITS.nodes) { if (nodes === LIMITS.nodes + 1) errors.push(`more than ${LIMITS.nodes} nodes`); return; }
            if (depth > LIMITS.depth) { errors.push(`${at}: deeper than ${LIMITS.depth}`); return; }
            if (!node || typeof node !== 'object' || Array.isArray(node)) { errors.push(`${at}: not a component`); return; }
            const spec = get(node.type);
            if (!spec) { errors.push(`${at}: unknown type ${JSON.stringify(String(node.type)).slice(0, 40)}`); return; }
            const here = `${at === '$' ? '' : `${at}.`}${spec.id}`;
            const props = node.props == null ? {} : node.props;
            if (typeof props !== 'object' || Array.isArray(props)) { errors.push(`${here}.props: not an object`); return; }
            for (const k of Object.keys(props)) {
                const p = spec.props[k];
                if (!p) errors.push(`${here}.props.${k}: not a prop of ${spec.id}`);
                else if (props[k] != null && !checkType(p.type, props[k])) errors.push(`${here}.props.${k}: expected ${Array.isArray(p.type) ? p.type.map((x) => JSON.stringify(x)).join(' | ') : p.type}`);
            }
            for (const [k, p] of Object.entries(spec.props)) if (p.required && (props[k] == null || props[k] === '')) errors.push(`${here}.props.${k}: required`);
            const kids = node.children == null ? [] : node.children;
            if (!Array.isArray(kids)) { errors.push(`${here}.children: not a list`); return; }
            if (kids.length && !spec.children) errors.push(`${here}: takes no children`);
            if (kids.length > LIMITS.items) errors.push(`${here}.children: more than ${LIMITS.items}`);
            kids.slice(0, LIMITS.items).forEach((c, i) => {
                if (spec.children && spec.children !== '*' && c && !spec.children.includes(c.type)) errors.push(`${here}.children[${i}]: ${spec.id} takes ${spec.children.join(', ')}, not ${String(c.type).slice(0, 30)}`);
                walk(c, `${here}[${i}]`, depth + 1);
            });
        })(doc, '$', 1);
        return { ok: errors.length === 0, errors };
    }

    // ── Rendering for the web, through kit.js ──
    /**
     * A valid kit document as HTML (the kit's own builders: escaped, links checked). An invalid one throws. kit: kit.js —
     * in a page, window.OpenVibeKit (the default); on a server, require('openvibe-shared/kit').
     */
    function render(doc, kitLib = root && root.OpenVibeKit) {
        if (!kitLib || typeof kitLib.card !== 'function') throw new Error('components.render(doc, kit): pass kit.js (openvibe-shared/kit on a server, window.OpenVibeKit in a page)');
        const v = validate(doc);
        if (!v.ok) throw Object.assign(new Error(`invalid kit document: ${v.errors.slice(0, 3).join('; ')}`), { errors: v.errors });
        const kit = kitLib;
        const draw = (n) => {
            const p = n.props || {};
            const kids = (n.children || []).map(draw);
            switch (n.type) {
                case 'button': return kit.button({ href: p.href == null ? null : p.href, type: 'button', label: p.label, icon: p.icon || '', kind: p.kind || 'primary', small: !!p.small });
                case 'card': return kit.card({ ...p, when: p.when || null });
                case 'rail': return kit.rail({ ...p, items: kids });
                case 'row': return kit.row({ ...p, mark: p.mark ? kit.mark({ name: p.mark }) : '' });
                case 'list': return kit.list(kids, { title: p.title || '', more: p.more || null, flush: !!p.flush, empty: p.empty || '' });
                case 'section': return kit.section({ id: p.id || null, title: p.title || '', count: p.count == null ? null : p.count, note: p.note || '', body: kids.join('') });
                case 'fold': return kit.fold({ id: p.id || null, title: p.title, meta: p.meta || '', open: !!p.open, tone: p.tone || '', body: kids.join('') });
                case 'tabs': return kit.tabs({ base: p.base || '', items: p.items, active: p.active || '', param: p.param || 'tab', label: p.label || 'Sections' });
                case 'stats': return kit.stats(p.items, { label: p.label || 'In numbers' });
                case 'notice': return kit.notice({ kind: p.kind || 'info', text: p.text });
                case 'empty': return kit.empty({ title: p.title, text: p.text || '', icon: p.icon || '', action: p.action ? { href: p.action.href, label: p.action.label || 'Go' } : null });
                default: return '';
            }
        };
        return draw(doc);
    }

    /** Every token path a spec names (for tests and docs). */
    function tokensOf(spec) {
        const out = new Set();
        for (const part of spec.anatomy || []) for (const v of Object.values(part.tokens || {})) if (/^[a-z]+(\.[a-zA-Z]+)+$/.test(v)) out.add(v);
        return [...out];
    }

    return { VERSION, LIMITS, SPECS, PREAMBLE, get, validate, render, tokensOf };
});
