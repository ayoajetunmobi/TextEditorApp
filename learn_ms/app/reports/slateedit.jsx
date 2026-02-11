"use client"
// Import React dependencies.
import { useCallback, useState, useMemo, useSyncExternalStore, useEffect } from 'react';
// Import the Slate editor factory.
// Import the Slate components and React plugin.
import { BaseEditor, NodeEntry, createEditor, Descendant,Editor,Range, Node, Transforms,Text, Element} from 'slate';
import { Slate, ReactEditor, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import Toolbar from "./toolbar";
import {SubcribeToStore} from "../useSyncstore";


export default function Mycomponent(sendtext){
    const [sender, setSender] = useState(false);
    const [readonly,setReadonly]= useState(false);
    const [dataeditted,setDataEditted] = useState([]);
    const [suggestions,setSuggestions] = useState([]);
    const [myoperations,setOperations] = useState([]);
    const toogleReadonly= ()=>{
      setReadonly(prev=> !prev)
    }
    let editor = useMemo(() => withReact(withHistory(createEditor())), []);
    const [editorKey, setEditorKey] = useState(Date.now());
    const [initialValue, setInitialvalue]= useState(
      [
        {
          type: 'paragraph',
          children: [{ text: "write here" }],
        },
      ]
    )
    const subscribe = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getSnapshot,SubcribeToStore.getSnapshot);
    const subscribe_get = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getView,SubcribeToStore.getView);
    const sub_get_changes = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getData,SubcribeToStore.getData);
    const sugges = useSyncExternalStore(SubcribeToStore.subscribe, SubcribeToStore.getData,SubcribeToStore.getData);
    
    const decorate =useCallback((operation,color) => {
      console.log(color)
      operation.forEach((ops)=>{
        if(ops.type == "remove_text" || ops.type == "insert_text" || ops.type == "set_node"){
          let path=ops.path;
          Transforms.deselect(editor);
          try{
            Transforms.setNodes(
              editor,
              { color: color},
              { at: path, match: n => Text.isText(n) }
            );
          }catch(err){
             console.log("")
          }
        }

        if(ops.type == "remove_node" || ops.type == "insert_node" || ops.type == "split_node"){
          let path=ops.path;
          Transforms.deselect(editor);
          try{
            Transforms.setNodes(
              editor,
              { color: color},
              { at: path, match: n => Text.isText(n) }
            );
          }catch(err){
            console.log("")
          }
        }
      })
    })
    
    useEffect(()=>{
      let datagotten = sub_get_changes == undefined ? [] : sub_get_changes;
      let data1=  datagotten != "" ? JSON.parse(datagotten["msg"]): [];
      let paragraphss=[]
      let data =[]

      // const paragraphs = Array.from( // get all paragraphs in text
      //   Editor.nodes(editor, {
      //     at: [], // Search the entire document
      //     match: (n) =>  Element.isElement(n) && n.type === 'paragraph', // Match paragraph elements
      //   })
      // );
      // console.log(paragraphs)
      let others="others"
      data1.forEach((ops)=>{
          ops.forEach((opsdata)=>{
              if(opsdata.type == "remove_text" || opsdata.type == "insert_text"){
                console.log(opsdata.text,"text");
                paragraphss.push(
                  <p key={Math.random()+40} className={'p-2 rounded-[10px] text-'+datagotten.color+'-600'}>
                     {opsdata.text}
                  </p>
                )
              }else if(opsdata.type == "remove_node" || opsdata.type == "insert_node"){
                paragraphss.push(
                  <p key={Math.random()+20} className={`p-2 rounded-[10px] text-${datagotten["color"]}-600`}>
                    {"node inserted or deleted"}
                  </p>
                )
              }else{
                console.log(others);
                paragraphss.push(
                  <p key={Math.random()+20} className={`p-2 rounded-[10px] text-${datagotten["color"]}-600`}>
                     {opsdata.type}
                  </p>
                ) 
              }
          })
      })
      console.log(paragraphss,"paragraphs")
      if(data1.length > 0){
        try{
          console.log(data1,"trying to add again")
            data.push(
              <div key={datagotten["id"]} id={datagotten["id"]} className="border-[1px] p-5 mb-3 rounded-[12px] overflow-x-hidden w-[350px] overflow-y-auto h-fit max-h-[300px]">
                <p>{datagotten["id"]}</p>
                <div className="mb-5 max-h-[150px] h-fit overflow-y-auto">
                    {paragraphss} 
                </div>
                <p className={`p-2 bg-${datagotten["color"]}-600`}> {datagotten.username} </p>
                <div className="flex justify-around border-[1px] p-2 rounded-[10px]">
                    <button onClick={()=>{applychanges(datagotten["id"],data1)}} className="p-2 cursor-pointer bg-green-950 text-white rounded-[10px] font-bold"> APPLY </button>
                    <button onClick={()=>{cancelchanges(datagotten["id"],data1)}} className="p-2 cursor-pointer bg-black text-white rounded-[10px] font-bold"> CANCEL </button>
                </div>
              </div>
            )
        }catch(err){
          console.log(err)
        }
      }
    
      console.log(data1,"only masters ++++++++++++++++++++++++")      
      data1.forEach((operation)=>{
          decorate(operation,datagotten["color"],true)
        }
      )
      if(data1.length>0){
          SubcribeToStore.suggestion(...data)
          setSuggestions([...SubcribeToStore.getSuggest()])
          // let data_pass= [{id:datagotten["id"],data:JSON.stringify(data1)}];
          // setDataEditted(prev=>[...prev,...data_pass])
      }
    },[sub_get_changes])

    console.log(suggestions,"outside")

    function applychanges(id,data){
      // setDataEditted(prev=>[...prev,...data])
      data.forEach((operation)=>{
        decorate(operation,"black")
         operation.forEach(ops=>{
            if(ops.type=="set_selection"){ 
              if(ops.properties != null){
                if(ops.properties.anchor && ops.properties.focus){
                    Transforms.deselect(editor)
                  try{
                       editor.apply(ops)
                  }catch(err){
                    console.log(err)
                  }
                }
              }
              if(ops.newProperties != null){
                if((ops.newProperties.anchor && ops.newProperties.focus) ){
                  Transforms.deselect(editor)
                  try{
                       editor.apply(ops)
                  }catch(err){
                    console.log(err)
                  }
                }
              }  
            }else{
                Transforms.deselect(editor)
                try{
                  editor.apply(ops)
                }catch(err){
                  console.log(err)
                }
            }
          })
      })

      let new_suggestion = SubcribeToStore.getSuggest().filter(items=> parseInt(items.key) != parseInt(id))
      SubcribeToStore.removsuggest();
      new_suggestion.forEach(e=>SubcribeToStore.suggestion(e))
      setSuggestions([...SubcribeToStore.getSuggest()])
    }

    function cancelchanges(id,data){
        data.forEach((operation)=>{decorate(operation,"black")})
        let new_suggestion = SubcribeToStore.getSuggest().filter(items=> parseInt(items.key) != parseInt(id))
        SubcribeToStore.removsuggest();
        new_suggestion.forEach(e=>SubcribeToStore.suggestion(e))
        setSuggestions([...SubcribeToStore.getSuggest()])
    }

    useEffect(()=>{
      if(subscribe.length > 0){
        if(subscribe[0][0].owner){
          setSender(true)
        }
      }
    },[subscribe])

    useEffect(()=>{
      if(subscribe_get != undefined){
        console.log(subscribe_get);
        let data_gotten = JSON.parse(subscribe_get["msg"]);
        Transforms.deselect(editor);
        setInitialvalue(data_gotten);
        setEditorKey(Date.now())
      }
    },[subscribe_get])

    function send_msg(data){
      sendtext.sendtext(data,true,[]);
      // const paragraphs = Array.from(
      //   Editor.nodes(editor, {
      //     at: [], // Search the entire document
      //     match: (n) =>  Element.isElement(n) && n.type === 'paragraph', // Match paragraph elements
      //   })
      // );
      // console.log(paragraphs)
    }

    function send_edits(){
      // const data = Array.from(Node.texts(editor));
      console.log("clicked")
      sendtext.sendtext([],false,myoperations);
      setOperations([]) 
    }

    const renderLeaf = useCallback(({ attributes, children, element, leaf }) => {
        // let style = { ...attributes.style };
        if (leaf.bold) {
           children = <strong>{children}</strong>;
        }
        if (leaf.italic) {
           children = <em>{children}</em>;
        }
        if (leaf.underline) {
           children = <u>{children}</u>;
        }
        if (leaf.fontSize) {
           children = <span style={{fontSize: leaf.fontSize}}>{children}</span>;
        } 
        if (leaf['line-through']) {
           children = <del>{children}</del>;
        } 
         if (leaf.color) {
           children = <span style={{color:leaf.color}}>{children}</span>;
        }  
         if (leaf.mark) {
           children = <mark>{children}</mark>;
        } 
        if (leaf.fontFamily) {
            children = <span style={{fontFamily:leaf.fontFamily}}>{children}</span>;
        } 
       
        // style.fontSize =leaf.fontSize
        return <span  {...attributes}>{children}</span>;
    }, []);

    return(
      <div>
        { subscribe.length > 0 && subscribe[0][0].owner == false ?
        <button onClick={()=>send_edits()} className='ml-10 p-1 rounded-[10px] text-white relative bg-green-700'> publish </button>
        : 
        null
        }
        
        {/*                                    put in onchange to get all operations const {operations}=editor; console.log(operations) */}
        <Slate key= {editorKey} editor={editor} initialValue={initialValue} onChange={newValue=>{const {operations}=editor;subscribe[0][0].owner == false?setOperations(prev=>[...prev,operations]):null; console.log(operations);send_msg(newValue)}} >
          <Toolbar readOnlyFunc={toogleReadonly} />
          <Editable
            // autoFocus={true}
            // placeholder='Write Here'
            style={{outline:'none', border:"1px solid #d1d5dc", borderTop:"0px", padding:"2em",minHeight:"500px"}}
            renderLeaf={renderLeaf} 
            // renderElement={renderElement}
            readOnly={readonly}
            // disableDefaultStyles={false}
          />
        </Slate >

        {sender?
          <div>
              <h3 className="p-4 font-bold"> SUGGESTION </h3>
              <div className="p-5">
                  {suggestions}
              </div>
          </div>
          :null
        }
      </div>
   )
}

