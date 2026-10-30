// The OpenVibe kit for SwiftUI: a kit document, rendered.
//
// A kit document is a JSON tree of { type, props, children } (openvibe-shared/components). The web draws it with
// kit.js; this file draws the same document with the kit's own SwiftUI views (OvKit.swift), wearing the theme's
// tokens (OvTokens, OvScale).
//
//   let doc = try JSONDecoder().decode(KitNode.self, from: data)
//   KitView(doc: doc) { action in open(action) }
//
// The document is decoded with Codable, so an app can fetch it, cache it and decode it off the main thread.
import SwiftUI
import Foundation

// ── The document's values ──

/// A JSON value, as a kit document carries them.
public enum KitValue: Codable {
    case string(String)
    case bool(Bool)
    case int(Int)
    case double(Double)
    case array([KitValue])
    case object([String: KitValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([KitValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: KitValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    /// The value as an object, when it is one.
    var objectValue: [String: KitValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// The value as an array, when it is one.
    var arrayValue: [KitValue]? {
        if case .array(let value) = self { return value }
        return nil
    }
}

/// Reading the props of a component.
extension Dictionary where Key == String, Value == KitValue {
    /// A string prop, or nothing when the document does not carry it.
    func string(_ key: String) -> String? {
        if case .string(let value)? = self[key] { return value }
        return nil
    }

    /// A boolean prop.
    func bool(_ key: String) -> Bool? {
        if case .bool(let value)? = self[key] { return value }
        return nil
    }

    /// A number prop.
    func int(_ key: String) -> Int? {
        switch self[key] {
        case .int(let value)?: return value
        case .double(let value)?: return Int(value)
        default: return nil
        }
    }

    /// An array prop.
    func array(_ key: String) -> [KitValue]? {
        if case .array(let value)? = self[key] { return value }
        return nil
    }

    /// An object prop.
    func object(_ key: String) -> [String: KitValue]? {
        if case .object(let value)? = self[key] { return value }
        return nil
    }
}

// ── The components ──

/// What a component carries: its props and its children.
public protocol KitComponent {
    var props: [String: KitValue] { get }
    var children: [KitNode] { get }
}

/// A link the kit draws: where it goes and what it says.
public struct KitLink {
    public let href: String
    public let label: String

    public init(href: String, label: String) {
        self.href = href
        self.label = label
    }
}

/// One tab: its key (what the web puts in the URL), its label and its count.
public struct KitTab {
    public let key: String
    public let label: String
    public let count: Int?

    public init(key: String, label: String, count: Int? = nil) {
        self.key = key
        self.label = label
        self.count = count
    }
}

/// One number with its label.
public struct KitStat {
    public let value: String
    public let label: String
    public let href: String?

    public init(value: String, label: String, href: String? = nil) {
        self.value = value
        self.label = label
        self.href = href
    }
}

/// A button: one action, a link or a run.
public struct KitButton: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var label: String { props.string("label") ?? "" }
    public var href: String? { props.string("href") }
    public var iconName: String? { props.string("icon") }

    /// The button's kind (OvKind comes from the kit's preamble).
    var kind: OvKind {
        switch props.string("kind") {
        case "quiet": return .quiet
        case "danger": return .danger
        default: return .primary
        }
    }
}

/// A card: one thing, the whole card is one link.
public struct KitCard: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var href: String { props.string("href") ?? "" }
    public var title: String { props.string("title") ?? "" }
    public var sub: String? { props.string("sub") }
    public var who: String? { props.string("who") }
    public var shownAt: String? { props.string("when") }
    public var imageURL: URL? {
        guard let raw = props.string("image") else { return nil }
        return URL(string: raw)
    }

    /// The badge: the one the document gives, or LIVE.
    public var badgeText: String? {
        if let badge = props.string("badge") { return badge }
        if props.bool("live") == true { return "LIVE" }
        return nil
    }

    /// The media's shape, as the view takes it.
    public var ratioValue: CGFloat {
        guard let raw = props.string("ratio") else { return 16.0 / 9.0 }
        let parts = raw.split(separator: ":")
        if parts.count == 2, let a = Double(parts[0]), let b = Double(parts[1]), b != 0 {
            return CGFloat(a / b)
        }
        return 16.0 / 9.0
    }

    /// The count: a number, or [number, word].
    public var countText: String? {
        switch props["count"] {
        case .int(let value)?: return String(value)
        case .double(let value)?: return String(Int(value))
        case .array(let value)?:
            guard let first = value.first else { return nil }
            var number = ""
            switch first {
            case .int(let n): number = String(n)
            case .double(let n): number = String(Int(n))
            default: return nil
            }
            if value.count > 1, case .string(let word)? = value[1] { return number + " " + word }
            return number
        default: return nil
        }
    }

    /// The line under the title: who, the count, when.
    public var metaText: String? {
        let parts = [who, countText, shownAt].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

/// A rail: a row of cards that scrolls sideways.
public struct KitRail: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String { props.string("title") ?? "" }

    /// The link to the whole list, if the document gives one.
    public var more: KitLink? {
        guard let link = props.object("more"), let href = link.string("href") else { return nil }
        return KitLink(href: href, label: link.string("label") ?? href)
    }

    /// The cards the rail holds.
    public var cards: [KitCard] { children.compactMap { $0 as? KitCard } }
}

/// A row: one item in a list.
public struct KitRow: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String { props.string("title") ?? "" }
    public var href: String? { props.string("href") }
    public var sub: String? { props.string("sub") }
    public var meta: String? { props.string("meta") }
    public var unread: Int? { props.int("unread") }
}

/// A list: rows in one rounded panel.
public struct KitList: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String? { props.string("title") }
    public var empty: String? { props.string("empty") }

    /// The rows the list holds.
    public var rows: [KitRow] { children.compactMap { $0 as? KitRow } }
}

/// A section: a titled group of anything.
public struct KitSection: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String { props.string("title") ?? "" }
    public var note: String? { props.string("note") }
}

/// A fold: a group that opens and closes.
public struct KitFold: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String { props.string("title") ?? "" }
    public var meta: String? { props.string("meta") }
}

