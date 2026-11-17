"use client";
import {
  faArrowLeft,
  faBookOpen,
  faCheck,
  faCommentDots,
  faCommentNodes,
  faEdit,
  faRobot,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import * as pdfjsLib from "pdfjs-dist";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import ReactMarkdown from "react-markdown";

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Tools to convert to slate
import { unified } from "unified";
import markdown from "remark-parse";
import { remarkToSlate } from "remark-slate-transformer";

const API_URL_5000 = process.env.NEXT_PUBLIC_API_URL_5000 || 'http://127.0.0.1:5000';

interface Comment {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  color: string;
  class: string;
}

const color = [
  "#ffc0cb",
  "#ffa500",
  "#008000",
  "#ee82ee",
  "#8a2be2",
  "#7fffd4",
  "#ffebcd",
  "#0a0a0a",
];

interface searchCord {
  str: string;
  page: number;
  cordinates: { x: number; y: number; width: number; height: number };
}

interface PdfViewerProps {
  data: {
    pdfUrl: string | null;
    selectedFile: File | undefined;
    close: () => void;
    fileexplore: () => void;
    openEditor: (data: string) => void;
  };
}

interface highlitedForComments {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  text: string;
  class: string;
}

interface keywords_inf {
  content: string;
  explanation: string;
  pageno: number;
  points: { x: number; y: number; width: number; height: number };
}

export default function PdfViewer(data: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [similarSrch, setSimilarSrch] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currSelection, setCurrSelection] = useState<highlitedForComments[]>([]);
  const [searchResult, setSearchResult] = useState<searchCord[]>([]);
  const [isAddingComment, setIsAddingComment] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentKey, setDocumentKey] = useState<string>("");
  const gotoInput = useRef<HTMLInputElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const [highlights, setHighlights] = useState<highlitedForComments[]>([]);
  const [tableCon, SetTableCon] = useState<{ title: string; pageno: number }[]>([]);
  const [keywords, SetKeywords] = useState<keywords_inf[]>([]);
  const [airesult, SetAiresult] = useState<string>("");
  const [keyset, setKeyset] = useState<boolean>(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    Explain_Keyword();
  }, []);

  const AddSearchHighlight = (matched: searchCord[]) => {
    matched.forEach((item) => {
      const docParent = window.document.getElementById(`index-${item.page}`) as HTMLElement;
      if (!docParent) return;

      const div = window.document.createElement("div");
      div.style.position = "absolute";
      div.style.margin = "0";
      div.style.top = `${(item.cordinates.y - item.cordinates.height) * scale + 3}px`;
      div.style.left = `${item.cordinates.x * scale}px`;
      div.style.width = `${item.cordinates.width * scale}px`;
      div.style.height = `${item.cordinates.height * scale}px`;
      div.style.backgroundColor = "yellow";
      div.style.zIndex = "15";
      div.style.opacity = "0.4";
      div.style.pointerEvents = "none";
      div.classList.add("highlighted");
      docParent.appendChild(div);
    });
  };

  const AddKeywords = (matched: keywords_inf[]) => {
    window.document.querySelectorAll(".keyword-underline").forEach((el) => el.remove());

    matched.forEach((item) => {
      const docParent = window.document.getElementById(`index-${item.pageno}`) as HTMLElement;
      if (!docParent) return;

      const div = window.document.createElement("div");
      div.classList.add("keyword-underline");
      div.style.position = "absolute";
      div.style.margin = "0";
      // Thin 6px clickable underline at the baseline so the text body remains 100% selectable
      div.style.top = `${item.points.y * scale - 2}px`;
      div.style.left = `${item.points.x * scale}px`;
      div.style.width = `${Math.max(item.points.width * scale, 12)}px`;
      div.style.height = "6px";
      div.style.borderBottom = "1.5px solid rgba(37, 99, 235, 0.35)";
      div.style.backgroundColor = "transparent";
      div.style.zIndex = "25";
      div.style.cursor = "pointer";
      div.style.pointerEvents = "auto";
      div.title = "Click underline for AI explanation";

      div.onmouseenter = () => {
        div.style.borderBottom = "2px solid rgba(37, 99, 235, 0.9)";
      };
      div.onmouseleave = () => {
        div.style.borderBottom = "1.5px solid rgba(37, 99, 235, 0.35)";
      };

      // Only trigger AI popup on a stationary click (not when dragging to highlight text)
      let startX = 0;
      let startY = 0;
      div.onmousedown = (e) => {
        startX = e.clientX;
        startY = e.clientY;
      };
      div.onmouseup = (e) => {
        const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (moved < 4) {
          e.stopPropagation();
          getAiDiv(item);
        }
      };

      docParent.appendChild(div);
    });
  };

  useEffect(() => {
    if (keyset && keywords.length > 0) {
      AddKeywords(keywords);
      setKeyset(false);
    }
  }, [keyset, keywords]);

  const CreateHighlight = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const class_ = `class-${Math.random()}`;
    const range = selection.getRangeAt(0);
    const rects = range.getBoundingClientRect();

    if (rects.width === 0) return;

    let pageNum = 0;
    let pageContainer: HTMLElement | null = null;

    const commonAncestor = range.commonAncestorContainer;
    let current: HTMLElement | null =
      commonAncestor.nodeType === Node.TEXT_NODE
        ? commonAncestor.parentElement
        : (commonAncestor as HTMLElement);

    while (current && current !== document.body) {
      const pageMatch = current.id?.match(/^index-\d+$/);
      if (pageMatch) {
        pageNum = parseInt(pageMatch[0].slice(6), 10);
        pageContainer = current;
        break;
      }
      current = current.parentElement;
    }

    if (!pageContainer || pageNum === 0) return;

    const pageRect = pageContainer.getBoundingClientRect();
    const x = (rects.left - pageRect.left) / scale;
    const y = (rects.top - pageRect.top) / scale;
    const width = rects.width / scale;
    const height = rects.height / scale;

    const newHighlight: highlitedForComments = {
      page: pageNum,
      x,
      y,
      width,
      height,
      id: `highlight-${Date.now()}-${Math.random()}`,
      text: selectedText,
      class: class_,
    };

    // Position floating action toolbar via fixed viewport coordinates (no DOM reparenting)
    const btnz = window.document.getElementById("btnz") as HTMLElement;
    if (btnz) {
      btnz.style.position = "fixed";
      btnz.style.top = `${rects.bottom + 8}px`;
      btnz.style.left = `${rects.left}px`;
      btnz.style.zIndex = "9999";
      btnz.style.opacity = "1";
      btnz.style.display = "flex";
      btnz.style.pointerEvents = "auto";
    }

    setCurrSelection([newHighlight]);
  }, [scale]);

  const addComment = () => {
    if (commentInput.current && currSelection.length > 0) {
      if (commentInput.current.value.trim().length > 0) {
        const comment: Comment = {
          class: currSelection[0].class,
          color: color[Math.floor(Math.random() * color.length)],
          id: currSelection[0].id,
          page: currSelection[0].page,
          text: commentInput.current.value,
          x: currSelection[0].x,
          y: currSelection[0].y,
        };
        setComments((prev) => [...prev, comment]);
        setHighlights((prev) => [...prev, ...currSelection]);
        setIsAddingComment(false);
        setCurrSelection([]);
        commentInput.current.value = "";

        const btnz = window.document.getElementById("btnz") as HTMLElement;
        if (btnz) btnz.style.display = "none";
      }
    }
  };

  const goToCommentBody = (class_: string, id: string) => {
    const ptag = window.document.getElementById(class_);
    const id_ = window.document.getElementById(id);
    if (ptag && id_) {
      ptag.style.border = "3px solid #00ffff";
      setTimeout(() => {
        ptag.style.border = "1px solid gray";
      }, 5000);
      ptag.scrollIntoView({ behavior: "smooth", block: "center" });
      id_.scrollIntoView({ behavior: "instant", block: "start" });
    }
  };

  const DeleteComment = (id: string, class_: string, page: number) => {
    const paren = window.document.getElementById(`index-${page}`) as HTMLElement;
    const id_ = window.document.getElementById(id) as HTMLElement;
    if (paren && id_) paren.removeChild(id_);

    setComments(comments.filter((com) => com.id !== id));
    setHighlights(highlights.filter((hlit) => hlit.id !== id));
  };

  // Getting the AI div
  const getAiDiv = async (mode: keywords_inf | string) => {
    SetAiresult("");
    const AiDiv = window.document.getElementById("AiDiv") as HTMLElement;
    const loadingAi = window.document.getElementById("loadingAi") as HTMLElement;
    const btnz = window.document.getElementById("btnz") as HTMLElement;
    const curr = currSelection[0];

    if (mode === "None" && !curr) return;
    if (!AiDiv || !loadingAi) return;

    const targetPageNum = mode === "None" ? curr.page : (mode as keywords_inf).pageno;
    const page = window.document.getElementById(`index-${targetPageNum}`) as HTMLElement;
    if (!page) return;

    const pageRect = page.getBoundingClientRect();
    const anchorTop =
      mode === "None"
        ? pageRect.top + (curr.y + curr.height) * scale + 12
        : pageRect.top + ((mode as keywords_inf).points.y + (mode as keywords_inf).points.height) * scale + 12;
    const anchorLeft =
      mode === "None"
        ? pageRect.left + curr.x * scale
        : pageRect.left + (mode as keywords_inf).points.x * scale;

    if (btnz) btnz.style.display = "none";

    AiDiv.style.position = "fixed";
    AiDiv.style.top = `${Math.min(anchorTop, window.innerHeight - 240)}px`;
    AiDiv.style.left = `${Math.max(16, Math.min(anchorLeft, window.innerWidth - 500))}px`;
    AiDiv.style.zIndex = "9999";
    AiDiv.style.display = "block";
    loadingAi.style.display = "block";

    if (mode === "None") {
      const selectedText = curr.text;
      try {
        const req = await fetch(`${API_URL_5000}/rest/explain_query`, {
          method: "POST",
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: selectedText }),
        });
        const data_gotten = await req.json();
        try {
          data_gotten.forEach((element: any) => {
            if (element.type == "text") {
              SetAiresult(`${element["text"]}`);
            }
          });
        } catch (err) {
          SetAiresult(`${data_gotten}`);
        }
      } catch (err) {
        SetAiresult("Failed to fetch AI explanation.");
      }
    } else {
      SetAiresult((mode as keywords_inf).explanation);
    }

    loadingAi.style.display = "none";
  };

  // Extract text and search PDF for exact word
  const ExtractText = async (text: string) => {
    if (text.length < 3) {
      setSimilarSrch(false);
      setSearchResult([]);
      return null;
    }
    setSimilarSrch(true);

    const loadingTask = pdfjsLib.getDocument(documentKey);
    const pdf = await loadingTask.promise;
    const fullText: searchCord[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      textContent.items.forEach((item: any) => {
        if (item.str !== undefined) {
          if (String(item.str).toLowerCase().includes(text.toLowerCase())) {
            fullText.push({
              str: item.str,
              page: i,
              cordinates: {
                x: item.transform[4],
                y: page.getViewport({ scale: 1 }).height - item.transform[5],
                width: item.width,
                height: item.height,
              },
            });
          }
        }
      });
    }
    setSearchResult(fullText);
  };

  const Explain_Keyword = async () => {
    const loadingTask = pdfjsLib.getDocument(String(data.data.pdfUrl));
    const pdf = await loadingTask.promise;
    const pdf_send: any[] = [];
    let document_entire = "";
    SetKeywords([]);

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const unscaledViewport = page.getViewport({ scale: 1 });

      textContent.items.forEach((item: any) => {
        document_entire += String(item.str) + " ";
      });

      textContent.items.forEach((item: any) => {
        pdf_send.push({
          content: String(item.str),
          pageno: i,
          points: {
            y: unscaledViewport.height - item.transform[5],
            x: item.transform[4],
            width: item.width,
            height: item.height,
          },
        });
      });
    }

    const req = await fetch(`${API_URL_5000}/rest/keywords_detection`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [document_entire, document_entire] }),
    });

    const response = await req.json();
    const data_gotten = JSON.parse(response);
    const matchedKeywords: keywords_inf[] = [];

    data_gotten["output"].forEach((kw: { content: string; explanation: string }) => {
      pdf_send.forEach((element: any) => {
        if (
          element.content.trim().length > 1 &&
          String(element.content).toLowerCase().includes(kw.content.toLowerCase())
        ) {
          matchedKeywords.push({
            ...element,
            explanation: kw.explanation,
          });
        }
      });
    });

    SetKeywords(matchedKeywords);
    setKeyset(true);
  };

  useEffect(() => {
    window.document.querySelectorAll(".highlighted").forEach((e) => {
      e.remove();
    });
    AddSearchHighlight(searchResult);

    if (keywords.length > 0) {
      try {
        AddKeywords(keywords);
      } catch (err) {}
    }
  }, [scale, searchResult, keywords]);

  // Hide floating toolbar when selection is cleared elsewhere
  useEffect(() => {
    const handleSelectionChange = () => {
      const getBtnz = window.document.getElementById("btnz") as HTMLElement;
      const selection = document?.getSelection();
      if (selection?.isCollapsed && getBtnz && !isAddingComment) {
        getBtnz.style.display = "none";
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isAddingComment]);

  useEffect(() => {
    if (highlights.length > 0) {
      highlights.forEach((hlit) => {
        const paren = window.document.getElementById(`index-${hlit.page}`) as HTMLElement;
        const id_ = window.document.getElementById(hlit.id) as HTMLElement;
        if (paren && id_) paren.removeChild(id_);
      });
      highlights.forEach((hlit) => {
        const docParent = window.document.getElementById(`index-${hlit.page}`) as HTMLElement;
        if (!docParent) return;

        const div = window.document.createElement("div");
        div.style.position = "absolute";
        div.style.margin = "0";
        div.style.top = `${hlit.y * scale}px`;
        div.style.left = `${hlit.x * scale}px`;
        div.style.width = `${hlit.width * scale}px`;
        div.style.height = `${hlit.height * scale}px`;
        div.style.backgroundColor = "#00ffff";
        div.style.zIndex = "15";
        div.style.opacity = "0.4";
        div.style.cursor = "pointer";
        div.id = hlit.id;
        div.onclick = () => {
          goToCommentBody(hlit.class, hlit.id);
        };
        docParent.appendChild(div);
      });
    }
  }, [highlights, scale]);

  useEffect(() => {
    if (data.data.pdfUrl != null) {
      setDocumentKey(data.data.pdfUrl);
      setFile(data.data.selectedFile ? data.data.selectedFile : null);
    }
  }, [data.data.pdfUrl]);

  const goToPage = (FormData: number) => {
    if (FormData) {
      if (FormData > numPages) return;
      window.document.getElementById(`index-${FormData}`)?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  };

  const get_table_con = async () => {
    const loadingCont = window.document.getElementById("loadingCont") as HTMLElement;
    const loadingTask = pdfjsLib.getDocument(documentKey);
    const pdf = await loadingTask.promise;
    const pdf_send: { content: string; pageno: number }[] = [];

    loadingCont.style.display = "block";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      let text = "";

      textContent.items.forEach((item: any) => {
        text += String(item.str);
      });

      pdf_send.push({ content: text, pageno: i });
    }

    const getrequest = await fetch(`${API_URL_5000}/rest/get_table_query`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: pdf_send }),
    });

    const res = await getrequest.json();
    loadingCont.style.display = "none";
    res.forEach((element: any) => {
      if (element.type == "text") {
        const parsed = JSON.parse(String(element.text).replaceAll("\n", ""));
        SetTableCon(parsed);
      }
    });
  };

  const EditCurrPdf = async () => {
    const processor = unified().use(markdown).use(remarkToSlate);
    try {
      const response = await fetch(documentKey);
      const blob = await response.blob();
      const file = new File([blob], "newpdf.pdf", { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", file);

      const getMarkup = await fetch(`${API_URL_5000}/rest/convert_pdf_markup`, {
        method: "POST",
        headers: {
          Accept: "*/*",
        },
        body: formData,
      });
      const resp = await getMarkup.json();
      const value = processor.processSync(resp["markdown"]).result;
      data.data.openEditor(JSON.stringify(value));
    } catch (error) {
      console.error("Error converting URL to file:", error);
    }
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  return (
    <div id="pdf-viewer" className="absolute top-0 flex flex-col h-screen bg-gray-100 w-full overflow-hidden z-8">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FontAwesomeIcon className="cursor-pointer" onClick={() => data.data.close()} icon={faArrowLeft} />
          <div className="flex items-center gap-2">
            {file && <span className="text-sm text-gray-600 truncate max-w-50">{file.name}</span>}
          </div>

          {/* Navigation */}
          <div>
            <span className="cursor-pointer" onClick={() => get_table_con()} title="AI table of content">
              <FontAwesomeIcon icon={faBookOpen} />
            </span>
            <span
              className="cursor-pointer"
              onClick={() => data.data.fileexplore()}
              title="AI explore document"
            >
              <FontAwesomeIcon className="ml-3 text-blue-600" icon={faCommentNodes} />
            </span>
            <span className="cursor-pointer" onClick={() => EditCurrPdf()} title="edit document">
              <FontAwesomeIcon className="ml-3" icon={faEdit} />
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* search */}
            <form action="" onSubmit={(e) => e.preventDefault()}>
              <input
                onChange={(e) => ExtractText(e.currentTarget.value)}
                className="border pl-2 focus:rounded-[10px]"
                type="text"
                placeholder="search word"
                name="searchwd"
                id="searchwd"
              />
            </form>

            {/* goto */}
            <form
              action=""
              className="ml-24"
              onSubmit={(e) => {
                e.preventDefault();
                goToPage(gotoInput.current ? parseInt(gotoInput.current.value) : 0);
              }}
            >
              <label className="text-sm" htmlFor="goto">
                {" "}
                go to{" "}
              </label>
              <input
                ref={gotoInput}
                className="w-10 border outline-0"
                defaultValue="0"
                type="text"
                name="goto"
                id="goto"
              />
              <span> / {numPages}</span>
            </form>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">
              -
            </button>
            <span className="px-2 min-w-15 text-center">{Math.round(scale * 100)} % </span>
            <button onClick={zoomIn} className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table of content */}
        <div className="text-sm w-60 p-2 bg-white text-blue-400">
          <div className="mt-9"></div>
          <span id="loadingCont" className="loader ml-3 hidden"></span>
          {tableCon.length > 0 && (
            <>
              <p className="text-black"> Table Of Content</p>
              {tableCon.map((con, index) => (
                <button
                  onClick={() => goToPage(con.pageno)}
                  key={index}
                  className="text-left cursor-pointer block"
                >
                  {" "}
                  {con.title}.......... {con.pageno}{" "}
                </button>
              ))}
            </>
          )}
        </div>

        {/* PDF Viewer */}
        <div
          onMouseUp={CreateHighlight}
          onScroll={() => {
            const btnz = window.document.getElementById("btnz");
            if (btnz) btnz.style.display = "none";
          }}
          className="overflow-auto p-8 bg-white w-[70%]"
        >
          <div className="flex justify-center">
            <div className="relative">
              <Document
                key={documentKey || "default"}
                file={documentKey || data.data.pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="text-gray-600 text-xl"> Loading PDF... </div>}
                error={<div className="text-red-400 text-xl"> Failed to load PDF </div>}
              >
                {Array.from(new Array(numPages), (el, index) => (
                  <div
                    style={{ position: "relative" }}
                    className="mb-2 z-3"
                    key={index}
                    id={`index-${index + 1}`}
                  >
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      scale={scale}
                      className="border border-zinc-200 z-1"
                      renderAnnotationLayer={true}
                      renderTextLayer={true}
                      onGetAnnotationsError={() => console.log("Annotations layer disabled")}
                    />
                  </div>
                ))}
              </Document>

              {/* AI Explanation Popup */}
              <div
                id="AiDiv"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                style={{ zIndex: 9999 }}
                className="fixed top-80 w-120 bg-white border border-zinc-300 rounded-md p-2 shadow-xl hidden"
              >
                <FontAwesomeIcon
                  onClick={() => {
                    const el = window.document.getElementById("AiDiv");
                    if (el) el.style.display = "none";
                  }}
                  className="ml-[90%] cursor-pointer"
                  icon={faXmark}
                />
                <p id="loadingAi" className="text-sm loader"></p>
                <div className="w-full h-px bg-zinc-300 mt-2"></div>
                <div className="text-sm p-3 min-h-3 h-fit max-h-40 overflow-y-auto bg-zinc-100">
                  <span id="AiResult">
                    <ReactMarkdown>{airesult}</ReactMarkdown>
                  </span>
                </div>
              </div>

              {/* Floating Selection Action Buttons */}
              <div
                id="btnz"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseUp={(e) => e.stopPropagation()}
                style={{ zIndex: 9999 }}
                className="fixed w-fit h-fit border border-zinc-300 rounded-md px-2 py-1 bg-white shadow-lg items-center gap-3 hidden"
              >
                <button
                  type="button"
                  title="Add comment"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAddingComment(true);
                  }}
                  className="cursor-pointer hover:text-zinc-700 text-zinc-500 p-1"
                >
                  <FontAwesomeIcon className="text-[1rem]" icon={faCommentDots} />
                </button>
                <button
                  type="button"
                  title="Explain with AI"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    getAiDiv("None");
                  }}
                  className="cursor-pointer hover:text-blue-600 text-blue-400 p-1"
                >
                  <FontAwesomeIcon className="text-[1rem]" icon={faRobot} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Sidebar */}
        <div id="CommentDiv" className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p> Comments ({comments.length}) </p>
          </div>
          {/* add comment */}
          {isAddingComment && (
            <div className="m-5">
              <textarea
                ref={commentInput}
                placeholder="Write a comment..."
                className="w-full h-20 p-2 border border-zinc-300 rounded-md"
                style={{ resize: "none" }}
              ></textarea>
              <div className="flex gap-3 mt-1">
                <button onClick={() => addComment()} className="cursor-pointer">
                  <FontAwesomeIcon className="font-extrabold text-green-700" icon={faCheck} />
                </button>
                <button onClick={() => setIsAddingComment(false)} className="cursor-pointer">
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            </div>
          )}

          {/* list comment */}
          {comments.map((com) => (
            <div key={com.class} className="m-5">
              <p
                id={com.class}
                className="h-20 overflow-hidden text-[0.7rem] overflow-y-auto border border-zinc-300 p-2"
              >
                {com.text}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => DeleteComment(com.id, com.class, com.page)}
                  className="w-full p-1 text-center text-sm shadow-sm rounded-sm border border-zinc-300 mt-1 tracking-[1px] bg-zinc-200 cursor-pointer"
                >
                  delete
                </button>
                <button
                  onClick={() => goToCommentBody(com.class, com.id)}
                  className="w-full p-1 text-center text-sm shadow-sm rounded-sm border border-zinc-300 mt-1 tracking-[1px] bg-zinc-50 cursor-pointer"
                >
                  review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* similar word search on pdf */}
      {similarSrch ? (
        <div
          id="AiGenconView"
          className="w-150 h-full z-50 absolute top-0 right-0 border-l p-5 bg-white border-zinc-200 overflow-scroll"
        >
          <div className="fixed bg-white">
            <FontAwesomeIcon
              className="cursor-pointer"
              onClick={() => setSimilarSrch(false)}
              icon={faArrowLeft}
            />
          </div>
          {searchResult.length > 0 &&
            searchResult.map((searchdata, i) => (
              <div key={i} className="text-sm mt-10">
                <p className="pb-2 mt-2"> page {searchdata.page} </p>
                <p className="border p-1"> {searchdata.str} </p>
                <button
                  onClick={() => goToPage(searchdata.page)}
                  className="bg-amber-200 cursor-pointer p-2 rounded-sm mt-1"
                >
                  go
                </button>
              </div>
            ))}
        </div>
      ) : (
        ""
      )}
    </div>
  );
}