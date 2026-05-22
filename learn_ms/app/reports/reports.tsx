'use client'
import { use, useEffect, useState, useSyncExternalStore } from "react";
import { io } from 'socket.io-client';
import { SubcribeToStore } from "../useSyncstore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import dynamic from 'next/dynamic';


const Mycomponent = dynamic(
  () => import('../reports/slateedit'),
  { ssr: false }
)
const URL_ =  'http://127.0.0.1:8000';

// const socket = io(URL_);
export default function Reportspage(data:{data:{close:()=>void, init:File | undefined | string }}){
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getSnapshot,SubcribeToStore.getSnapshot);
    const [socket] = useState(() => io(URL_, { autoConnect: true }));
  
    useEffect(() => {
        if (subscribe.length === 0) return;

        function onConnect() {
            socket.emit('joingroup', {
                username: subscribe[0][0].username,
                key: subscribe[0][0].key,
                groupname: subscribe[0][0].groupname,
                owner: subscribe[0][0].owner
            });
            console.log("connected-again");
        }

        function onDisconnect() {
            console.log("disconnected-again");
        }

        function onReceiveMessage(data:any) {
            const { username, msg, owner, points } = data;
            if (owner) {
                SubcribeToStore.addmesg(data);
            } else {
                console.log(data);
                console.log(msg);
            }
        }

        function onYouJustJoined(data:any) {
            const { group, owner } = data;
        }

        function onReceiveEdited(data:any) {
            const { username, groupname, msg, owner, color } = data;
            console.log(JSON.parse(msg));
            SubcribeToStore.addeditdata(data);
        }

        // Register event listeners
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('receive_message', onReceiveMessage);
        socket.on('youjsutjoined', onYouJustJoined);
        socket.on('recieve_editted', onReceiveEdited);

        // Connect if not already connected
        if (!socket.connected) {
            socket.connect();
            console.log("is-just-connected")
        }

        // Clean up event listeners on component unmount
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('receive_message', onReceiveMessage);
            socket.off('youjsutjoined', onYouJustJoined);
            socket.off('recieve_editted', onReceiveEdited);
        };
    }, [subscribe, socket]);

    const getcurrentData = (data:[], check:boolean, editeddata:[])=>{
        if(check){
            socket.emit('sendGroupMessage', {
                username:subscribe[0][0].username,
                groupname:subscribe[0][0].groupname,
                msg:JSON.stringify(data),
                owner:subscribe[0][0].owner,
            });
        }else{
            socket.emit("sendchanges_masters",{
                username:subscribe[0][0].username,
                groupname:subscribe[0][0].groupname,
                msg:JSON.stringify(editeddata),
                owner:subscribe[0][0].owner,
                color:subscribe[0][0].color,
            })
        }
    }

    // Empty dependency array ensures this runs once
    return(
        <div id="editorCon" className="absolute z-11 bg-white top-0 w-full h-full">
            <div className="m-5 mt-2" onClick={()=>{data.data.close()}}> <FontAwesomeIcon icon={faArrowLeft} /></div>
            {subscribe[0]?
            <>
                <div id="jusconnected" className="ml-7 w-45">
                    <p> user : {subscribe[0][0].username} </p>
                    <p> group : {subscribe[0][0].groupname} </p>
                </div>
                <div className="z-11 relative w-full top-0 bg-white h-fit">            
                    <div className="flex justify-center flex-wrap">
                        <div className="p-5 lg:w-[80%]">
                            <Mycomponent sendtext={getcurrentData} init={data.data.init} />       
                        </div> 
                    </div>
                </div>   
            </>
            :
            <> please log in </>
            }
            
        </div>
    )
}