/// Tabs: the sections of a screen, one at a time.
public struct KitTabs: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    /// The tabs, as the document gives them.
    public var tabs: [KitTab] {
        guard let items = props.array("items") else { return [] }
        var out: [KitTab] = []
        for item in items {
            guard let tab = item.objectValue, let key = tab.string("key") else { continue }
            out.append(KitTab(key: key, label: tab.string("label") ?? key, count: tab.int("count")))
        }
        return out
    }

    /// The tab that is open: the one the document names, or the first.
    public var selectedIndex: Int {
        let active = props.string("active")
        if let active = active, let index = tabs.firstIndex(where: { $0.key == active }) { return index }
        return 0
    }
}

/// Stats: the numbers, in a row.
public struct KitStats: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    /// The numbers, as the view takes them.
    public var items: [(value: String, label: String)] {
        guard let rows = props.array("items") else { return [] }
        var out: [(value: String, label: String)] = []
        for row in rows {
            guard let pair = row.arrayValue, pair.count >= 2 else { continue }
            var value = ""
            switch pair[0] {
            case .string(let text): value = text
            case .int(let number): value = String(number)
            case .double(let number): value = String(Int(number))
            default: continue
            }
            guard case .string(let label)? = pair[1] else { continue }
            out.append((value: value, label: label))
        }
        return out
    }
}

/// A notice: one line that says how things stand.
public struct KitNotice: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var text: String { props.string("text") ?? "" }

    /// A warning or an error says itself louder.
    public var isError: Bool {
        let kind = props.string("kind")
        return kind == "error" || kind == "warn"
    }
}

/// An empty state: what a screen shows when it has nothing to show.
public struct KitEmpty: KitComponent {
    public let props: [String: KitValue]
    public let children: [KitNode]

    public init(props: [String: KitValue] = [:], children: [KitNode] = []) {
        self.props = props
        self.children = children
    }

    public var title: String { props.string("title") ?? "" }
    public var text: String? { props.string("text") }
}

// ── The document ──

