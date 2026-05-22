"use client"
import React, { useRef, useState } from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Transforms, Text,Element, Range,Path } from 'slate';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHighlighter, faLink, faPalette, faRotate, faTextSlash } from "@fortawesome/free-solid-svg-icons";
import { faImages } from '@fortawesome/free-regular-svg-icons/faImages';
import { HexColorPicker } from 'react-colorful';


export default function Toolbar(readOnlyFunc){
    // const [fontSizeInp, setfontSizeInp]= useState("None");
    const [color, setColor] = useState('#aabbcc'); // Initialize with a default color
    const [colorAc, setColorAc] = useState(false);
    const [linkup,setLinkup] = useState(false)
    const fontsizeinp = useRef()
    const editor = useSlate();

    //check if an area was selected
    const isMarkActive = (editor, format) => {
        const [match] = Editor.nodes(editor, {
        match: n => Text.isText(n) && n[format] === true,
        universal: true,
        });
        return !!match;
    };

    //store a value in a marker to be use with the leaf in main editor
    const toggleMark = (editor,format) => {
        const isActive = isMarkActive(editor, format);
        if (isActive) {
           Editor.removeMark(editor, format);
        } else {
           Editor.addMark(editor, format, true);
        }
        //   ReactEditor.focus(editor);
    };
    
    // does same as ismarvable
    const isFontActive = (editor,name) => {
            const [match] = Editor.nodes(editor, {
            match: n => Text.isText(n) && n[name] === true,
            universal: true,
            });
           return !!match;
    };

    //same as togglemark
    const toggleFontSize = (editor,name,fontSize) => {
            const isActive = isFontActive(editor,name);
            if (isActive) {
                Editor.removeMark(editor, name);
            } else {
                Editor.addMark(editor, name, fontSize);
            }
            // ReactEditor.focus(editor);
        };   
    /// start of inserting a url link
    const createLinkNode = (href, text) => ({
        type: "link",
        href,
        children: [{ text }]
    });
     const createAltNode = () => ({
        type: "paragraph",
        children: [{ text: ' ' }]
    });

    const returnLink = (editor,name) => {
            const [match] = Editor.nodes(editor, {
                match: n => Text.isText(n),
                universal: true,
            });
           
        // return match[0].text.toString()
           insertLink(editor, match[0].text.toString())
    };

    // const removeLink = (editor, opts = {}) => {
    //     Transforms.unwrapNodes(editor, {
    //         ...opts,
    //         match: (n) =>
    //         !Editor.isEditor(n) && Element.isElement(n) && n.type === "link"
    //     });
    // };

    // const insertLink = (editor, url) => {
    //     if (!url) return;
    //         const { selection } = editor;
    //         const link = createLinkNode(url, url.toString());
    //         const paragraph = createAltNode();
    //         // ReactEditor.focus(editor);
                
    //     if (!!selection) {
    //         const [parentNode, parentPath] = Editor.parent(
    //         editor,
    //         selection.focus?.path
    //         );

    //             // Remove the Link node if we're inserting a new link node inside of another
    //             // link.
    //         if (parentNode.type === "link") {
    //             removeLink(editor);
    //             console.log("removing")
    //         }

    //         if (editor.isVoid(parentNode)) {
    //             // Insert the new link after the void node
    //             console.log('Insert the new link after the void node')
    //             Transforms.insertNodes(editor, createParagraphNode([link]), {
    //                 at: Path.next(parentPath),
    //                 select: true
    //             });
    //         } else if (Range.isCollapsed(selection)) {
    //         // Insert the new link in our last known location
    //             console.log('Insert the new link in our last known location')
    //             // Transforms.insertNodes(editor, link, { select: true });
    //             const [linkNode] = Editor.nodes(editor, {
    //                 match: n =>
    //                 !Editor.isEditor(n) && Element.isElement(n) && n.type === 'link',
    //                 // Search the entire range of the selection
    //                 at: selection,
    //             });

                   
    //             if(!!linkNode)
    //             {
    //                 console.log("unwrap")
    //                 Transforms.unwrapNodes(editor, {
    //                     match: node => Element.isElement(node) && node.type === 'link',
    //                     split: true, // This option ensures only the selected part is unwrapped
                  
    //                 });
    //                  Transforms.insertNodes(editor, paragraph, { select: true });
                           
                
    //                 }else{ 
    //                     console.log("unwraping")
    //                     Transforms.wrapNodes(editor, link, { split: true })
    //                     Transforms.insertNodes(editor, paragraph, { select: true });
                        
    //             }       
    //             // Transforms.collapse(editor, { edge: "end" });
    //             // Transforms.insertNodes(editor, paragraph, { select: true });
    //         } else {
    //             console.log("wrap")
    //         // Wrap the currently selected range of text into a Link
    //             Transforms.wrapNodes(editor, link, { split: true });
    //             // Remove the highlight and move the cursor to the end of the highlight
    //             Transforms.collapse(editor, { edge: "end" });
    //         }
    //     } else {
    //         // Insert the new link node at the bottom of the Editor when selection
    //         // is falsey
    //         console.log("is falset")
    //         Transforms.insertNodes(editor, createParagraphNode([link]));
    //     }
    // };

    const EditorImage=(editor)=>{
        const {isInline,isVoid}=editor;
        editor.isInline=element=>{
            return element.type==='image' ? true : isInline(element);
        }
        editor.isVoid=element=>{
            return element.type==='image' ? true : isVoid(element);
        }
        //  editor.isInline=element=>{
        //     return element.type==='link' ? true : isInline(element);
        // }
        // editor.isVoid=element=>{
        //     return element.type==='link' ? true : isVoid(element);
        // }
        return editor;
    }
    /// add image
    // const createImage= (url) => ({
    //     type: "image",
    //     url,
    //     children: [{ text:'' }],
    //     isInline:true,
    //     isVoid:true
    // });

    // 
    // const callparagraph=()=>{
    //     Transforms.insertNodes(editor,createAltNode(),{split:true})
    // }
 
    // const insertImage=(editor, url) => {
    //     if (!url) return;
    //     const { selection } = editor;
    //     const image = createImage(url);
    //     if (!!selection) {
    //         const [parentNode, parentPath] = Editor.parent(
    //         editor,
    //         selection.focus?.path
    //     );
    //     // || Node.string(parentNode).length
    //     if (editor.isVoid(parentNode)) {
    //        // Insert the new image node after the void node or a node with content
    //         // Transforms.insertNodes(editor, image, {
    //         //     at: Path.next(parentPath),
    //         //     select: true
    //         // });
    //         Transforms.insertNodes(editor, image, { select: true },);
    //         ReactEditor.focus(editor,{retries:12})
    //         console.log("report")
    //     } else {
    //         // If the node is empty, replace it instead
    //         // Transforms.removeNodes(editor, { at: parentPath });
    //         callparagraph()
    //         Transforms.insertNodes(editor, image);
    //         ReactEditor.focus(editor)
    //         console.log("reports")
             
    //     }
    // } else {
    //     // Insert the new image node at the bottom of the Editor when selection
    //     // is falsey
    //    Transforms.insertNodes(editor, image);
    //     ReactEditor.focus(editor,{retries:12})
    //    console.log("reportss")
       
    // }

    // }

    const InsertAiText = async()=>{
        const selectedText = Editor.string(editor, editor.selection);
        const loader = window.document.getElementById("slateLoader");
        loader.style.display= "block"
        if(selectedText != null){
            console.log(selectedText)
            const req = await fetch("http://127.0.0.1:5000/rest/improve_text",{
                method:"POST",
                headers:{
                    "Accept":"*/*",
                    "Content-Type": "application/json" 
                },
                body:JSON.stringify({data:String(selectedText)})
            })
            const response = await req.json()

            const newNode = {
                type: 'paragraph', // Or 'code-block', etc.
                children: [{ text: String(response["messages"][0]["content"]) }],
            };

            Transforms.insertNodes(editor, newNode, {
                at: editor.selection,
                mode: 'highest', // Ensures it replaces the block
            });
        }
        loader.style.display= "none"
    }

    
    const insertImg = (editor, url) => {
        const text = { text: '' }
        const image = { type: 'image', url, children: [text] }
        const paragraph = {
            type: 'paragraph',
            children: [{ text: '' }],
        }
        Transforms.insertNodes(editor, paragraph)
        Transforms.insertNodes(editor, image)
       
    }
    return(
        <>            
          <div className='flex gap-4 justify-center border flex-wrap border-gray-300 border-b p-3 bg-gray-50 w-full'>
                <form onSubmit={(e)=>{e.preventDefault(); toggleFontSize(editor,'fontFamily',fontsizeinp.current.value); }} className='w-40'>
                    <select onChange={(e)=>{toggleFontSize(editor,'fontFamily',e.target.value); fontsizeinp.current.value=e.target.value }} className='text-sm bg-gray-200 p-1 rounded-[3px] absolute'>
                        {fontFamily.map((e,i)=><option key={i} value={e}>{e}</option>)}
                    </select>
                </form>
                <button title='undo' style={{cursor:"pointer"}}
                    onClick={()=>{editor.undo()}}
                >
                    ↩
                </button>
                <button title='redo'
                style={{cursor:"pointer"}}
                onClick={()=>{editor.redo()}}
                >
                    ↪
                </button>
                <button title='color'> 
                    <FontAwesomeIcon onClick={()=>{setColorAc(prev=>!prev)}} icon={faPalette} className='text-yellow-500 cursor-pointer'  />
                {colorAc?
                <>
                   <div className='absolute z-2' onClick={(e)=>{toggleFontSize(editor,'color',color);setColorAc(false)}} >
                      <HexColorPicker color={color} onChange={setColor} />
                   <p>{color}</p>
                   </div>
                </>
                :
                null
            }
                </button>
            
                <button
                onMouseDown={event => {
                event.preventDefault();
                toggleMark(editor, 'bold');
                }}
                title='bold'
                style={{fontWeight: isMarkActive(editor,'bold') ? 'bold' : 'normal',cursor:"pointer",padding:"0px 6px 0px 6px", background:"#e5e7eb",borderRadius:"3px" }}
                >
                    B
                </button>

            <button
            onMouseDown={event => {
            event.preventDefault();
            toggleMark(editor, 'italic');
            }}
            title='italics'
            style={{ fontStyle:"italic", fontWeight: isMarkActive(editor, 'italic') ? 'bold' : 'normal',cursor:"pointer" }}
            >
            I
            </button>

            <button
            onMouseDown={event => {
            event.preventDefault();
            toggleMark(editor, 'underline');
            }}
            title='underline'
            style={{ textDecoration: isMarkActive(editor, 'underline') ? 'underline' : 'none',cursor:"pointer" }}
            >
                U
            </button>
            <button  title='line through' 
            >
             <FontAwesomeIcon icon={faTextSlash}
                  onMouseDown={event => {
                  event.preventDefault();
                  toggleMark(editor, 'line-through');
             }}
            
             style={{ background: isMarkActive(editor, 'line-through') ? '#e5e7eb' : 'none',cursor:"pointer" }}
           
             />
            </button>
            <button  title='highlight'>
                <FontAwesomeIcon icon={faHighlighter}
                  onMouseDown={event => {
                  event.preventDefault();
                  toggleMark(editor, 'mark');
             }}
            
             style={{ background: isMarkActive(editor, 'mark') ? '#e5e7eb' : 'none',cursor:"pointer" }}
            />
            </button>
                <form action="" onSubmit={(e)=>{e.preventDefault(); toggleFontSize(editor,'fontSize',fontsizeinp.current.value+"px"); }} className='max-w-8 w-7'>
                    <select onChange={(e)=>{toggleFontSize(editor,'fontSize',e.target.value+"px"); fontsizeinp.current.value=e.target.value }} className='text-sm bg-gray-200 p-1 rounded-[3px] absolute' name="fontsize" id="fontsize">
                        {fontsize.map((e,i)=><option key={i} value={e}>{e}px</option>)}
                    </select>
                    <input  ref={fontsizeinp} min={1} className='absolute border  w-9  bg-white z-1' type="number"  name="fontsizeTxt" id="fontsizetxt" />
                </form>

             <button className='pl-8' title='url link'>
                <FontAwesomeIcon icon={faLink}
                    onMouseDown={event => {
                        console.log("yes")
                        event.preventDefault()
                        returnLink(EditorImage(editor),'link')
                        setLinkup(prev=>!prev)
                    }}
                />
            </button>
            <button title='images'>
                <FontAwesomeIcon onClick={(e)=>{document.getElementById("image").click()}} icon={faImages}
                className='cursor-pointer'
                 /> 
            </button>
            <button title='switch read/write' onClick={()=>{readOnlyFunc.readOnlyFunc()}}>
                <FontAwesomeIcon icon={faRotate}
                className='cursor-pointer'
            />    
            </button>

            <button onClick={()=>{InsertAiText()}} title='Artificial intelligence' className='cursor-pointer'>    
                <span className='text-blue-700 font-bold'>A</span><span>i</span>
            </button>
            <div id='slateLoader' className='loader hidden'></div>
          </div>
          
          <form  action="">
                <input onChange={(e)=>{
                    const file=e.target.files[0];
                     if (file) {
                    const objectURL = URL.createObjectURL(file);
                    console.log('Temporary URL for preview:', objectURL);
                      insertImg(EditorImage(editor),objectURL)
                    }
                  }} className='bg-amber-500 hidden' type="file" accept="image/*" name="image" id="image" />
         </form> 
        </>
    )
}

const fontsize=[
0,
2,
4,
6,
8,
10,
12,
14,
16,
18,
20,
22,
24,
26,
28,
30,
32,
34,
36,
38,
40,
42,
44,
46,
48,
50,
52,
54,
56,
58,
60,
62,
64,
66,
68,
70,
72,
74
]

const fontFamily=[
    "sans-serif",
    "fantasy",
    "monospace",
    "Arial",
    "Courier New",
    "Courier",
    "Trebuchet MS",
    "Times New Roman",
    "Gill Sans MT",
]

        
    // // Toggle the font-size mark on the selection
    //       let matched=false
    //       const isFontSizeActive = (editor, fontSize) => {
    //             const [match] = Editor.nodes(editor, {
    //                 match: n => Text.isText(n) && n.fontSize === fontSize,
    //                 mode: 'all', 
    //             });
    //             matched= !!match
    //        }
    //         const isActive = isFontSizeActive(editor, fontSize);
                
    //         Transforms.setNodes(
    //             editor,
    //             { fontSize: isActive ? null : fontSize },
    //             { match: n => Text.isText(n), split: true},
    //         );                
    //         ReactEditor.focus(editor);