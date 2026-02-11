"use client"
import { useState, useSyncExternalStore } from "react";
import {SubcribeToStore} from './useSyncstore';
import Link from "next/link";

export function HOMEPAGE(){
    const [create, setCreate]= useState(false);
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getSnapshot,SubcribeToStore.getSnapshot);
    const colors = ['yellow','green','yellow','blue','red','purple','pink','orange','gray','indigo']
    function getformdata(){
        const groupname = window.document.getElementById("groupname") as HTMLFormElement;
        const key = window.document.getElementById("key") as HTMLFormElement;
        const username = window.document.getElementById("username") as HTMLFormElement;
        const link = window.document.getElementById("link") as HTMLElement;

        const query={
            groupname: groupname.value,
            key:key.value,
            username:username.value,
            owner:create,
            color:colors[Math.floor(Math.random() * 10)]
        }
        SubcribeToStore.addData(query);
        link.click()
    }

    return(
        <div>
            <div className="flex justify-center mt-10">
                <button onClick={()=>{setCreate(true)}} className="p-2 bg-black text-white rounded-[3px] m-3 cursor-pointer">create group</button>
                <button onClick={()=>{setCreate(false)}} className="p-2 bg-green-600 text-white rounded-[3px] m-3 cursor-pointer">join group</button>
            </div>

            <div className="flex justify-center">
                <div className={`mt-15 w-[300px] p-5 border-[1px] border-blue-100 rounded-[5px] ${create?"": "bg-green-100"}`}>
                    {create ? <p className="m-3 font-bold">create new project</p>:<p className="m-3 font-bold">join project</p>}
                    <label htmlFor=""> Group Name</label>
                    <input className="w-[250px] h-[30px] border-[1px] outline-0 p-3 mb-4" type="text" name="" id="groupname" placeholder="enter a group name" />
                    
                    <label htmlFor=""> Group Key</label>
                    <input className="w-[250px] h-[30px] border-[1px] outline-0 p-3 mb-4" type="text" name="" id="key" placeholder="enter group key/id" />
                    
                    <label htmlFor=""> Username</label>
                    <input className="w-[250px] h-[30px] border-[1px] outline-0 p-3 mb-4" type="text" name="" id="username" placeholder="enter your username" />
                    
                    {create ?
                        <button onClick={()=>{getformdata()}} className="p-2 bg-black text-white rounded-[5px]">
                          create
                        </button>      
                    :       
                        <button onClick={()=>{getformdata()}} className="p-2 bg-green-600 text-white rounded-[5px]">
                          join
                        </button>
                    }

                </div>
            </div>
            <Link id="link" className="hidden" href={"/reports"}></Link>
        </div>
    )
}