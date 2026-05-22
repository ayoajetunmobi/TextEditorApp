"use client";
import { faArrowLeft, faBookOpen, faBookOpenReader, faCheck, faCommentDots, faCommentNodes, faComments, faCommentSms, faEdit, faMapMarked, faMarker, faMessage, faRobot, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState, useCallback, useRef, useEffect, ReactNode} from "react";
import { Document, Page, pdfjs} from "react-pdf";
import * as pdfjsLib from 'pdfjs-dist';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import ReactMarkdown from 'react-markdown'

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'


// tools to convert to slate
import { unified } from "unified";
import stringify from "remark-stringify";
import markdown from "remark-parse";
import { slateToRemark,remarkToSlate } from "remark-slate-transformer";

//`https://cdnjs.cloudflare.com/ajax/libs/${pdfjs.version}/pdf.worker.min.js`
//  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Comment {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  color: string;
  class:string;
}

const color = [ "#ffc0cb","#ffa500","#008000","#ee82ee","#8a2be2","#7fffd4","#ffebcd","#0a0a0a" ]

interface searchCord{
  str:string,
  page:number,
  cordinates:{x:number,y:number,width:number,height:number}
}

interface PdfViewerProps {
  data:{
    pdfUrl: string | null;
    selectedFile: File | undefined;
    close:()=> void;
    fileexplore:()=>void;
    openEditor:(data:string)=>void
  }
  // onFileSelect?: (file: File) => void;
  // username?: string;
}

interface highlitedForComments{page: number,
    x: number,
    y: number; 
    width: number,
    height: number; 
    id: string,
    text:string,
    class:string
}
interface keywords_inf {content:string,explanation:string,pageno:number,points:{x:number,y:number,width:number,height:number}}