/// A node of a kit document: one component, with its props and its children.
///
/// The cases are the kit's components; every one of them has a view in OvKit.swift that KitView draws with. A new
/// component in components.js needs a case here (and a view), or the kit check fails.
public enum KitNode: Codable {
    case button(KitButton)
    case card(KitCard)
    case rail(KitRail)
    case row(KitRow)
    case list(KitList)
    case section(KitSection)
    case fold(KitFold)
    case tabs(KitTabs)
    case stats(KitStats)
    case notice(KitNotice)
    case empty(KitEmpty)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: KitCodingKey.self)
        let type = try container.decode(String.self, forKey: KitCodingKey("type"))
        let props = try container.decodeIfPresent([String: KitValue].self, forKey: KitCodingKey("props")) ?? [:]
        let children = try container.decodeIfPresent([KitNode].self, forKey: KitCodingKey("children")) ?? []
        switch type {
        case "button": self = .button(KitButton(props: props, children: children))
        case "card": self = .card(KitCard(props: props, children: children))
        case "rail": self = .rail(KitRail(props: props, children: children))
        case "row": self = .row(KitRow(props: props, children: children))
        case "list": self = .list(KitList(props: props, children: children))
        case "section": self = .section(KitSection(props: props, children: children))
        case "fold": self = .fold(KitFold(props: props, children: children))
        case "tabs": self = .tabs(KitTabs(props: props, children: children))
        case "stats": self = .stats(KitStats(props: props, children: children))
        case "notice": self = .notice(KitNotice(props: props, children: children))
        case "empty": self = .empty(KitEmpty(props: props, children: children))
        default:
            throw DecodingError.dataCorruptedError(
                forKey: KitCodingKey("type"),
                in: container,
                debugDescription: "unknown kit component: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: KitCodingKey.self)
        try container.encode(typeName, forKey: KitCodingKey("type"))
        try container.encode(props, forKey: KitCodingKey("props"))
        if !children.isEmpty {
            try container.encode(children, forKey: KitCodingKey("children"))
        }
    }

    /// The component's type, as it is written in the document.
    public var typeName: String {
        switch self {
        case .button: return "button"
        case .card: return "card"
        case .rail: return "rail"
        case .row: return "row"
        case .list: return "list"
        case .section: return "section"
        case .fold: return "fold"
        case .tabs: return "tabs"
        case .stats: return "stats"
        case .notice: return "notice"
        case .empty: return "empty"
        }
    }

    /// The component's props.
    public var props: [String: KitValue] {
        switch self {
        case .button(let node): return node.props
        case .card(let node): return node.props
        case .rail(let node): return node.props
        case .row(let node): return node.props
        case .list(let node): return node.props
        case .section(let node): return node.props
        case .fold(let node): return node.props
        case .tabs(let node): return node.props
        case .stats(let node): return node.props
        case .notice(let node): return node.props
        case .empty(let node): return node.props
        }
    }

    /// The component's children.
    public var children: [KitNode] {
        switch self {
        case .button(let node): return node.children
        case .card(let node): return node.children
        case .rail(let node): return node.children
        case .row(let node): return node.children
        case .list(let node): return node.children
        case .section(let node): return node.children
        case .fold(let node): return node.children
        case .tabs(let node): return node.children
        case .stats(let node): return node.children
        case .notice(let node): return node.children
        case .empty(let node): return node.children
        }
    }
}

/// The key of a kit document: any name a node carries.
struct KitCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }

    init(_ name: String) { self.stringValue = name }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

/// What a tap asks the app to do: open a link, or run the action a button names.
public enum KitAction {
    /// Follow a link (a card, a row, a button with an href).
    case open(String)

    /// Run the action a button names (the app decides what that means).
    case run(String)
}

// ── Drawing it ──

/// A kit document, drawn.
///
/// The app wears the theme's tokens around it (OvTokens, OvScale; see the kit's preamble), and this draws every
/// component with the kit's own views. A tap comes back as a KitAction, so the app decides what a link or a button
/// does.
public struct KitView: View {
    public let doc: KitNode
    public var onAction: (KitAction) -> Void