// Define a React component renderer for our code blocks.
const CodeElement =(props)=> {
    console.log(props.props)
    console.log(props.props.attributes)
    return (
        <a {...props.props.attributes} href='google.com'>{props.props.children}</a>
    )
}

const LinkElement = ({ attributes, children, element ,props}) => {
  return (
    <a {...attributes} href={props.element.children[0].text}>
      {props.element.children[0].text}
    </a>
  );
};

const DefaultElement = (props) => {
  return <p {...props.attributes}>{props.children} </p>
}

const Imagediv = (props) => {
  return <span  contentEditable={false}>{props.children}
  <img {...props.attributes}  src={props.element.url} alt="hello" /></span>
}

const Linkx = ({ attributes, element, children }) =>{
return(
  <a onClick={(e)=>{window.open(`${element.href}`, "_blank");}} style={{color:"blue",cursor:"pointer"}} {...attributes} href={element.href}>
    {children}
  </a>
   
);
}


//inside Editable
 // renderElement={renderElement}
          //   onKeyDown={event => {
          //   if (event.key === '`' && event.ctrlKey) {
          //     console.log("yes")
          //     event.preventDefault()
          //     // Determine whether any of the currently selected blocks are code blocks.
          //     const [match] = Editor.nodes(editor, {
          //       match: n => n.type==='code',
          //     })
          //     // Toggle the block type depending on whether there's already a match.
          //     Transforms.setNodes(
          //       editor,
          //       { type: match ? 'paragraph' : 'code' },
          //       { match: n => Element.isElement(n) && Editor.isBlock(editor, n) }
          //     )
          //   }
          // }}