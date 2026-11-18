"use client"
import Image from "next/image";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightToBracket, faPlus, faSearch, faStickyNote } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SubcribeToStore } from "../useSyncstore";
import { XLSXVIEW } from "./xlsxview";

import dynamic from 'next/dynamic';
import Reportspage from "./reports";

// tools to convert to slate
import { unified } from "unified";
import markdown from "remark-parse";
import { remarkToSlate } from "remark-slate-transformer";
import Link from "next/link";

interface PdfViewerProps {
  pdfUrl: string | null;
  selectedFile: File | undefined;
  close: () => void;
  fileexplore: () => void;
  openEditor: (data: string) => void;
}

const WriteUp = dynamic(
  () => import('./aiWriteup'),
  { ssr: false }
);

const PdfViewer = dynamic(
  () => import('../../app/reports/pdf-viewer'),
  { ssr: false }
);

const AImodels = [
    "qwen3.5:397b-cloud",
    "qwen3.5:cloud",
    "qwen2.5-coder:latest",
    "qwen2.5-coder:1.5b",
    "qwen3.5:0.8b",
    "gemma-4-31b-it"
];

const API_URL = process.env.NEXT_PUBLIC_API_URL_5000 || 'http://127.0.0.1:5000';

export const Home = () => {
    const [pdfViewerSec, setPdfViewerSec] = useState<boolean>(false);
    const [Xlsxviewer, setXlsxviewer] = useState<boolean>(false);
    const [editorSec, setEditorSec] = useState<boolean>(false);
    const [currModel, setCurrModel] = useState<string>("qwen3.5:397b-cloud");
    const [dataTogen, setDataTogen] = useState<{
        type: string;
        query: string;
        file: string | null;
        aidoc: string;
    }>({ type: "", query: "", file: null, aidoc: "" });
    const aiInput = useRef<HTMLInputElement>(null);
    const [xlsxdata, Setxlsxdata] = useState<{
        file: File | undefined;
        close: () => void;
        savefile: (file: File) => void;
    }>({ file: undefined, close: () => {}, savefile: () => {} });

    const [document, SetDocument] = useState<PdfViewerProps>({
        pdfUrl: null,
        selectedFile: undefined,
        close: () => {},
        fileexplore: () => {},
        openEditor: (data: string) => {}
    });

    const [addfile, setAddFile] = useState<{ type: string; name: string; URL: string; file: File }[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    // initial value [array of slate objects] passed to slate component
    const [editorInit, setEditoeInit] = useState<string>("");
    let OpSt = 0;

    const subscribe = useSyncExternalStore(
        SubcribeToStore.subscribe,
        SubcribeToStore.getSnapshot,
        SubcribeToStore.getSnapshot
    );

    useEffect(() => {
        (window.document.getElementById("links") as HTMLElement)?.click();
        if (subscribe.length === 0 || subscribe == null) {
            window.location.href = "/";
            return;
        }
        if (subscribe[0]?.[0]?.["owner"] === false) {
            setEditorSec(true);
        }
    }, [subscribe]);

    const setMode = (model: number) => {
        const modelDiv = window.document.getElementById("modelsCon") as HTMLElement;
        if (OpSt === 0) {
            modelDiv.style.display = "block";
            OpSt = 1;
        } else {
            modelDiv.style.display = "none";
            OpSt = 0;
        }
    };

    const sendToAi = async () => {
        const queryText = aiInput.current?.value || "";
        if (!queryText.trim()) return;

        const data_send = {
            type: currModel,
            query: queryText,
            chatid: subscribe[0]?.[0]?.chatid
        };

        // Open the WriteUp drawer immediately (shows the loading spinner while aidoc is empty)
        setDataTogen({ type: "AiDocGen", query: queryText, file: null, aidoc: "" });
        if (aiInput.current) {
            aiInput.current.value = "";
        }

        try {
            const response = await fetch(`${API_URL}/rest/gen_ai_doc`, {
                method: "POST",
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data_send)
            });

            const result = await response.json();

            // Update state with the full generated document
            setDataTogen(prev => ({
                ...prev,
                aidoc: result["aidoc"]
            }));
        } catch (error) {
            console.error("Error generating AI document:", error);
        }
    };

    const closeAiGen = () => {
        setDataTogen({ type: "", query: "", file: null, aidoc: "" });
    };

    const openSearchFiles = () => {
        const formSearchFiles = window.document.getElementById("formSearchFiles") as HTMLElement;
        formSearchFiles.style.transition = "1s ease";
        formSearchFiles.style.width = "fit-content";
    };

    const isSpreadsheet = (fileName: string) => {
        const lower = fileName.toLowerCase();
        return (
            lower.endsWith(".xlsx") ||
            lower.endsWith(".xls") ||
            lower.endsWith(".xlsb") ||
            lower.endsWith(".csv") ||
            lower.endsWith(".ods")
        );
    };

    const isWordDoc = (fileName: string) => {
        const lower = fileName.toLowerCase();
        return lower.endsWith(".doc") || lower.endsWith(".docx");
    };

    const openDocInEditor = async (selectedFile: File) => {
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const response = await fetch(`${API_URL}/rest/convert_pdf_markup`, {
                method: "POST",
                body: formData
            });

            const result = await response.json();
            if (result?.markdown) {
                const processor = unified().use(markdown).use(remarkToSlate);
                const value = processor.processSync(result.markdown).result;
                setEditoeInit(JSON.stringify(value));
                setEditorSec(true);
            }
        } catch (error) {
            console.error("Error converting Word document to editor:", error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        let exist = false;
        if (selectedFile) {
            addfile.forEach((file) => {
                if (file.name == selectedFile?.name && file.type == selectedFile?.type) {
                    alert("this file already exist");
                    return (exist = true);
                }
            });
            if (exist) return;

            const fileUrl = URL.createObjectURL(selectedFile);
            const newfile = {
                type: selectedFile.type,
                name: selectedFile.name,
                URL: fileUrl,
                file: selectedFile
            };
            setAddFile(prev => [...prev, newfile]);
        }
        e.target.value = "";
    };

    const OpenPdfEditor = (pdfUrl: string, selectedFile: File) => {
        if (isSpreadsheet(selectedFile.name)) {
            Setxlsxdata({
                file: selectedFile,
                close: () => { setXlsxviewer(false); },
                savefile: (filedata: File) => {
                    Setxlsxdata(prev => ({ ...prev, file: filedata }));
                    setAddFile(prev =>
                        prev.map(f =>
                            f.name === filedata.name
                                ? { ...f, file: filedata, URL: URL.createObjectURL(filedata) }
                                : f
                        )
                    );
                }
            });
            setXlsxviewer(true);
            return;
        }

        if (isWordDoc(selectedFile.name)) {
            openDocInEditor(selectedFile);
            return;
        }

        const close = () => { setPdfViewerSec(false); };
        const sendToAIEx = () => {
            setDataTogen({
                type: "AiFilEx",
                query: "",
                file: URL.createObjectURL(selectedFile),
                aidoc: ""
            });
        };
        SetDocument({
            pdfUrl: pdfUrl,
            selectedFile: selectedFile,
            close,
            fileexplore: sendToAIEx,
            openEditor: ConvertCurrDocToSlate
        });
        setPdfViewerSec(true);
    };

    const ConvertCurrDocToSlate = (data: string) => {
        setEditorSec(true);
        setEditoeInit(data);
    };

    const AiEditDoc = () => {
        setEditorSec(true);
        const processor = unified().use(markdown).use(remarkToSlate);
        if (dataTogen.aidoc.length > 4) {
            const value = processor.processSync(dataTogen.aidoc).result;
            setEditoeInit(JSON.stringify(value));
        }
    };

    const filteredFiles = addfile.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full h-full overflow-hidden">
            <header className="border border-zinc-200 p-3 top-0 absolute w-full shadow-sm">
                <div className="flex -mt-3">
                    <FontAwesomeIcon
                        onClick={() => { openSearchFiles(); }}
                        icon={faSearch}
                        className="mt-2 cursor-pointer"
                    />
                    <form
                        id="formSearchFiles"
                        onSubmit={(e) => e.preventDefault()}
                        className="ml-2 w-0 overflow-hidden"
                    >
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search files..."
                            className="border mt-1 rounded-2xl outline-0 pl-2 text-sm"
                        />
                    </form>
                    <label className="cursor-pointer">
                        <FontAwesomeIcon
                            aria-label="gain insight on document"
                            icon={faPlus}
                            className="mt-2 ml-3 font-extrabold"
                        />
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsb,.csv,.ods"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>
            </header>

            <div className="flex p-4">
                <div className="w-50 border-r border-zinc-200 h-screen -mt-3.5 p-1 pt-12">
                    {/* add Files Selected */}
                    {filteredFiles.map((file, i) => {
                        const lowerName = file.name.toLowerCase();
                        const iconSrc = isWordDoc(lowerName)
                            ? "/logo2.png"
                            : lowerName.endsWith(".pdf")
                                ? "/pdf.png"
                                : "/logo1.png";

                        return (
                            <div
                                onClick={() => OpenPdfEditor(file.URL, file.file)}
                                key={i}
                                className="text-sm flex gap-1 mb-2 cursor-pointer items-center hover:bg-zinc-100 p-1 rounded"
                            >
                                <Image
                                    className="w-4 h-4"
                                    src={iconSrc}
                                    alt=""
                                    height={16}
                                    width={16}
                                />
                                <p title={file.name} className="w-30 truncate">
                                    {file.name}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="w-full">
                    <div>
                        <ul className="text-sm m-10 list-disc pl-5">
                            <li>
                                This is a test project, test with small size data
                            </li>
                            <li>
                                it is also ideal to make an api request to the AI after every one minute
                            </li>
                        </ul>
                    </div>

                    <div className="flex justify-center w-full mt-40">
                        <Image
                            src={"/codegen.png"}
                            alt=""
                            width={150}
                            height={150}
                            loading="eager"
                            unoptimized
                        />
                        <h1 className="font-semibold tracking-[0.5em] mt-9 -ml-7">
                            DOCUMENT GENERATOR
                        </h1>
                    </div>

                    <div className="flex justify-center w-full -mt-5">
                        <div>
                            <div className="flex justify-center gap-5">
                                <Image
                                    className="opacity-[0.5]"
                                    src={"/logo1.png"}
                                    alt=""
                                    width={40}
                                    height={40}
                                />
                                <Image
                                    className="opacity-[0.5]"
                                    src={"/logo2.png"}
                                    alt=""
                                    width={40}
                                    height={40}
                                />
                                <Image
                                    className="opacity-[0.5]"
                                    src={"/pdf.png"}
                                    alt=""
                                    width={40}
                                    height={40}
                                />
                            </div>
                            <div className="mt-2">
                                <p className="text-sm text-zinc-500">
                                    Finance Statment | Code | Stories | letters
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex justify-center mt-10">
                        <div className="w-150 h-fit">
                            <div
                                id="modelsCon"
                                className="absolute -mt-39 z-10 border bg-white rounded-[10px] overflow-hidden hidden"
                            >
                                {AImodels.map((models, i) => {
                                    if (models == currModel) {
                                        return (
                                            <p
                                                onClick={() => { setMode(1); setCurrModel(models); }}
                                                key={i}
                                                className="m-2 cursor-pointer text-sm font-extrabold"
                                            >
                                                {models}
                                            </p>
                                        );
                                    } else {
                                        return (
                                            <p
                                                onClick={() => { setMode(1); setCurrModel(models); }}
                                                key={i}
                                                className="m-2 cursor-pointer text-sm"
                                            >
                                                {models}
                                            </p>
                                        );
                                    }
                                })}
                            </div>
                            <p
                                onClick={() => { setMode(OpSt); }}
                                className="text-sm cursor-pointer border-zinc-200 mb-1 pl-3 pr-3 border w-fit rounded-[0.5em] mt-1"
                            >
                                <FontAwesomeIcon className="mr-1 text-zinc-700" icon={faStickyNote} />
                                {currModel}
                            </p>

                            <form
                                onSubmit={(e) => { e.preventDefault(); sendToAi(); }}
                                className="flex border border-zinc-300 rounded-2xl p-4 h-fit"
                            >
                                <input
                                    ref={aiInput}
                                    className="w-full outline-0"
                                    placeholder="Enter a Topic"
                                    style={{ resize: "none" }}
                                />
                                <FontAwesomeIcon
                                    icon={faArrowRightToBracket}
                                    onClick={() => sendToAi()}
                                    className="text-2xl cursor-pointer z-5 mt-1"
                                />
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* pdf viewer */}
            {pdfViewerSec && (
                <div className="h-screen w-screen">
                    <PdfViewer data={document} />
                </div>
            )}

            {/* xlsx viewer */}
            {Xlsxviewer && (
                <div className="h-screen w-screen">
                    <XLSXVIEW data={xlsxdata} />
                </div>
            )}

            {/* extra func side bar */}
            <div>
                <WriteUp genData={dataTogen} close={closeAiGen} editAIdoc={AiEditDoc} />
            </div>

            {/* The text editor */}
            {editorSec && (
                <div>
                    <Reportspage data={{ close: () => { setEditorSec(false); }, init: editorInit }} />
                </div>
            )}
            <Link id="links" href='./reports'></Link>
        </div>
    );
};
