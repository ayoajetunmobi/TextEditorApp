'use client'
import { useEffect, useState, useSyncExternalStore } from "react"
import Mycomponent from "./slateedit"
import { io } from 'socket.io-client';
import { SubcribeToStore } from "../useSyncstore";
import { subscribe } from "diagnostics_channel";

const URL_ =  'http://127.0.0.2:8000';
// const socket = io(URL_);
export const socket = io(URL_, { autoConnect: false });

export default function Reportspage(){
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getSnapshot,SubcribeToStore.getSnapshot);
    
    const [isConnected, setIsConnected] = useState(false);
    useEffect(()=>{
      if(subscribe.length > 0 && isConnected == false){
          connect();
      }
    },[subscribe])
    

    const connect =() => {
        // Connect manually if autoConnect was set to false
        socket.connect();
        function onConnect() {
            setIsConnected(true);
            socket.emit('joingroup',{
                username:subscribe[0][0].username,
                key:subscribe[0][0].key,
                groupname:subscribe[0][0].groupname,
                owner:subscribe[0][0].owner
            })
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        socket.on('receive_message', (data) => {
            const {username,msg,owner,points}=data;
            if(owner){
                SubcribeToStore.addmesg(data)
            }else{
                console.log(data)
                console.log(msg)
            }
                     
        });

        socket.on('youjsutjoined',(data)=>{
            const {group,owner} =data; 
            const ele= window.document.getElementById("jusconnected") as HTMLElement;
            ele.innerHTML= `<p> you just joined ${group} group owned by ${owner} </>`
            ele.style.display="block";
            setTimeout(()=>{
                 const ele= window.document.getElementById("jusconnected") as HTMLElement;
                 ele.style.display = "none";
            },20000)
        })

        socket.on('recieve_editted',(data)=>{
            const { username, groupname, msg, owner,color } = data;
            console.log(JSON.parse(msg));
            SubcribeToStore.addeditdata(data);
        })

        // Register event listeners
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // Clean up event listeners on component unmount
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }

    const getcurrentData = (data:[],check:boolean,editeddata:[])=>{
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
        <>
            <div id="jusconnected" className="flex justify-center border-[1px] rounded-[10px] p-3 hidden">
            </div>
            {isConnected ?
            <div>
                { subscribe.length > 0 && subscribe[0][0].owner == true ?
                    <div className="flex pl-5 gap-5">
                        <p> no of suggestions : <span className="font-bold"> 0 </span></p>
                        <span id="connected_users" className="font-bold p-1 bg-red-600 text-white"> reset suggestions </span>
                    </div>    
                :
                   null
                }
                <div className="flex flex-wrap">
                    <div className="p-5 lg:w-[65%]">
                        <Mycomponent sendtext={getcurrentData}/>       
                    </div> 
                </div>
            </div>
            :null
            }
        </>
    )
}