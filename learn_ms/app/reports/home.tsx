"use client"
import Image from "next/image";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRightToBracket,faPlus,faSearch,faStickyNote } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {SubcribeToStore} from "../useSyncstore";


import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';
import Reportspage from "./reports";

// tools to convert to slate
import { unified } from "unified";
import stringify from "remark-stringify";
import markdown from "remark-parse";
import { slateToRemark,remarkToSlate } from "remark-slate-transformer";
import Link from "next/link";

interface PdfViewerProps {
  pdfUrl: string | null;
  selectedFile: File | undefined;
  close:()=>void;
  fileexplore:()=>void;
  openEditor:(data:string)=>void
}


const WriteUp  = dynamic(
  () => import('./aiWriteup'),
  { ssr: false }
)

const PdfViewer = dynamic(
  () => import('../../app/reports/pdf-viewer'),
  { ssr: false }
)


const AImodels=[
    "qwen3.5:397b-cloud",
    "qwen3.5:cloud",
    "qwen2.5-coder:latest",
    "qwen2.5-coder:1.5b",
    "qwen3.5:0.8b",
    "gemma-4-31b-it"
]

const URL_SOC = 'http://127.0.0.1:5000';

export const Home =()=>{
    const [socket] = useState(() => io(URL_SOC, { autoConnect: true }));
    const [pdfViewerSec, setPdfViewerSec] = useState<boolean>(false);
    const [editorSec, setEditorSec] = useState<boolean>(false);
    const [currModel,setCurrModel] = useState<string>("qwen3.5:397b-cloud");
    const [dataTogen, setDataTogen] = useState<{type:string, query:string,
        file:string|null, aidoc:string}>({type:"",query:"", file:null, aidoc:""});
    const aiInput = useRef<HTMLInputElement>(null)

    
    const [document, SetDocument]=useState<PdfViewerProps>({
        pdfUrl:null,
        selectedFile:undefined,
        close:()=>{},
        fileexplore:()=>{},
        openEditor:(data:string)=>{}
    });

    const [addfile, setAddFile]=useState<{type:string,name:string,URL:string,file:File}[]>([]);
    // initial value[array of slate objects] passed to slate componet
    const [editorInit, setEditoeInit] = useState<string>("");
    let OpSt = 0;
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, 
          SubcribeToStore.getSnapshot, SubcribeToStore.getSnapshot);

    useEffect(() => {
        (window.document.getElementById("links") as HTMLElement).click()
        if(subscribe[0][0]["owner"]===false){
            setEditorSec(true)
        }
        if (subscribe.length === 0) return;
        function onConnect() {
            socket.emit("join-grp",{"chatid":subscribe[0][0].chatid})
        }

        function disConnect(){
            console.log("disconnected-fastapi");
        }

        function GenerateDoc(data:any){
            console.log(data)
            try{
                if(data["data"][0]["type"]){   
                    console.log("nothing")       
                }else{
                    console.log("actual",data["data"])
                    setDataTogen(prev=>({...prev, aidoc:prev.aidoc + data["data"]}))
                }
            }catch(err){
                console.log("error")
            }
        }


        socket.on('connect', onConnect);
        socket.on('disconnect', disConnect);
        socket.on('recvaidoc', GenerateDoc);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', disConnect);
            socket.off('recvaidoc', GenerateDoc);
            // socket.off('youjsutjoined', onYouJustJoined);
            // socket.off('recieve_editted', onReceiveEdited);
        };

    },[])

    const setMode = (model:number)=>{
        const modelDiv = window.document.getElementById("modelsCon") as HTMLElement; 
        if(OpSt === 0){
            modelDiv.style.display= "block";
            OpSt=1;
        }else{
            modelDiv.style.display="none"
            OpSt=0;
        }   
    }

    const sendToAi = (data:{type:string,query:string,file:null,aidoc:string})=>{
        const data_send = {
            type:currModel,
            query:aiInput.current?.value,
            chatid: subscribe[0][0].chatid
        }
        setDataTogen(data)
        socket.emit("gen-ai-doc",data_send)
    }

    const closeAiGen = ()=>{
        setDataTogen({type:"",query:"",file:null,aidoc:""})
    }

    const openSearchFiles=()=>{
        const formSearchFiles = window.document.getElementById("formSearchFiles") as HTMLElement;
        formSearchFiles.style.transition="1s ease"
        formSearchFiles.style.width="fit-content"
    }

    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        let exist = false
        if (selectedFile) {
            addfile.forEach((file)=>{
                if(file.name == selectedFile?.name && file.type == selectedFile?.type){
                    alert("this file already exist");
                    return exist = true
                }
            })
            if(exist)return;
            const close= ()=>{setPdfViewerSec(false);}
            const sendToAIEx= ()=>{setDataTogen({type:"AiFilEx",query:"",file:URL.createObjectURL(selectedFile), aidoc:""});}
            SetDocument({pdfUrl:URL.createObjectURL(selectedFile), selectedFile:selectedFile,close,fileexplore:sendToAIEx,openEditor:ConvertCurrDocToSlate});
            const newfile= {
                type: selectedFile.type,
                name: selectedFile.name,
                URL:  URL.createObjectURL(selectedFile),
                file: selectedFile
            }
            setAddFile(prev=>[...prev,newfile])
        }
    };

    const OpenPdfEditor = (pdfUrl:string,selectedFile:File) =>{
        const close = ()=>{setPdfViewerSec(false)}
        const sendToAIEx= ()=>{setDataTogen({type:"AiFilEx",query:"",file:URL.createObjectURL(selectedFile),aidoc:""});}
        SetDocument({pdfUrl:pdfUrl,selectedFile:selectedFile,close,fileexplore:sendToAIEx,openEditor:ConvertCurrDocToSlate})
        setPdfViewerSec(true)
    }

    const ConvertCurrDocToSlate = (data:string)=>{
        console.log("clicked")
        setEditorSec(true)
        setEditoeInit(data)
    }

    const AiEditDoc = ()=>{
        setEditorSec(true)
        const processor = unified().use(markdown).use(remarkToSlate);
        if(dataTogen.aidoc.length > 4){
            const value = processor.processSync(dataTogen.aidoc).result;
            setEditoeInit(JSON.stringify(value))
        }   
    }

    return(
        <div className="w-full h-full overflow-hidden">
            <header className="border border-zinc-200 p-3 top-0 absolute w-full shadow-sm">
                <div className="flex -mt-3">
                    <FontAwesomeIcon onClick={(()=>{openSearchFiles()})} icon={faSearch} className="mt-2" />
                    <form id="formSearchFiles" action="" className="ml-2 w-0 overflow-hidden">
                        <input type="text" className="border mt-1 rounded-2xl outline-0 pl-2" />
                    </form>
                    <label>
                        <FontAwesomeIcon aria-label="gain insight on document" icon = {faPlus} className="mt-2 ml-3 font-extrabold" />
                        <input
                            type="file"
                            accept=".pdf,.docx,.xlsx,.xls"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>                      
                </div>
            </header>
            <div className="flex p-4">
                <div className="w-50 border-r border-zinc-200 h-screen -mt-3.5 p-1">
                    {/* add Files Selected */}
                    {addfile.map((file,i)=>{ 
                        return  <div onClick={()=>OpenPdfEditor(file.URL,file.file)} key={i} className="text-sm flex gap-0.5 mb-2 cursor-pointer">
                                    <Image className="w-4 h-4"
                                        src={`/${file.name.slice(file.name.length-5,).includes(".docx") ? "logo2.png" : `${file.name.slice(file.name.length-5,).includes(".pdf") ? "pdf.png" : "logo1.png"}`  }`}
                                        alt=""
                                        height={2}
                                        width={2}
                                    >
                                    </Image>
                                    <p title={file.name} className="w-30 text-wrap">{file.name.slice(0,13)}...</p>
                                </div>
                        }
                    )}      
                </div>

                <div className="w-full">
                    <div className="flex justify-center w-full mt-40">
                        <Image 
                            src={"/codegen.png"}
                            alt=""
                            width={150}
                            height={150}
                            loading="eager"
                        >
                        </Image>
                        <h1 className="font-semibold tracking-[0.5em] mt-9 -ml-7">
                            DOCUMENT GENERATOR
                        </h1>
                    </div>
                    
                    <div className="flex justify-center w-full -mt-5">
                        <div>
                            <div className="flex justify-center gap-5">
                                <Image className="opacity-[0.5]"
                                    src={"/logo1.png"}
                                    alt=""
                                    width={40}
                                    height={40}>
                                </Image>
                                <Image className="opacity-[0.5]"
                                    src={"/logo2.png"}
                                    alt=""
                                    width={40}
                                    height={40}>
                                </Image>
                                <Image className="opacity-[0.5]"
                                    src={"/pdf.png"}
                                    alt=""
                                    width={40}
                                    height={40}>
                                </Image>
                            </div>
                            <div className="mt-2">
                                <p className="text-sm text-zinc-500"> Finance Statment | Code | Stories | letters </p>
                            </div>
                        </div>
                    </div>
                    <div className="w-full flex justify-center mt-10">
                        <div className="w-150 h-fit">
                            <div id="modelsCon" className="absolute -mt-39 z-10 border bg-white rounded-[10px] overflow-hidden hidden">
                                {AImodels.map((models,i)=>
                                    {
                                        if(models == currModel){
                                           return  <p onClick={(e)=>{setMode(1); setCurrModel(models);}} key={i} className="m-2 cursor-pointer text-sm font-extrabold"> {models} </p>
                                        } else{
                                            return  <p onClick={(e)=>{setMode(1); setCurrModel(models);}} key={i} className="m-2 cursor-pointer text-sm"> {models} </p>
                                        }  
                                    }
                                )}
                            </div>
                            <p onClick={(e)=>{setMode(OpSt)}} className="text-sm cursor-pointer border-zinc-200 mb-1 pl-3 pr-3 border w-fit rounded-[0.5em] mt-1"> 
                                <FontAwesomeIcon className="mr-1 text-zinc-700" icon={faStickyNote}></FontAwesomeIcon>  
                                {currModel}
                            </p>
                            
                            <form className="flex border border-zinc-300 rounded-2xl p-4 h-fit" action="">
                                <input ref={aiInput} className="w-full outline-0" id="" placeholder="Enter a Topic" style={{ resize: "none"}} />
                                <FontAwesomeIcon icon={faArrowRightToBracket} onClick={()=>{sendToAi({type:"AiDocGen",query:"query",file:null,aidoc:""}); aiInput.current?aiInput.current.value="":""}} className="text-2xl cursor-pointer z-5 mt-1">
                                </FontAwesomeIcon>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* pdf viewer */}
            {pdfViewerSec && 
                <div className="h-screen w-screen">
                   <PdfViewer data={document} />
                </div>
            }
            
            {/* extra func side bar */}
            <div>
                <WriteUp genData={dataTogen} close={closeAiGen} editAIdoc={AiEditDoc} />
            </div>

            {/* The text editor */}
            {editorSec && <div>
                            <Reportspage data={{close:()=>{setEditorSec(false)}, init:editorInit}} />
                        </div>
            }
          <Link id="links" href='./reports'></Link>
        </div>
      
    )
}