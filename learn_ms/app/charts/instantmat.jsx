export function InstantMet({data}){
    return(
        <>
            {data.map((metric)=>
                Object.entries(metric).map(([keys,values])=>{
                    return <div key={keys} className="border border-zinc-200 w-50 h-25 p-5 rounded-md">
                        <p className="text-center text-sm"> {keys} </p>
                        <p className="text-center font-bold text-10"> {values} </p>
                    </div>
                })
            )}
        </>  
    )
}