"use client"
// Import React dependencies.
import { useCallback, useState, useMemo, useSyncExternalStore, useEffect } from 'react';

// Import the Slate components and React plugin.
import { BaseEditor, NodeEntry, createEditor, Descendant, Editor, Range, Node, Transforms, Text, Element } from 'slate';
import { Slate, ReactEditor, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import Toolbar from "./toolbar";
import { SubcribeToStore } from "../useSyncstore";
import { slateToHtml } from '@slate-serializers/html';

const API_URL_5000 = process.env.NEXT_PUBLIC_API_URL_5000 || 'http://127.0.0.1:5000';

// Consolidate consecutive character-by-character insert_text / remove_text ops into whole words/phrases
function groupTextOperations(operationBatches) {
    const flatOps = [];
    operationBatches.forEach((batch) => {
        batch.forEach((op) => {
            if (op.type !== "set_selection" && op.type !== "set_node") {
                flatOps.push({ ...op });
            }
        });
    });

    const grouped = [];
    const samePath = (a, b) =>
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, idx) => val === b[idx]);

    for (const op of flatOps) {
        const last = grouped[grouped.length - 1];

        // Merge consecutive typing at adjacent offsets on the same text node
        if (
            last &&
            last.type === "insert_text" &&
            op.type === "insert_text" &&
            samePath(last.path, op.path) &&
            op.offset === last.offset + last.text.length
        ) {
            last.text += op.text;
            continue;
        }

        // Merge consecutive deletions (forward Delete or Backspace) on the same text node
        if (
            last &&
            last.type === "remove_text" &&
            op.type === "remove_text" &&
            samePath(last.path, op.path)
        ) {
            if (op.offset === last.offset) {
                // Forward delete
                last.text += op.text;
                continue;
            }
            if (op.offset + op.text.length === last.offset) {
                // Backspace
                last.text = op.text + last.text;
                last.offset = op.offset;
                continue;
            }
        }

        grouped.push(op);
    }

    return grouped;
}

