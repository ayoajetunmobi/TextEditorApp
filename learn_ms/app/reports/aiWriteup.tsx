"use client"
import { faArrowLeft, faArrowRightToBracket, faArrowsToDot, faArrowTrendUp, faBookOpen, faCircleDot, faCodeCompare, faCommentDots, faDroplet, faHandDots, faListDots, faPersonDotsFromLine, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown'
import {pdfjs} from "react-pdf";
import * as pdfjsLib from 'pdfjs-dist';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {SubcribeToStore} from "../useSyncstore";
import remarkGfm from 'remark-gfm';

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const exportType=[
    {type:"word",src:"logo2.png"},{type:"excel",src:"logo1.png"},{type:"pdf",src:"pdf.png"},
]

export default function WriteUp (data:{genData:{ type:string; query:string; file:string | null, aidoc:string }, close:()=>void, editAIdoc:()=>void}){
    const [chat, setChat] = useState<boolean>(false);
    const [compare, setCompare] = useState<boolean>(false);
    const [aiChatMesages, setAiChatMesages] = useState<{role:string; content:string}[]>([]);
    const [aiDocuToken,setAiDocuToken]= useState<string>("");
    const chatInput = useRef<HTMLInputElement>(null);
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, 
              SubcribeToStore.getSnapshot, SubcribeToStore.getSnapshot);

    const setMode = (id:string)=>{
        const typeCon = window.document.getElementById(id) as HTMLElement; 
        if(typeCon.style.display == "none"){
            typeCon.style.display= "block";
        }else{
            typeCon.style.display="none"
        }     
    }

    const close=()=>{
        const AiGenCon = window.document.getElementById("AiGenCon") as HTMLElement;
        const mainCon = window.document.getElementById("mainCon") as HTMLElement;
        mainCon.style.display="none"
        AiGenCon.style.transition='1s ease';
        AiGenCon.style.right = "-37.5em"
        data.close()
    }

    const open=()=>{
        const AiGenCon = window.document.getElementById("AiGenCon") as HTMLElement;
        const mainCon = window.document.getElementById("mainCon") as HTMLElement;
        if(AiGenCon && mainCon){
            mainCon.style.display="block"
            AiGenCon.style.transition='1s ease';
            AiGenCon.style.right = "0px"
            mainCon.style.display="block"
        }
    }

    if(data.genData.type === "AiDocGen"){
        setChat(false)
        open()
        data.genData.type='';
    }

    const ExploreDocument = async()=> {
        setChat(true)
        open()
        const loadingTask = pdfjsLib.getDocument(data.genData.file != null? data.genData.file:"");
        const pdf = await loadingTask.promise;
        const text:string[] = []

        for (let i= 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Join text items with a space
            const pageText = textContent.items.map((item:any) =>
            {
               text.push(item.str)
            })
        };
        setAiDocuToken(JSON.stringify(text))
    }

    if(data.genData.type === "AiFilEx"){
        ExploreDocument()
        data.genData.type='';
    } 

    const SendChatMessage = async()=>{
        const input = chatInput.current?.value;
        const chatid = subscribe[0][0].chatid
        const loaderspin = window.document.getElementById("loaderspin") as HTMLElement;
        loaderspin.style.display="block"

        if (chatInput !== null){
            const chat={role:"user",content:chatInput.current?chatInput.current.value:"none"}
            setAiChatMesages(prev=>[...prev,chat])  
        }

        //call function to get Aichat
        const request = await fetch('http://127.0.0.1:5000/rest/get_chat_mesg',{
            method : "POST",
            headers:{
                "Accept": "*/*",
                "Content-Type":"application/json"
            },
            body:JSON.stringify({data:[chatid,aiDocuToken,input]})
        })
        const response = await request.json();
        loaderspin.style.display="none"
        setAiChatMesages(prev=>[...prev,{"role":"assistant","content":String(response["messages"][0]["content"]).replaceAll("<br>","")}])
        if(chatInput.current){
            chatInput.current.value = ""
        }
       setTimeout(()=>{
         loaderspin.scrollIntoView({
            behavior:"smooth",block:"end"
        })
       },1000)
    }

    const downloadDoc = async(type:string,doc:string)=>{
        const req= await fetch("http://127.0.0.1:5000/rest/convert_to_down_doc",{
            method:"POST",
            headers:{
                "Accept":"*/*",
                "Content-Type":"application/json"
            },
            body: JSON.stringify({data:{type:type,doc:doc}})
        })
        const response = await req.blob();
        console.log(response)
        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = type=='excel'? "filename.xlsx" : type== "pdf"? "filename.pdf": "filename.docx"; // Suggest a name for the file
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    useEffect(()=>{ 
        setAiChatMesages([]) 
    },[data.genData.file])

    return(
        <div id='mainCon' className='w-150 h-full absolute top-0 right-0 overflow-hidden hidden z-10'>
            {!chat?
            <div id='AiGenCon' className="w-150 h-full absolute top-0 -right-[37em] border-l p-5 bg-white border-zinc-200">
                <FontAwesomeIcon onClick={()=>{close()}} icon={faArrowLeft}></FontAwesomeIcon>
                <div className="flex justify-around mt-4 border p-2">
                    <p onClick={()=>data.editAIdoc()} className='cursor-pointer w-14'><FontAwesomeIcon icon={faBookOpen}/><span className='text-sm'> edit </span> </p>
                    <p  onClick={(e)=>{downloadDoc("word",data.genData.aidoc)}} className='cursor-pointer'><FontAwesomeIcon icon={faArrowTrendUp}/><span className='text-sm'> export</span> </p>
                </div>
                <div className='mt-5 p-3 h-120 overflow-y-auto'>
                    {   data.genData.aidoc.length > 5 ?
                        <div className='overflow-auto'>
                             <ReactMarkdown remarkPlugins={[remarkGfm]} >{data.genData.aidoc}</ReactMarkdown>
                        </div>
                        :
                        <p className='loader'>
                        </p>
                    }   
                </div>
            </div>
            :
            <>
            { !compare? 
                <div id='AiGenCon' className="w-150 h-full absolute top-0 right-0 border-l p-5 bg-white border-zinc-200">
                    <FontAwesomeIcon onClick={()=>{close()}} icon={faArrowLeft}></FontAwesomeIcon>

                    <div className="fixed flex justify-center z-10 bg-white mt-4 p-3">
                        <button className='cursor-pointer w-60 border ' onClick={()=>setCompare(true)}><FontAwesomeIcon icon={faCodeCompare}/><span className='text-sm'> Comparison </span> </button>
                    </div>
                    
                    {/* // Chat Section */}
                    <div className='relative top-14 h-110 overflow-y-auto p-5'>
                        {aiChatMesages.map((data,index)=>{
                            if(data.role == "user"){
                                return <div key={index} className='flex justify-end mb-2'>
                                            <div className='border' style={{borderRadius:"15px 0px 15px 15px"}}>
                                                <div className='text-sm m-2'><ReactMarkdown remarkPlugins={[remarkGfm]} >{data.content}</ReactMarkdown></div>
                                            </div>       
                                        </div>
                            }else{
                                return  <div key={index} className='flex justify-start mb-2'>
                                    <div id={`typeCon${index}`} className="absolute z-10 border p-2 ml-10 bg-white rounded-[10px] overflow-hidden hidden">
                                        {exportType.map((type,i)=>
                                            <div onClick={()=>{downloadDoc(type.type,data.content)}} key={i} className='flex cursor-pointer'>
                                                <Image style={{width:"14px", height:"14px"}}
                                                    src={`/${type.src}`}
                                                    alt=''
                                                    height={5}
                                                    width={20}>
                                                </Image>
                                                <p  key={i} className="m-2 -mt-1 text-sm"> {type.type} </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className='bg-blue-100' style={{borderRadius:"0px 15px 15px 15px" }}>
                                        <button onClick={()=>{setMode(`typeCon${index}`)}} className='font-extrabold m-1'> ... </button>
                                        <div className='text-sm m-2'>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} >{data.content}</ReactMarkdown>
                                        </div>
                                    </div>      
                                </div>
                            }
                        })}
                        <p id='loaderspin' className='loader hidden'></p>
                    </div>

                    <form onSubmit={(e)=>{e.preventDefault();SendChatMessage()}} className="relative flex border border-zinc-300 mt-13 rounded-2xl p-4 h-fit" action="">
                        <input ref={chatInput} className="w-full outline-0" id="" placeholder="Summarize document" style={{ resize: "none"}} />
                        <FontAwesomeIcon onClick={()=>{SendChatMessage()}} icon={faArrowRightToBracket} className="text-2xl cursor-pointer mt-1" />
                    </form>
                </div>
                :
                <div className="w-150 h-full absolute top-0 right-0 border-l p-5 bg-white border-zinc-200">
                    <FontAwesomeIcon onClick={()=>setCompare(false)} icon={faXmark}></FontAwesomeIcon>
                    <div className='text-sm'>
                        <p className='pb-2 mt-2'> page 1 </p>
                        <p className='border p-1'> content in comparison </p>
                        <p className='bg-blue-100 p-1'> + addition made to the content </p>
                        <div className='flex gap-3 mt-2'>
                                <button className='bg-amber-200 p-2 rounded-sm'>
                                    insert
                                </button>
                                <button className='bg-zinc-200 p-2 rounded-sm'>
                                    ignore
                                </button>
                        </div>
                    </div>
                    <div className='text-sm'>
                        <p className='pb-2 mt-2'> page 1 </p>
                        <p className='border p-1'> content in comparison </p>
                        <p className='bg-green-100 p-1'> - deletion made to the content </p>
                        <div className='flex gap-3 mt-2'>
                                <button className='bg-amber-200 p-2 rounded-sm'>
                                    insert
                                </button>
                                <button className='bg-zinc-200 p-2 rounded-sm'>
                                    ignore
                                </button>
                        </div>
                    </div>
                </div>
            }
            </>
            
            }
        </div>
    )
}