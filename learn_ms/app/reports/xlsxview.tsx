"use client"
import { faArrowLeft, faArrowRightToBracket, faDownload, faFloppyDisk, faMessage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { InstantMet } from "../charts/instantmat"
import { LineChartFunc } from "../charts/linechart"
import { AreaChartExample } from "../charts/simpleArea"
import { StackedBarChart } from "../charts/stackedbar"
import { ScatterChartExample } from "../charts/scatterplot"
import { TwoLevelPieChart } from "../charts/piechart"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm';

import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';
import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { HyperFormula } from "hyperformula";

registerAllModules();

const API_URL_5000 = process.env.NEXT_PUBLIC_API_URL_5000 || 'http://127.0.0.1:5000';

interface datagotten {
    data: {
        file: File | undefined,
        close: () => void
        savefile: (filedata: File) => void
    }
}

interface aiChat {
    role: string
    data: any
    text: string
    chart_type: string
}

interface graph_type {
    charts: { data: { name: string, matric: {}[] }[], type: string }[],
    instant_charts: {}[]
}

interface Data_Charts {
    id: number
    graph_data: graph_type
}

interface TabItem {
    name: string
    no: number
    dashboard: boolean
}

function normalizeSheetData(rawRows: unknown[][]): any[][] {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return [[]];

    const validRows = rawRows.filter((row) => Array.isArray(row));
    if (validRows.length === 0) return [[]];

    const maxCols = Math.max(1, ...validRows.map((row) => row.length));

    return validRows.map((row) =>
        Array.from({ length: maxCols }, (_, i) =>
            row[i] !== undefined && row[i] !== null ? row[i] : ""
        )
    );
}

function extractTableData(raw: any): any[][] | null {
    let target = raw;
    if (typeof target === "string") {
        try {
            target = JSON.parse(target);
        } catch {
            return null;
        }
    }

    if (target && typeof target === "object" && !Array.isArray(target)) {
        if (Array.isArray(target.table)) target = target.table;
        else if (Array.isArray(target.rows)) target = target.rows;
        else if (Array.isArray(target.data)) target = target.data;
    }

    if (!Array.isArray(target) || target.length === 0) return null;

    if (Array.isArray(target[0])) {
        return normalizeSheetData(target);
    }

    if (typeof target[0] === "object" && target[0] !== null) {
        const headers = Array.from(new Set(target.flatMap((row: any) => Object.keys(row))));
        const rows = target.map((row: any) => headers.map((key) => row[key] ?? ""));
        return normalizeSheetData([headers, ...rows]);
    }

    return null;
}

function extractDashboardData(raw: any): graph_type | null {
    let target = raw;
    if (typeof target === "string") {
        try {
            target = JSON.parse(target);
        } catch {
            return null;
        }
    }

    if (target && typeof target === "object" && !Array.isArray(target)) {
        if (Array.isArray(target.charts) || Array.isArray(target.instant_charts)) {
            return {
                charts: Array.isArray(target.charts) ? target.charts : [],
                instant_charts: Array.isArray(target.instant_charts) ? target.instant_charts : [],
            };
        }
    }
    return null;
}

export function XLSXVIEW(datasheet: datagotten) {
    const [dataHot, setDataHot] = useState<any[][]>([[]]);
    const [paginate, setPaginate] = useState<TabItem[]>([]);
    const [chatSec, setChatSec] = useState<boolean>(false);
    const [chatMsg, setChatMsg] = useState<aiChat[]>([]);
    const chatInput = useRef<HTMLInputElement>(null);
    const [dashboardView, setDashboardView] = useState<boolean>(false);
    const [activeDashboardId, setActiveDashboardId] = useState<number | null>(null);
    const [currentSheetNo, setCurrentSheetNo] = useState<number>(0);
    const [graphsData, setGraphData] = useState<Data_Charts[]>([]);
    const [currentGraph, setCurrentGraph] = useState<graph_type>();
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

    const hotRef = useRef<HotTableRef>(null);
    const isDirtyRef = useRef<boolean>(false);
    const isInternalSaveRef = useRef<boolean>(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const saveFileSafely = (updatedFile: File) => {
        isInternalSaveRef.current = true;
        datasheet.data.savefile(updatedFile);
    };

    const getLiveGridData = (): any[][] => {
        const instance = hotRef.current?.hotInstance;
        if (instance && !instance.isDestroyed) {
            return normalizeSheetData(instance.getData() as unknown[][]);
        }
        return dataHot;
    };

    const persistCurrentSheet = async (sheetIndex: number = currentSheetNo): Promise<File | undefined> => {
        const existingSheet = datasheet.data.file;
        if (!existingSheet) return undefined;

        const gridData = getLiveGridData();
        const buffer = await existingSheet.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });

        const targetSheetName = workbook.SheetNames[sheetIndex];
        if (!targetSheetName) return existingSheet;

        workbook.Sheets[targetSheetName] = XLSX.utils.aoa_to_sheet(gridData);

        const updatedBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const updatedFile = new File([updatedBuffer], existingSheet.name, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            lastModified: Date.now(),
        });

        isDirtyRef.current = false;
        setHasUnsavedChanges(false);
        setDataHot(gridData);
        saveFileSafely(updatedFile);
        return updatedFile;
    };

    const handleDownloadXlsx = async () => {
        let fileToDownload = datasheet.data.file;
        if (!fileToDownload) return;

        if (isDirtyRef.current) {
            const savedFile = await persistCurrentSheet(currentSheetNo);
            if (savedFile) {
                fileToDownload = savedFile;
            }
        }

        const url = URL.createObjectURL(fileToDownload);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileToDownload.name.endsWith('.xlsx')
            ? fileToDownload.name
            : `${fileToDownload.name}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const fileToArray = async (sheetNum: number, initial: string = "yes", sourceFile?: File) => {
        const dataargument = sourceFile ?? datasheet.data.file;
        if (dataargument != undefined) {
            const filedata = await dataargument.arrayBuffer();
            const workbook = XLSX.read(filedata, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
            const sheetName = workbook.SheetNames[sheetNum];
            const worksheet = workbook.Sheets[sheetName];

            if (!worksheet) return;

            if (initial === "yes") {
                const sheetCon: TabItem[] = [];
                workbook.SheetNames.forEach((sheets, index) => {
                    const ws = workbook.Sheets[sheets];
                    const dataSheet: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

                    if (dataSheet.length > 0) {
                        sheetCon.push({ name: sheets, no: index, dashboard: false });
                    }
                });
                setPaginate(prev => {
                    const existingDashboards = prev.filter(item => item.dashboard);
                    return [...sheetCon, ...existingDashboards];
                });
            }

            const rawSheet = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, defval: "" });
            isDirtyRef.current = false;
            setHasUnsavedChanges(false);
            setDataHot(normalizeSheetData(rawSheet));
            setCurrentSheetNo(sheetNum);
            setDashboardView(false);
            setActiveDashboardId(null);
        }
    };

    useEffect(() => {
        if (isInternalSaveRef.current) {
            isInternalSaveRef.current = false;
            return;
        }
        fileToArray(currentSheetNo);
    }, [datasheet.data.file]);

    const handleSwitchTab = async (obj: TabItem) => {
        let latestFile = datasheet.data.file;
        if (isDirtyRef.current && !dashboardView) {
            latestFile = await persistCurrentSheet(currentSheetNo);
        }
        if (obj.dashboard) {
            SetCurrentGraph(obj.no);
        } else {
            await fileToArray(obj.no, "NO", latestFile);
        }
    };

    const handleClose = async () => {
        if (isDirtyRef.current) {
            await persistCurrentSheet(currentSheetNo);
        }
        datasheet.data.close();
    };

    const handleAfterChange = (_changes: any, source?: string) => {
        if (source === 'loadData' || source === 'ObserveChanges.change') return;
        isDirtyRef.current = true;
        setHasUnsavedChanges(true);
    };

    const handleAfterCreate = (_index: number, _amount: number, source?: string) => {
        if (source === 'loadData') return;
        isDirtyRef.current = true;
        setHasUnsavedChanges(true);
    };

    const handleAfterRemove = (
        _index: number,
        _amount: number,
        _physicalItems: number[],
        source?: string
    ) => {
        if (source === 'loadData') return;
        isDirtyRef.current = true;
        setHasUnsavedChanges(true);
    };

    const SendToAi = async () => {
        if (!chatInput.current?.value || String(chatInput.current?.value).trim().length <= 0) return;
        const loads = window.document.getElementById("loads") as HTMLElement;
        if (loads) loads.style.display = "block";

        const chatSinput = chatInput.current.value;

        setChatMsg(prev => [...prev, {
            role: "user",
            data: [],
            text: chatSinput,
            chart_type: "text_table"
        }]);

        if (chatInput.current) {
            chatInput.current.value = "";
        }

        try {
            const liveData = getLiveGridData();
            const req = await fetch(`${API_URL_5000}/rest/excel_chat`, {
                method: "POST",
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ data: liveData, prompt: chatSinput })
            });

            const response = await req.json();
            const rawData = response?.["formatted_data"] ?? response?.["data"] ?? response;

            const dashboardPayload = extractDashboardData(rawData);
            const tablePayload = !dashboardPayload ? extractTableData(rawData) : null;

            setChatMsg(prev => [...prev, {
                role: "assistant",
                data: dashboardPayload ?? tablePayload ?? rawData,
                text: response?.["explain_decision"] ?? "",
                chart_type: dashboardPayload ? "dashboard" : "text_table"
            }]);
              console.log( response)
        } catch (err) {
            console.error("SendToAi error:", err);
        } finally {
            if (loads) loads.style.display = "none";
        }
      
    };

    const AppendToSheet = async (SheetData: any) => {
        let existingSheet = datasheet.data.file;
        if (!existingSheet) return;

        if (isDirtyRef.current && !dashboardView) {
            const saved = await persistCurrentSheet(currentSheetNo);
            if (saved) existingSheet = saved;
        }

        const tableRows = extractTableData(SheetData) ?? normalizeSheetData(SheetData);
        const data = await existingSheet.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });

        let sheetCounter = workbook.SheetNames.length + 1;
        let newSheetName = `sheet${sheetCounter}`;
        while (workbook.SheetNames.includes(newSheetName)) {
            sheetCounter++;
            newSheetName = `sheet${sheetCounter}`;
        }

        const newSheetIndex = workbook.SheetNames.length;
        const newWorksheet = XLSX.utils.aoa_to_sheet(tableRows);
        XLSX.utils.book_append_sheet(workbook, newWorksheet, newSheetName);

        const updatedBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const updatedFile = new File([updatedBuffer], existingSheet.name, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            lastModified: Date.now(),
        });

        saveFileSafely(updatedFile);
        setPaginate(prev => [...prev, { name: newSheetName, no: newSheetIndex, dashboard: false }]);
        setDataHot(tableRows);
        setCurrentSheetNo(newSheetIndex);
        setDashboardView(false);
        setActiveDashboardId(null);
    };

    const InsertToSheet = async (SheetData: any, no: number) => {
        const existingSheet = datasheet.data.file;
        if (!existingSheet) return;

        const tableRows = extractTableData(SheetData) ?? normalizeSheetData(SheetData);
        const data = await existingSheet.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });

        const targetSheetName = workbook.SheetNames[no];
        if (!targetSheetName) return;

        workbook.Sheets[targetSheetName] = XLSX.utils.aoa_to_sheet(tableRows);

        const updatedBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const updatedFile = new File([updatedBuffer], existingSheet.name, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            lastModified: Date.now(),
        });

        isDirtyRef.current = false;
        setHasUnsavedChanges(false);
        setDataHot(tableRows);
        saveFileSafely(updatedFile);
        setDashboardView(false);
        setActiveDashboardId(null);
    };

    const AppendCharts = async (data_recv: any) => {
        if (!datasheet.data.file) return;

        if (isDirtyRef.current && !dashboardView) {
            await persistCurrentSheet(currentSheetNo);
        }

        const safeGraphData: graph_type = extractDashboardData(data_recv) ?? {
            charts: Array.isArray(data_recv?.charts) ? data_recv.charts : [],
            instant_charts: Array.isArray(data_recv?.instant_charts) ? data_recv.instant_charts : [],
        };

        const dashboardId = Date.now();
        const dashboardCount = paginate.filter(p => p.dashboard).length + 1;

        setGraphData(prev => [...prev, { id: dashboardId, graph_data: safeGraphData }]);
        setPaginate(prev => [...prev, { name: `dashboard${dashboardCount}`, no: dashboardId, dashboard: true }]);
        setCurrentGraph(safeGraphData);
        setActiveDashboardId(dashboardId);
        setDashboardView(true);
    };

    const SetCurrentGraph = (id: number) => {
        const currGraphdata_set = graphsData.find((graph) => graph.id === id);
        if (currGraphdata_set) {
            setCurrentGraph(currGraphdata_set.graph_data);
            setActiveDashboardId(id);
            setDashboardView(true);
        }
    };

    return (
        <div className="absolute top-0 left-0 h-full w-full bg-gray-100 border border-zinc-300 z-10 flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="bg-white w-full h-11 p-2 flex justify-end items-center gap-3 pr-6 border-b border-zinc-200 shrink-0 z-20">
                <button
                    type="button"
                    onClick={() => persistCurrentSheet(currentSheetNo)}
                    disabled={!hasUnsavedChanges}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                        hasUnsavedChanges
                            ? 'bg-green-600 text-white border-green-700 cursor-pointer'
                            : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-default'
                    }`}
                >
                    <FontAwesomeIcon icon={faFloppyDisk} />
                    <span>{hasUnsavedChanges ? 'Save edits' : 'Saved'}</span>
                </button>
                <button
                    type="button"
                    onClick={handleDownloadXlsx}
                    disabled={!datasheet.data.file}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 cursor-pointer"
                    title="Download updated Excel file"
                >
                    <FontAwesomeIcon icon={faDownload} />
                    <span>Download .xlsx</span>
                </button>
                <FontAwesomeIcon onClick={handleClose} icon={faArrowLeft} className="cursor-pointer" />
                <FontAwesomeIcon onClick={() => { setChatSec(prev => !prev) }} icon={faMessage} className="cursor-pointer" />
            </div>

            {/* Main Content Area: Dashboard View OR Spreadsheet Grid */}
            <div className="flex-1 z-25 w-full overflow-y-auto relative">
                {dashboardView ? (
                    <div className="w-full min-h-full p-6 bg-white flex flex-col gap-5">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon
                                    onClick={() => {
                                        setDashboardView(false);
                                        setActiveDashboardId(null);
                                    }}
                                    icon={faArrowLeft}
                                    className="cursor-pointer"
                                />
                                <span className="font-semibold text-sm">Dashboard View</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full">
                            <InstantMet data={currentGraph?.instant_charts ?? []} />
                        </div>
                        <div className="flex flex-wrap w-full gap-4">
                            {(Array.isArray(currentGraph?.charts) ? currentGraph.charts : []).map((graphs, gIndex) => {
                                if (graphs?.type == "Line Chart") {
                                    return <LineChartFunc key={gIndex} data_gotten={graphs.data} />
                                }
                                if (graphs?.type == "Area Chart") {
                                    return <AreaChartExample key={gIndex} data_gotten={graphs.data} />
                                }
                                if (graphs?.type == "Bar Chart") {
                                    return <StackedBarChart key={gIndex} data_gotten={graphs.data} />
                                }
                                if (graphs?.type == "Scatter Plot") {
                                    return <ScatterChartExample key={gIndex} data_gotten={graphs.data} />
                                }
                                if (graphs?.type == "Pie Chart") {
                                    return <TwoLevelPieChart key={gIndex} data_gotten={graphs.data} />
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ) : (
                    isMounted && dataHot.length > 0 && dataHot[0].length > 0 && (
                        <HotTable
                            ref={hotRef}
                            themeName="ht-theme-main"
                            key={`sheet-${currentSheetNo}`}
                            data={dataHot}
                            height="100%"
                            contextMenu={true}
                            colHeaders={true}
                            hiddenColumns={{
                                indicators: true,
                            }}
                            multiColumnSorting={true}
                            filters={true}
                            rowHeaders={true}
                            headerClassName="htLeft"
                            manualRowMove={true}
                            autoWrapRow={true}
                            autoWrapCol={true}
                            autoRowSize={false}
                            manualRowResize={true}
                            manualColumnResize={true}
                            navigableHeaders={true}
                            imeFastEdit={true}
                            allowInsertColumn={true}
                            allowRemoveColumn={true}
                            allowInsertRow={true}
                            allowRemoveRow={true}
                            dropdownMenu={true}
                            exportFile={{ engines: { xlsx: ExcelJS } }}
                            fillHandle={true}
                            fixedRowsTop={dataHot.length > 1 ? 1 : 0}
                            formulas={{ engine: HyperFormula }}
                            mergeCells={true}
                            afterChange={handleAfterChange}
                            afterCreateRow={handleAfterCreate}
                            afterRemoveRow={handleAfterRemove}
                            afterCreateCol={handleAfterCreate}
                            afterRemoveCol={handleAfterRemove}
                            licenseKey="non-commercial-and-evaluation"
                        />
                    )
                )}
            </div>

            {/* Pinned Bottom Paginated Tab Bar */}
            {paginate.length > 0 && (
                <div className="w-full bg-white border-t border-zinc-300 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 z-25">
                    {paginate.map(obj => {
                        const isActive = obj.dashboard
                            ? dashboardView && activeDashboardId === obj.no
                            : !dashboardView && currentSheetNo === obj.no;

                        return (
                            <button
                                type="button"
                                key={`${obj.dashboard ? 'dash' : 'sheet'}-${obj.no}`}
                                onClick={() => handleSwitchTab(obj)}
                                className={`cursor-pointer border border-zinc-800 rounded-xs text-xs px-2.5 py-1 whitespace-nowrap ${
                                    isActive ? 'bg-green-300 font-semibold' : 'bg-zinc-50 hover:bg-zinc-200'
                                }`}
                            >
                                {obj.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Chat Section Drawer */}
            {chatSec &&
                <div className="absolute w-[50%] p-3 top-0 right-0 h-full bg-white z-30 border-l border-zinc-300 shadow-lg flex flex-col">
                    <div className="p-2 border-b border-zinc-200 flex items-center justify-between shrink-0">
                        <FontAwesomeIcon onClick={() => { setChatSec(false) }} icon={faArrowLeft} className="cursor-pointer" />
                        <span className="text-xs font-medium text-zinc-500">AI Assistant</span>
                    </div>
                    <div className="flex-1 px-4 py-2 overflow-y-auto">
                        {chatMsg.length > 0 &&
                            chatMsg.map((currentChat, index) => {
                                if (currentChat.role !== "user") {
                                    const isDashboard =
                                        currentChat.text === "dashboard" ||
                                        currentChat.chart_type === "dashboard" ||
                                        Boolean(extractDashboardData(currentChat.data));

                                    if (isDashboard) {
                                        const dashData = extractDashboardData(currentChat.data);
                                        const dashboardCharts = dashData?.charts ?? [];
                                        const instantCharts = dashData?.instant_charts ?? [];
                                        return (
                                            <div key={index} className="mb-3 border border-zinc-200 rounded p-2">
                                                <div className="flex flex-wrap">
                                                    <InstantMet data={instantCharts} />
                                                </div>
                                                <div className="flex flex-wrap">
                                                    {dashboardCharts.map((graphs: any, graphIndex: number) => {
                                                        if (graphs?.type == "Line Chart") {
                                                            return <LineChartFunc key={graphIndex} data_gotten={graphs.data} />
                                                        }
                                                        if (graphs?.type == "Area Chart") {
                                                            return <AreaChartExample key={graphIndex} data_gotten={graphs.data} />
                                                        }
                                                        if (graphs?.type == "Bar Chart") {
                                                            return <StackedBarChart key={graphIndex} data_gotten={graphs.data} />
                                                        }
                                                        if (graphs?.type == "Scatter Plot") {
                                                            return <ScatterChartExample key={graphIndex} data_gotten={graphs.data} />
                                                        }
                                                        if (graphs?.type == "Pie Chart") {
                                                            return <TwoLevelPieChart key={graphIndex} data_gotten={graphs.data} />
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                                <div className="mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { AppendCharts(currentChat.data) }}
                                                        className="border px-2 py-1 rounded-sm bg-zinc-100 hover:bg-green-200 cursor-pointer text-xs font-medium"
                                                    >
                                                        append
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    } else {
                                        const tableRows = extractTableData(currentChat.data);
                                        return (
                                            <div key={index} className="bg-zinc-100 p-2 mb-3 rounded">
                                                <div>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentChat.text}</ReactMarkdown>
                                                </div>
                                                {tableRows && tableRows.length > 0 && (
                                                    <div className="mt-2">
                                                        <HotTable
                                                            themeName="ht-theme-main"
                                                            data={tableRows}
                                                            height="auto"
                                                            licenseKey="non-commercial-and-evaluation"
                                                            fillHandle={false}
                                                            readOnly={true}
                                                        />
                                                    </div>
                                                )}
                                                {tableRows && tableRows.length > 0 && (
                                                    <div className="mt-2 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => { InsertToSheet(tableRows, currentSheetNo) }}
                                                            className="border px-2 py-1 rounded-sm bg-white hover:bg-zinc-200 cursor-pointer text-xs font-medium"
                                                        >
                                                            replace
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { AppendToSheet(tableRows) }}
                                                            className="border px-2 py-1 rounded-sm bg-white hover:bg-green-200 cursor-pointer text-xs font-medium"
                                                        >
                                                            append
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                } else {
                                    return (
                                        <div key={index} className="border p-2 rounded-md mt-3 mb-3 bg-zinc-50">
                                            <p>{currentChat.text}</p>
                                        </div>
                                    )
                                }
                            })
                        }
                        <div id="loads" style={{ display: "none" }} className="loader p-2"></div>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); SendToAi() }} className="w-full flex border border-zinc-300 rounded-2xl p-3 shrink-0 bg-white">
                        <input ref={chatInput} className="w-full outline-0 text-sm" placeholder="explore excel document" />
                        <FontAwesomeIcon onClick={() => { SendToAi() }} icon={faArrowRightToBracket} className="text-xl cursor-pointer mt-0.5" />
                    </form>
                </div>
            }
        </div>
    )
}