export default function PdfViewer( data:PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [similarSrch, setSimilarSrch] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currSelection, setCurrSelection] = useState<highlitedForComments[]>([]);
  const [searchResult, setSearchResult] = useState<searchCord[]>([]);
  const [isAddingComment, setIsAddingComment] = useState<boolean>(false);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentKey, setDocumentKey] = useState<string>("");
  const gotoInput = useRef<HTMLInputElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null)
  const [highlights, setHighlights] = useState<highlitedForComments[]>([]);
  const [tableCon, SetTableCon] = useState<{title:string,pageno:number}[]>([]);
  const [keywords, SetKeywords]= useState<keywords_inf[]>([]);
  const [airesult, SetAiresult] = useState<string>("");
  const [keyset, setKeyset] = useState<boolean>(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      Explain_Keyword()
  }, []);


  const AddSearchHighlight= (matched:searchCord[])=>{
    matched.forEach(item=>{
      const docParent = window.document.getElementById(`index-${item.page}`) as HTMLElement;
      const p= window.document.createElement("p");
      p.style.position = "absolute";
      p.style.top = `${((item.cordinates.y - item.cordinates.height) * scale)+3}px`;
      p.style.left = `${item.cordinates.x * scale}px`;
      p.style.width = `${item.cordinates.width * scale}px`;
      p.style.height = `${item.cordinates.height * scale}px`;
      p.style.backgroundColor="yellow";
      p.style.zIndex="5";
      p.style.opacity="0.4";
      p.classList.add("highlighted");
      docParent.appendChild(p);
    })
  }

  const AddKeywords= (matched:keywords_inf[])=>{
    matched.forEach(item=>{
      const docParent = window.document.getElementById(`index-${item.pageno}`) as HTMLElement;
      const p= window.document.createElement("p");
      p.style.position = "absolute";
      p.style.top = `${((item.points.y - item.points.height) * scale)+3}px`;
      p.style.left = `${item.points.x * scale}px`;
      p.style.width = `${item.points.width * scale}px`;
      p.style.height = `${item.points.height * scale}px`;
      p.style.borderBottom="1.5px solid blue"
      p.style.zIndex="5";
      p.style.opacity="0.4";
      p.onclick=(()=>{getAiDiv(item)});
      docParent.appendChild(p);
    })
  }

  if(keyset && keywords.length>1){
    console.log("set")
    AddKeywords(keywords)
    setKeyset(false)
  }

  const CreateHighlight = useCallback(() => {  
    const selection = window.getSelection();                                                                   
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {                                  
      return;                                                                                                  
    }

    const class_ = `class-${Math.random()}`
    const range = selection.getRangeAt(0);
    
    // const rects = range.getClientRects();          for single line
    const rects = range.getBoundingClientRect();      // for multiple lines                                                                    

    // empty selection return null
    if (rects.width === 0) return;
    const newHighlights: Array<{page: number; class:string; x: number; y: number; width: number; height: number; id: string,text:string}> = [];                                                                                                  
                                                                                                              
    // for (let i = 0; i < rects.length; i++) {                                                                   
    //   const rect = rects[i]; // for single line

      // Find which page this rect belongs to                                                                  
      let pageNum = 0;                                                                                         
      let pageContainer: HTMLElement | null = null;                                                            
                                                                                                                
      // Walk up from the rect's common ancestor to find the page container                                    
      const commonAncestor = range.commonAncestorContainer as HTMLElement;                                     
      let current: HTMLElement | null = commonAncestor;                                                        
                                                                                                                
      while (current && current !== document.body) {                                                             
        const pageMatch = current.id?.match(/^index-\d+$/);
        if (pageMatch) {                                                                                        
          pageNum = parseInt(pageMatch[0].toString().slice(6,));                                                                    
          pageContainer = current;                                                                         
          break;                                                                                               
        }                                                                                                      
        current = current.parentElement;                                                 
      }                                                                                                        
                                                                                                                
      // if (!pageContainer || pageNum === 0) continue;                                                           
                                                                                                                
      // Get page container position                                                                           
      const pageRect = pageContainer? pageContainer.getBoundingClientRect() : rects; 
                                                                                                                                                         
      // Calculate position relative to page container, accounting for scale                                   
      const x = (rects.left - pageRect.left) / scale;                                                           
      const y = (rects.top - pageRect.top) / scale;                                                             
      const width = rects.width / scale;                                                                        
      const height = rects.height / scale;                                                                      
      
      newHighlights.push({                                                                                     
        page: pageNum,                                                                                         
        x:x,                                                                                                     
        y:y,                                                                                                     
        width:width,                                                                                                 
        height:height,                                                                                                
        id: `highlight-${Date.now()}-${Math.random()}`,
        text: range.toString(),
        class:class_                                                         
      });      
    
    const hlight = newHighlights[newHighlights.length - 1];
    const pageDiv = window.document.getElementById(`index-${hlight.page}`);
    const btnz = window.document.getElementById("btnz") as HTMLElement;  
    
    btnz.style.position = "absolute";
    btnz.style.top = `${hlight.y + hlight.height + 10}px`;
    btnz.style.left = `${hlight.x}px`;

    // btnz.style.width = `${hlight.width}px`;
    // btnz.style.height = `${hlight.height}px`;
    btnz.style.zIndex="5";
    btnz.style.opacity="1";
    btnz.style.display = "block";
    // addDiv.style.pointerEvents = 'auto'; 
 
    setTimeout(()=>{
      if (newHighlights.length > 0) { 
        pageDiv?.appendChild(btnz); 
        setCurrSelection(newHighlights);                                                                                                                                                                             
      }   
    },1000);
  },[]);                                                                                                 
  
  const addComment = ()=>{
    if(commentInput.current){
      if(commentInput.current.value.length > 1){
        const comment= {
          class:currSelection[0].class,
          color: color[Math.floor(Math.random() * 7)],
          id: currSelection[0].id,
          page: currSelection[0].page,
          text: commentInput.current.value,
          x: currSelection[0].x,
          y: currSelection[0].y,
        }
        setComments(prev=>[...prev,comment])
        setHighlights(prev=>[...prev,...currSelection])
        setIsAddingComment(false)
        setCurrSelection([])
        commentInput.current.value=""
      }
    }
  }

  const goToCommentBody=(class_:string,id:string)=>{
    const ptag = window.document.getElementById(class_); 
    const id_ = window.document.getElementById(id); 
    if(ptag && id_){
      ptag.style.border = "3px solid #00ffff"
      setTimeout(()=>{
          ptag.style.border = "1px solid gray"
      },5000)
      ptag.scrollIntoView(
        {behavior:"smooth",block:"center" }
      )
      id_.scrollIntoView(
        {behavior:"instant",block:"start" }
      )
    }    
  }

  const DeleteComment=(id:string,class_:string,page:number)=>{
      highlights.forEach((hlit)=>{
        const paren =window.document.getElementById(`index-${page}`) as HTMLElement;
        const id_ = window.document.getElementById(id) as HTMLElement;
        if(id_) paren.removeChild(id_);
      })
      const newComm= comments.filter(com=> com.id != id);
      const newHlit= highlights.filter(hlit=> hlit.id != id)
      setComments(newComm)
      setHighlights(newHlit)
  }

  // Getting the Ai div
  const getAiDiv = async(mode:keywords_inf | string )=>{
    SetAiresult("")
    const AiDiv = window.document.getElementById("AiDiv") as HTMLElement;
    const curr = currSelection[0];
    const page = window.document.getElementById(mode==="None"?`index-${curr.page}`:`index-${(mode as keywords_inf).pageno}`) as HTMLElement;
    const loadingAi = window.document.getElementById("loadingAi") as HTMLElement;

    AiDiv.style.position = "absolute";
    mode === "None"? AiDiv.style.top = `${curr.y + curr.height + 15}px`:
              AiDiv.style.top = `${(mode as keywords_inf).points.y + (mode as keywords_inf).points.height + 15}px`
    
    AiDiv.style.left = `10%`;
    AiDiv.style.display= "block";
    loadingAi.style.display= "block";

    page.appendChild(AiDiv)
    if(mode==="None"){
      const  selection = document.getSelection()?.getRangeAt(0).toString();
      const req= await fetch("http://127.0.0.1:5000/rest/explain_query",{
        method:"POST", 
        headers:{
          "Accept": "*/*",
          "Content-Type":"application/json"
        },
        body:JSON.stringify({"data":selection})
      })
        const data_gotten = await req.json()
        console.log(data_gotten)
        try{
          data_gotten.forEach((element:any)=> {
            if(element.type == "text"){
              SetAiresult(`${element["text"]}`)
            }
          });
        }catch(err){   SetAiresult(`${data_gotten}`)}
    }else{
         SetAiresult((mode as keywords_inf).explanation)
    }
   
    loadingAi.style.display= "none";
  }

  // Etract text and search pdf for exact word
  const ExtractText= async(text:string)=>{ 
    if(text.length < 3){
      setSimilarSrch(false)
      setSearchResult([])
      return null;
    } 
    setSimilarSrch(true)
    
    const loadingTask = pdfjsLib.getDocument(documentKey);
    const pdf = await loadingTask.promise;
    const fullText:searchCord[] = [] 


    for (let i= 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Join text items with a space
      const pageText = textContent.items.map((item:any) =>
      {
        if(item.str != undefined){
          if(String(item.str).toLowerCase().includes(text.toLowerCase())){
            fullText.push({
              str:item.str,
              page:i,
              cordinates:{
                x: item.transform[4],
                // convert pdf bootom-left to html top-left
                y: (page.getViewport({scale}).height - item.transform[5]),
                width: item.width,
                height: item.height
              }
            })
          }
        }
      })
    };
    setSearchResult(fullText)      
  }
  

  const Explain_Keyword = async()=>{
    const loadingTask = pdfjsLib.getDocument(String(data.data.pdfUrl));
    const pdf = await loadingTask.promise;
    const pdf_send:any[] = [];
    let document_entire = "";
    SetKeywords([]);
    
    for (let i= 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
     
      // Join text items with a space
      textContent.items.forEach((item:any) =>
        {document_entire +=String(item.str) }
      )

      textContent.items.forEach((item:any) =>
      {
        pdf_send.push({
          content:String(item.str),
          pageno:i, 
          points:{
            y:(page.getViewport({scale}).height - item.transform[5]),
            x:item.transform[4],
            width: item.width,
            height:item.height
          }
        })
      })
    };

    const req = await fetch("http://127.0.0.1:5000/rest/keywords_detection",{
      method:"POST",
      headers:{
        "Aceept":"*/*",
        "Content-Type":"application/json"
      },
      body:JSON.stringify({data:[document_entire,document_entire]})
    })

    const response = await req.json();
    const data_gotten = JSON.parse(response);
    data_gotten["output"].forEach((data:{content:string,explanation:string})=>{
      pdf_send.forEach((element:any) => {
        if(String(element.content).includes(data.content)){
          element["explanation"]= data.explanation
          SetKeywords(prev=>[...prev,element])
        }
      });
    })  
    console.log(data_gotten["output"].length)
    setTimeout(async()=>{
      setKeyset(true)
    },500)
  }

  useEffect(()=>{
    window.document.querySelectorAll(".highlighted").forEach(e=>{
      const id= e.parentElement?.id;
      window.document.getElementById(`${id}`)?.removeChild(e)
    }); 
    AddSearchHighlight(searchResult)

    if(keywords.length>1){
      try{AddKeywords(keywords)}catch(err){}
  }
  },[scale,searchResult])

  useEffect(()=>{
    const handleSelectionChange = () => {
      const getBtnz= window.document.getElementById("btnz") as HTMLElement;
      const selection = document?.getSelection();   
      const parentDiv = document.getElementById("pdf-viewer"); 
      let inCon = false;    
     
      try{
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          let range = selection.getRangeAt(0).commonAncestorContainer.parentElement
          while (range !== document.body) {                                                             
              if(range == parentDiv){
                inCon=true
                break
              } 
              range = range != undefined ? range.parentElement: null                                                                             
          }                                                                                                      
          if(inCon){
              CreateHighlight();
          }                                                   
        }
        if(selection?.isCollapsed && getBtnz){
          getBtnz.style.display="none";
        }
      }catch(err){
        console.log()
      }
    }
    
    document.addEventListener('selectionchange',handleSelectionChange);
    ()=>{
      return document.removeEventListener("selectionchange",handleSelectionChange);
    }
  },[CreateHighlight])

  useEffect(()=>{
    if(highlights.length> 0 ){
      highlights.forEach((hlit)=>{
        const paren =window.document.getElementById(`index-${hlit.page}`) as HTMLElement;
        const id_ = window.document.getElementById(hlit.id) as HTMLElement;
        if(id_) paren.removeChild(id_);
      })
      highlights.forEach(hlit=>{
        const docParent = window.document.getElementById(`index-${hlit.page}`) as HTMLElement;
        const p= window.document.createElement("p");
        p.style.position = "absolute";
        p.style.top = `${hlit.y * scale}px`;
        p.style.left = `${hlit.x * scale}px`;
        p.style.width = `${hlit.width * scale}px`;
        p.style.height = `${hlit.height * scale}px`;
        p.style.backgroundColor="#00ffff";
        p.style.zIndex="5";
        p.style.opacity="0.4";
        p.id=hlit.id;
        p.onclick=()=>{goToCommentBody(hlit.class,hlit.id)}
        docParent.appendChild(p);
      })
    }
  },[highlights,scale])

  useEffect(()=>{
      if(data.data.pdfUrl != null){
          setDocumentKey(data.data.pdfUrl)
          setFile(data.data.selectedFile? data.data.selectedFile :null)
      }
  },[data.data.pdfUrl])

  const goToPage = (FormData:number) => {
    if(FormData){
      if(FormData > numPages) return;
      window.document.getElementById(`index-${FormData}`)?.scrollIntoView({
        behavior:"instant", block:"start"
      })
    }
  };

  const get_table_con = async()=>{
    const loadingCont = window.document.getElementById("loadingCont") as HTMLElement;
    const loadingTask = pdfjsLib.getDocument(documentKey);
    const pdf = await loadingTask.promise;
    const pdf_send:{content:string,pageno:number}[] = []

    loadingCont.style.display = "block"
    for (let i= 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      let text="";

      // Join text items with a space
      textContent.items.forEach((item:any) =>
      {
        text += String(item.str)
      })

      pdf_send.push(
        {content:text,pageno:i}
      )
    };

    const getrequest = await fetch(`http://127.0.0.1:5000/rest/get_table_query`,{
        method:"POST",
        headers:{
           'Accept': '*/*',
          "Content-Type":"application/json"
        },
        body:JSON.stringify({data:pdf_send})
    })
    
    const res= await getrequest.json()
    console.log(res)
    loadingCont.style.display = "none"
    res.forEach((element:any)=> {
        if(element.type == "text"){
            const data = JSON.parse(String(element.text).replaceAll("\n",""))
            console.log(data)
            SetTableCon(data)
        }
    });   
  }

  const EditCurrPdf = async()=>{
    console.log("clicked")
    const processor = unified().use(markdown).use(remarkToSlate);
    try {

      // 1. Fetch the PDF from the URL
      const response = await fetch(documentKey);
      const blob = await response.blob();

      // 2. Create a File object from the Blob
      const file = new File([blob], 'newpdf.pdf', { type: 'application/pdf' });
      console.log(file); // This is your File object
      const formData = new FormData();
      // The key 'file' must match the parameter name in your Python function
      formData.append('file', file);

      // 3. 
      const getMarkup = await fetch("http://127.0.0.1:5000/rest/convert_pdf_markup",{
        method:"POST",
        headers:{
          // "Content-Type":'application/json',
          "Accept":"*/*"
        },
        body:formData
      })
      const resp = await getMarkup.json()
      const value = processor.processSync(resp['markdown']).result;
      data.data.openEditor(JSON.stringify(value)) 
    } catch (error) {
      console.error('Error converting URL to file:', error);
    }   
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  
  return (
    <div id="pdf-viewer" className=" absolute top-0 flex flex-col h-screen bg-gray-100 w-full overflow-hidden z-8">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FontAwesomeIcon onClick={()=>{data.data.close()}} icon={faArrowLeft} />
          <div className="flex items-center gap-2">          
            {file && (
              <span className="text-sm text-gray-600 truncate max-w-50]">
                {file.name}
              </span>
            )}
          </div>

          {/* Navigation */}
          <div>
            <span onClick={()=>{get_table_con()}} title="AI table of content"><FontAwesomeIcon icon={faBookOpen} /></span>
            <span onClick={()=>{data.data.fileexplore()}} title="AI explore document"><FontAwesomeIcon className="ml-3 text-blue-600" icon={faCommentNodes} /></span>
            <span onClick={()=>{EditCurrPdf()}} title="edit document"><FontAwesomeIcon className="ml-3" icon={faEdit} /></span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* search */}
            <form action="" onSubmit={(e)=>{e.preventDefault()}}>
              <input onChange={(e)=>ExtractText(e.currentTarget.value)} className="border pl-2 focus:rounded-[10px]" type="text" placeholder="search word" name="searchwd" id="searchwd" />
            </form>

            {/* goto */}
            <form action="" className="ml-24" onSubmit = {(e)=>{e.preventDefault();goToPage(gotoInput.current? parseInt(gotoInput.current.value) : 0)}} >
                <label className="text-sm" htmlFor=""> go to </label>
                <input ref={gotoInput} className="w-10 border outline-0" defaultValue="0" type="text" name="goto" id="goto" />
                <span> / {numPages}</span>
            </form>
          </div>


          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              -
            </button>
            <span className="px-2 min-w-15 text-center">{Math.round(scale * 100)} % </span>
            <button
              onClick={zoomIn}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              +
            </button>
          </div>
          
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table of content */}
        <div className="text-sm w-60 p-2 bg-white text-blue-400">
            <div className="mt-9">
            </div>
            <span id="loadingCont" className="loader ml-3 hidden">
            </span>
            {tableCon.length > 0 &&
             <>
              <p className="text-black"> Table Of Content</p>
                {tableCon.map((con,index)=>(
                <button onClick={()=>{goToPage(con.pageno)}} key={index} className="text-left cursor-pointer"> {con.title}.......... {con.pageno} </button>
              ))}
             </>
            }
           
        </div>

        {/* PDF Viewer */}
        <div className="overflow-auto p-8 bg-white w-[70%]">
          <div
            className="flex justify-center"
          >
            <div className="relative">
              <Document
                key={documentKey || "default"}
                file={documentKey || data.data.pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="text-white text-xl"> Loading PDF... </div>
                }
                error={
                  <div className="text-red-400 text-xl"> Failed to load PDF </div>
                }             
              >  
                {/* AI DIV */}
                <div id="AiDiv" className="absolute z-20 top-80 w-120 bg-white border border-zinc-300 rounded-md p-2 hidden">         
                   <FontAwesomeIcon onClick={()=>{(window.document.getElementById("AiDiv")as HTMLElement).style.display="none";}} className="ml-[90%]" icon={faXmark}/>
                     <p id="loadingAi" className="text-sm loader"></p> 
                  <div className="w-full h-px bg-zinc-300 mt-2"></div>
                  <div className="text-sm p-3 min:h-3 h-fit max:h-40 overflow-y-auto bg-zinc-100">
                    <span id="AiResult"><ReactMarkdown>{airesult}</ReactMarkdown>
                    </span>
                  </div>
                </div>

                {/* buttons */}      
                <div id="btnz" className="w-19 h-fit border border-zinc-300 rounded-md p-1 bg-white hidden"> 
                  <span onClick={()=>{setIsAddingComment(true)}}> <FontAwesomeIcon className="text-[1rem] text-zinc-400" icon={faCommentDots} /> </span>
                  <span onClick={()=>{getAiDiv("None")}}> <FontAwesomeIcon className="text-[1rem] text-blue-400 ml-3" icon={faRobot} /> </span>
                </div>

                {Array.from(new Array(numPages), (el, index) => (
                  <div style={{position:"relative"}} className="mb-2 z-3" key={index} id={`index-${index + 1}`}>
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1} 
                      scale={scale}
                      className=" border border-zinc-200 z-1"
                      renderAnnotationLayer={true}
                      renderTextLayer={true}
                      onGetAnnotationsError={() => console.log("Annotations layer disabled")}
                    />
                  </div>
                ))}        
              </Document>
            </div>
          </div>
        </div>

        {/* Comments Sidebar */}
        <div id="CommentDiv" className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p> Comments (0) </p>
          </div>
          {/* add comment */}
          {isAddingComment &&
            <div className="m-5">
              <textarea ref={commentInput} className="w-50 h-20 p-2 border border-zinc-300 rounded-md" style={{resize:"none"}} name="" id=""></textarea>
              <div className="flex gap-3">
                    <button onClick={()=>{addComment()}}> <FontAwesomeIcon className="font-extrabold text-green-700" icon={faCheck} /> </button>
                    <button  onClick={()=>{setIsAddingComment(false)}}> <FontAwesomeIcon icon={faXmark} /> </button>
              </div>
            </div>
          }

          {/* list comment */}
          {comments.map((com)=>
            <div key={com.class} className="m-5">
              <p id={com.class} className="h-20 overflow-hidden text-[0.7rem] overflow-y-auto border border-zinc-300 p-2" >
                  {com.text}
              </p>
              <div className="flex gap-3 w-full">
                    <button onClick={()=>{DeleteComment(com.id,com.class,com.page)}} className="w-full p-1 text-center text-sm shadow-sm rounded-sm border border-zinc-300 mt-1 tracking-[1px] bg-zinc-200"> delete </button>
                    <button onClick={()=>{goToCommentBody(com.class,com.id)}} className="w-full p-1 text-center text-sm shadow-sm rounded-sm border border-zinc-300 mt-1 tracking-[1px] bg-zinc-50"> review </button>
              </div>
            </div>    
          )}
          
        </div>
      </div>
            
      {/* similar word search on pdf */}
      {similarSrch?
      <div id="AiGenconView"className={`w-150 h-full z-5 absolute top-0 right-0 border-l p-5 bg-white border-zinc-200 overflow-scroll`}>
          <div className="fixed bg-white">
             <FontAwesomeIcon  onClick={()=>{setSimilarSrch(false)}} icon={faArrowLeft} />
          </div>
            {searchResult.length>0 && searchResult.map((searchdata,i)=>
              <div key={i} className='text-sm mt-10'>
                <p className='pb-2 mt-2'> page {searchdata.page} </p>
                <p className='border p-1'> {searchdata.str} </p>
                <button onClick={()=>{goToPage(searchdata.page)}} className='bg-amber-200 cursor-pointer p-2 rounded-sm mt-1'>
                    go
                </button>
              </div>
            )}
      </div>
      :
        ""
      }     
    </div>
  );
}