export default function Mycomponent({ sendtext, init, syncTrigger = 0 }) {
    const [sender, setSender] = useState(false);
    const [readonly, setReadonly] = useState(false);
    const [dataeditted, setDataEditted] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [myoperations, setOperations] = useState([]);
    // Non-destructive inline decorations per pending suggestion:
    // [{ id, username, color, ops: consolidatedOps }]
    const [pendingHighlights, setPendingHighlights] = useState([]);

    const toogleReadonly = () => {
        setReadonly(prev => !prev);
    };

    let editor = useMemo(() => withReact(withHistory(createEditor())), []);
    const [editorKey, setEditorKey] = useState(Date.now());
    const initial = [
        {
            type: 'paragraph',
            children: [{ text: "write here" }],
        },
    ];

    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getSnapshot, SubcribeToStore.getSnapshot);
    const subscribe_get = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getView, SubcribeToStore.getView);
    const sub_get_changes = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getData, SubcribeToStore.getData);

    const [initialValue, setInitialvalue] = useState(() => {
        if (subscribe_get && subscribe_get["msg"] && subscribe[0]?.[0]?.owner === false) {
            try {
                return JSON.parse(subscribe_get["msg"]);
            } catch (e) {
                return initial;
            }
        }
        return init == "" ? initial : JSON.parse(init);
    });

    // Helper to safely read the affected text at an operation's path in the owner's editor
    const getAffectedContext = useCallback((path) => {
        if (!path || !Array.isArray(path)) return "";
        try {
            if (Node.has(editor, path)) {
                const targetNode = Node.get(editor, path);
                return Node.string(targetNode);
            }
            const parentPath = path.slice(0, -1);
            if (parentPath.length > 0 && Node.has(editor, parentPath)) {
                return Node.string(Node.get(editor, parentPath));
            }
        } catch (err) {
            return "";
        }
        return "";
    }, [editor]);

    // Slate non-destructive decorator: computes visual ranges ONLY on affected lines/offsets
    // without mutating document nodes or breaking offsets for other collaborators
    const decorateRanges = useCallback(([node, path]) => {
        const ranges = [];
        if (!Text.isText(node) || pendingHighlights.length === 0) return ranges;

        const textLen = node.text.length;

        pendingHighlights.forEach((item) => {
            const badgeColor = item.color || "#2563eb";

            item.ops.forEach((op) => {
                if (!op.path || !Array.isArray(op.path)) return;

                const isExactTextPath =
                    op.path.length === path.length &&
                    op.path.every((v, i) => v === path[i]);

                const isBlockAncestor =
                    op.path.length < path.length &&
                    op.path.every((v, i) => v === path[i]);

                if (op.type === "remove_text" && isExactTextPath) {
                    const start = Math.min(Math.max(0, op.offset), textLen);
                    const end = Math.min(start + op.text.length, textLen);
                    if (start < end) {
                        ranges.push({
                            anchor: { path, offset: start },
                            focus: { path, offset: end },
                            suggestionHighlight: true,
                            suggestionType: "remove_text",
                            suggestionColor: badgeColor,
                            suggestionUser: item.username,
                        });
                    }
                } else if (op.type === "insert_text" && isExactTextPath) {
                    // Anchor a zero-width caret range at the exact insertion offset so an inline preview pill renders there
                    const pos = Math.min(Math.max(0, op.offset), textLen);
                    ranges.push({
                        anchor: { path, offset: pos },
                        focus: { path, offset: pos },
                        suggestionHighlight: true,
                        suggestionType: "insert_text",
                        suggestionText: op.text,
                        suggestionColor: badgeColor,
                        suggestionUser: item.username,
                    });
                } else if ((op.type === "insert_node" || op.type === "split_node" || op.type === "remove_node") && (isExactTextPath || isBlockAncestor)) {
                    // Mark only the end of the affected line with a subtle indicator badge
                    ranges.push({
                        anchor: { path, offset: textLen },
                        focus: { path, offset: textLen },
                        suggestionHighlight: true,
                        suggestionType: op.type,
                        suggestionText: op.node ? Node.string(op.node) : "",
                        suggestionColor: badgeColor,
                        suggestionUser: item.username,
                    });
                }
            });
        });

        return ranges;
    }, [pendingHighlights]);

    useEffect(() => {
        let datagotten = sub_get_changes == undefined ? [] : sub_get_changes;
        let data1 = datagotten != "" && datagotten["msg"] ? JSON.parse(datagotten["msg"]) : [];
        if (data1.length === 0) return;

        // Group consecutive character edits into consolidated words/phrases for display
        const consolidatedOps = groupTextOperations(data1);
        let changeItems = [];
        const userColor = datagotten["color"] || "#2563eb";

        consolidatedOps.forEach((opsdata, idx) => {
            const uniqueKey = `${datagotten["id"]}-${idx}`;
            const contextText = getAffectedContext(opsdata.path);

            if (opsdata.type === "insert_text") {
                changeItems.push(
                    <div key={uniqueKey} className="p-2.5 mb-2 rounded-lg bg-green-50 border border-green-200 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 block mb-1">
                            Inserted Text
                        </span>
                        <p className="font-medium text-green-900 break-words">
                            &ldquo;{opsdata.text}&rdquo;
                        </p>
                        {contextText && (
                            <p className="text-xs text-zinc-500 mt-1 truncate">
                                In: &ldquo;{contextText}&rdquo;
                            </p>
                        )}
                    </div>
                );
            } else if (opsdata.type === "remove_text") {
                changeItems.push(
                    <div key={uniqueKey} className="p-2.5 mb-2 rounded-lg bg-red-50 border border-red-200 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-red-700 block mb-1">
                            Deleted Text
                        </span>
                        <p className="font-medium text-red-900 line-through break-words">
                            &ldquo;{opsdata.text}&rdquo;
                        </p>
                        {contextText && (
                            <p className="text-xs text-zinc-500 mt-1 truncate">
                                From: &ldquo;{contextText}&rdquo;
                            </p>
                        )}
                    </div>
                );
            } else if (opsdata.type === "insert_node") {
                const nodeText = opsdata.node ? Node.string(opsdata.node) : "";
                changeItems.push(
                    <div key={uniqueKey} className="p-2.5 mb-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 block mb-1">
                            Inserted {opsdata.node?.type || "Block"}
                        </span>
                        <p className="font-medium text-blue-900 break-words">
                            {nodeText ? `"${nodeText}"` : "(Empty line)"}
                        </p>
                    </div>
                );
            } else if (opsdata.type === "remove_node") {
                const nodeText = opsdata.node ? Node.string(opsdata.node) : contextText;
                changeItems.push(
                    <div key={uniqueKey} className="p-2.5 mb-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 block mb-1">
                            Removed {opsdata.node?.type || "Block"}
                        </span>
                        <p className="font-medium text-amber-900 line-through break-words">
                            {nodeText ? `"${nodeText}"` : "(Empty line)"}
                        </p>
                    </div>
                );
            } else if (opsdata.type === "split_node" || opsdata.type === "merge_node") {
                const label = opsdata.type === "split_node" ? "Split Paragraph" : "Merged Paragraph";
                changeItems.push(
                    <div key={uniqueKey} className="p-2.5 mb-2 rounded-lg bg-zinc-100 border border-zinc-200 text-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-700 block mb-1">
                            {label}
                        </span>
                        {contextText && (
                            <p className="text-xs text-zinc-600 truncate">
                                Affected text: &ldquo;{contextText}&rdquo;
                            </p>
                        )}
                    </div>
                );
            }
        });

        // Only create a suggestion card & inline highlight if actual content edits occurred
        if (changeItems.length > 0) {
            // Register non-destructive inline highlight for this suggestion
            setPendingHighlights(prev => {
                const filtered = prev.filter(item => item.id !== datagotten["id"]);
                return [
                    ...filtered,
                    {
                        id: datagotten["id"],
                        username: datagotten.username,
                        color: userColor,
                        ops: consolidatedOps,
                    }
                ];
            });

            const card = (
                <div
                    key={datagotten["id"]}
                    id={datagotten["id"]}
                    className="border border-zinc-200 shadow-sm p-4 mb-3 rounded-[12px] overflow-x-hidden w-[360px] bg-white"
                    style={{ borderLeft: `4px solid ${userColor}` }}
                >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                            <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: userColor }}
                            />
                            <span className="text-xs font-semibold text-zinc-700">
                                Edit #{datagotten["id"]} by {datagotten.username}
                            </span>
                        </div>
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: userColor }}
                        >
                            {datagotten.username}
                        </span>
                    </div>

                    <div className="mb-4 max-h-[200px] overflow-y-auto pr-1">
                        {changeItems}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => { applychanges(datagotten["id"], data1); }}
                            className="flex-1 py-1.5 px-3 cursor-pointer bg-green-700 hover:bg-green-800 text-white text-xs rounded-[8px] font-bold"
                        >
                            APPLY
                        </button>
                        <button
                            onClick={() => { cancelchanges(datagotten["id"]); }}
                            className="flex-1 py-1.5 px-3 cursor-pointer bg-zinc-800 hover:bg-black text-white text-xs rounded-[8px] font-bold"
                        >
                            CANCEL
                        </button>
                    </div>
                </div>
            );

            SubcribeToStore.suggestion(card);
            setSuggestions([...SubcribeToStore.getSuggest()]);
        }
    }, [sub_get_changes, getAffectedContext]);

    function applychanges(id, data) {
        data.forEach((operation) => {
            operation.forEach(ops => {
                if (ops.type === "set_selection") return;
                Transforms.deselect(editor);
                try {
                    editor.apply(ops);
                } catch (err) {
                    console.log(err);
                }
            });
        });

        // Remove only this suggestion's inline highlight
        setPendingHighlights(prev => prev.filter(item => parseInt(item.id) !== parseInt(id)));

        // Broadcast updated document to all collaborators after applying edits
        send_msg(editor.children);

        let new_suggestion = SubcribeToStore.getSuggest().filter(items => parseInt(items.key) != parseInt(id));
        SubcribeToStore.removsuggest();
        new_suggestion.forEach(e => SubcribeToStore.suggestion(e));
        setSuggestions([...SubcribeToStore.getSuggest()]);
    }

    function cancelchanges(id) {
        // Remove only this suggestion's inline highlight
        setPendingHighlights(prev => prev.filter(item => parseInt(item.id) !== parseInt(id)));

        let new_suggestion = SubcribeToStore.getSuggest().filter(items => parseInt(items.key) != parseInt(id));
        SubcribeToStore.removsuggest();
        new_suggestion.forEach(e => SubcribeToStore.suggestion(e));
        setSuggestions([...SubcribeToStore.getSuggest()]);
    }

    useEffect(() => {
        if (subscribe.length > 0) {
            if (subscribe[0][0].owner) {
                setSender(true);
                // Broadcast initial document state when owner opens the editor
                send_msg(editor.children);
            }
        }
    }, [subscribe]);

    // Broadcast current owner document whenever a new collaborator joins and requests sync
    useEffect(() => {
        if (syncTrigger > 0 && subscribe[0]?.[0]?.owner === true) {
            send_msg(editor.children);
        }
    }, [syncTrigger]);

    useEffect(() => {
        if (subscribe_get != undefined && subscribe_get["msg"]) {
            try {
                let data_gotten = JSON.parse(subscribe_get["msg"]);
                // Only update if we're NOT the owner (owner controls the editor)
                if (subscribe[0][0]?.owner === false) {
                    Transforms.deselect(editor);
                    setInitialvalue(data_gotten);
                    setEditorKey(Date.now());
                }
            } catch (e) {
                console.log("Error parsing editor state:", e);
            }
        }
    }, [subscribe_get, subscribe, editor]);

    function send_msg(data) {
        sendtext(data, true, []);
    }

    const saveToPdf = async () => {
        const editorTree = editor.children;
        const html = slateToHtml(editorTree);
        const req = await fetch(`${API_URL_5000}/rest/convert_to_down_doc`, {
            method: "POST",
            headers: {
                "Accept": "*/*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ data: { type: "html", doc: html } })
        });
        const response = await req.blob();
        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = "filename.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    function send_edits() {
        if (myoperations.length === 0) return;
        sendtext([], false, myoperations);
        setOperations([]);
    }

    const renderLeaf = useCallback(({ attributes, children, element, leaf }) => {
        if (leaf.bold) {
            children = <strong>{children}</strong>;
        }
        if (leaf.italic) {
            children = <em>{children}</em>;
        }
        if (leaf.underline) {
            children = <u>{children}</u>;
        }
        if (leaf.fontSize) {
            children = <span style={{ fontSize: leaf.fontSize }}>{children}</span>;
        }
        if (leaf['line-through']) {
            children = <del>{children}</del>;
        }
        if (leaf.color) {
            children = <span style={{ color: leaf.color }}>{children}</span>;
        }
        if (leaf.mark) {
            children = <mark>{children}</mark>;
        }
        if (leaf.fontFamily) {
            children = <span style={{ fontFamily: leaf.fontFamily }}>{children}</span>;
        }

        // Render inline collaborator indicators without altering document text or unaffected lines
        if (leaf.suggestionHighlight) {
            const c = leaf.suggestionColor || "#2563eb";
            if (leaf.suggestionType === "remove_text") {
                return (
                    <span
                        {...attributes}
                        title={`Deletion suggested by ${leaf.suggestionUser}`}
                        style={{
                            color: c,
                            backgroundColor: `${c}20`,
                            textDecoration: "line-through",
                            borderBottom: `2px solid ${c}`,
                            padding: "0 2px",
                            borderRadius: "3px",
                        }}
                    >
                        {children}
                    </span>
                );
            }

            if (leaf.suggestionType === "insert_text") {
                return (
                    <span {...attributes}>
                        {children}
                        <span
                            contentEditable={false}
                            title={`Insertion suggested by ${leaf.suggestionUser}`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: c,
                                backgroundColor: `${c}18`,
                                border: `1px solid ${c}`,
                                borderRadius: "4px",
                                padding: "0 5px",
                                margin: "0 2px",
                                fontSize: "0.85em",
                                fontWeight: 600,
                                userSelect: "none",
                            }}
                        >
                            <span>+{leaf.suggestionText}</span>
                            <span
                                style={{
                                    fontSize: "0.7em",
                                    backgroundColor: c,
                                    color: "#fff",
                                    borderRadius: "3px",
                                    padding: "0 4px",
                                }}
                            >
                                {leaf.suggestionUser}
                            </span>
                        </span>
                    </span>
                );
            }

            return (
                <span {...attributes}>
                    {children}
                    <span
                        contentEditable={false}
                        title={`Edit suggested by ${leaf.suggestionUser}`}
                        style={{
                            display: "inline-block",
                            marginLeft: "6px",
                            fontSize: "0.72em",
                            fontWeight: 600,
                            color: "#fff",
                            backgroundColor: c,
                            borderRadius: "4px",
                            padding: "1px 6px",
                            userSelect: "none",
                        }}
                    >
                        {leaf.suggestionUser}: {leaf.suggestionType === "split_node" ? "new line" : leaf.suggestionText || "block edit"}
                    </span>
                </span>
            );
        }

        return <span {...attributes}>{children}</span>;
    }, []);

    return (
        <div>
            {subscribe.length > 0 && subscribe[0][0].owner == false ?
                <button
                    onClick={() => send_edits()}
                    className='ml-10 p-1.5 px-4 rounded-[10px] text-white relative bg-green-700 cursor-pointer'
                >
                    publish
                    {myoperations.length > 0 ? ` (${myoperations.length})` : ""}
                </button>
                :
                null
            }

            <button onClick={() => { saveToPdf(); }} className="ml-[76%] p-2 bg-amber-500 rounded-[10px] text-white cursor-pointer">
                save
            </button>

            <Slate
                key={editorKey}
                editor={editor}
                initialValue={initialValue}
                onChange={newValue => {
                    const { operations } = editor;
                    if (subscribe[0][0]?.owner === false) {
                        // Filter out pure cursor/selection movements so only actual edits are recorded
                        const meaningfulOps = operations.filter(op => op.type !== 'set_selection');
                        if (meaningfulOps.length > 0) {
                            setOperations(prev => [...prev, meaningfulOps]);
                        }
                    } else {
                        send_msg(newValue);
                    }
                }}
            >
                <Toolbar readOnlyFunc={toogleReadonly} />
                <Editable
                    style={{ outline: 'none', border: "1px solid #d1d5dc", borderTop: "0px", padding: "2em", minHeight: "500px" }}
                    decorate={decorateRanges}
                    renderLeaf={renderLeaf}
                    readOnly={readonly}
                />
            </Slate>

            {sender ?
                <div>
                    <h3 className="p-4 font-bold"> SUGGESTIONS ({suggestions.length}) </h3>
                    <div className="p-5 flex flex-wrap gap-4">
                        {suggestions}
                    </div>
                </div>
                : null
            }
        </div>
    );
}