    public init(doc: KitNode, onAction: @escaping (KitAction) -> Void = { _ in }) {
        self.doc = doc
        self.onAction = onAction
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: OvScale.spaceMd) {
            self.nodeView(self.doc)
        }
    }

    /// One node, drawn with the kit's view for its component.
    @ViewBuilder
    private func nodeView(_ node: KitNode) -> some View {
        switch node {
        case .button(let n): self.buttonView(n)
        case .card(let n): self.cardView(n)
        case .rail(let n): self.railView(n)
        case .row(let n): self.rowView(n)
        case .list(let n): self.listView(n)
        case .section(let n): self.sectionView(n)
        case .fold(let n): self.foldView(n)
        case .tabs(let n): self.tabsView(n)
        case .stats(let n): self.statsView(n)
        case .notice(let n): self.noticeView(n)
        case .empty(let n): self.emptyView(n)
        }
    }

    /// A button.
    @ViewBuilder
    private func buttonView(_ node: KitButton) -> some View {
        OvButton(label: node.label, kind: node.kind, icon: node.iconName) {
            if let href = node.href {
                self.act(.open(href))
            } else {
                self.act(.run(node.label))
            }
        }
    }

    /// A card: the whole card is one link.
    @ViewBuilder
    private func cardView(_ node: KitCard) -> some View {
        Button { self.act(.open(node.href)) } label: {
            OvCard(
                title: node.title,
                image: node.imageURL,
                ratio: node.ratioValue,
                badge: node.badgeText,
                sub: node.sub,
                meta: node.metaText
            )
        }
        .buttonStyle(.plain)
    }

    /// A rail of cards.
    @ViewBuilder
    private func railView(_ node: KitRail) -> some View {
        OvRail(title: node.title, seeAll: node.more.map { self.moreAction($0) }) {
            self.railCards(node)
        }
    }

    /// The cards of a rail.
    private func railCards(_ node: KitRail) -> some View {
        ForEach(node.cards.indices, id: \.self) { index in
            self.nodeView(node.cards[index])
        }
    }

    /// A row.
    @ViewBuilder
    private func rowView(_ node: KitRow) -> some View {
        Button {
            if let href = node.href { self.act(.open(href)) }
        } label: {
            OvRow(title: node.title, sub: node.sub, meta: node.meta)
        }
        .buttonStyle(.plain)
    }

    /// A list of rows.
    @ViewBuilder
    private func listView(_ node: KitList) -> some View {
        OvList(title: node.title) {
            self.listRows(node)
        }
    }

    /// The rows of a list, or the empty state when there are none.
    private func listRows(_ node: KitList) -> some View {
        Group {
            if node.rows.isEmpty {
                if let empty = node.empty {
                    OvEmpty(title: empty)
                } else {
                    EmptyView()
                }
            } else {
                ForEach(node.rows.indices, id: \.self) { index in
                    self.nodeView(node.rows[index])
                }
            }
        }
    }

    /// A section.
    @ViewBuilder
    private func sectionView(_ node: KitSection) -> some View {
        OvSection(title: node.title, note: node.note) {
            self.sectionChildren(node)
        }
    }

    /// The children of a section.
    private func sectionChildren(_ node: KitSection) -> some View {
        ForEach(node.children.indices, id: \.self) { index in
            self.nodeView(node.children[index])
        }
    }

    /// A fold.
    @ViewBuilder
    private func foldView(_ node: KitFold) -> some View {
        OvFold(title: node.title, meta: node.meta) {
            self.foldChildren(node)
        }
    }

    /// The children of a fold.
    private func foldChildren(_ node: KitFold) -> some View {
        ForEach(node.children.indices, id: \.self) { index in
            self.nodeView(node.children[index])
        }
    }

    /// The tabs of a screen.
    @ViewBuilder
    private func tabsView(_ node: KitTabs) -> some View {
        KitTabsHost(tabs: node.tabs.map { $0.label }, selected: node.selectedIndex)
    }

    /// The numbers.
    @ViewBuilder
    private func statsView(_ node: KitStats) -> some View {
        OvStats(items: node.items)
    }

    /// A notice.
    @ViewBuilder
    private func noticeView(_ node: KitNotice) -> some View {
        OvNotice(text: node.text, isError: node.isError)
    }

    /// An empty state.
    @ViewBuilder
    private func emptyView(_ node: KitEmpty) -> some View {
        OvEmpty(title: node.title, text: node.text)
    }

    /// What the rail's "See all" does.
    private func moreAction(_ link: KitLink) -> () -> Void {
        { self.act(.open(link.href)) }
    }

    /// A tap, on its way to the app.
    private func act(_ action: KitAction) {
        self.onAction(action)
    }
}

/// The tabs of a document: the open one is the app's business, so it lives here.
struct KitTabsHost: View {
    let tabs: [String]
    let selected: Int
    @State private var current: Int

    init(tabs: [String], selected: Int) {
        self.tabs = tabs
        self.selected = selected
        _current = State(initialValue: selected)
    }

    var body: some View {
        OvTabs(tabs: tabs, selected: $current)
    }
}
