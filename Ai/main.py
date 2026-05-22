from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import socketio
from aiLogic import Build_Graph
from aiLogic import Agent_Gen, Agent_Query, Build_Keywords, Build_Chat_Graph, Build_Improve_Text
from markitdown import MarkItDown
import os
import tempfile
from fastapi.responses import FileResponse

os.environ["JAVA_HOME"] = r"C:\Program Files\Java\jdk-26.0.1"
# the library to convert from .md to .xlxs and more
import jpype
import asposecells
jpype.startJVM()
from asposecells.api import Workbook, LoadOptions, LoadFormat, SaveFormat
import aspose.words as aw


import json
import shutil

app = FastAPI()
rest_app= FastAPI()

origins = [
    "http://localhost:3000",      # React/Next.js default
    "http://127.0.0.1:3000",     # Production domain
]


rest_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # List of allowed origins
    allow_credentials=True,           # Allow cookies and authentication headers
    allow_methods="*",              # Allow all HTTP methods (GET, POST, etc.)
    allow_headers="*",              # Allow all request headers
)



sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://127.0.0.1:3000','http://localhost:3000']  # Adjust for production
)

sio_app = socketio.ASGIApp(socketio_server=sio,other_asgi_app=app, socketio_path="socket.io")


app.mount("/socket.io/", sio_app)
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.on('join-grp')
async def joingroup(sid,data):
    await sio.enter_room(sid, data["chatid"])
    print(f"{sid} joined {data["chatid"]}")
  

@sio.on('disconnect')
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.on('gen-ai-doc')
async def handle_send_message(sid, data):
    data_send = {"messages": [{"content":data["query"]}],"type":data["type"]}
    await Build_Graph(data["chatid"],data_send,sio)
    print(f"Received message: {data} from {sid}")
    # You can emit a response back to the client here
    # await sio.emit('response', {'status': 'Message Received'})


@rest_app.post("/get_table_query")
async def table_content(data:dict):
    print("content",data["data"][0]["content"])
    return_res = await Agent_Gen(data["data"]) 
    return return_res

@rest_app.post("/explain_query")
async def explain_content(data:dict):
    return_res = await Agent_Query(data["data"])
    return return_res

@rest_app.post("/keywords_detection")
async def detect_keywords(data:dict):
    return_res = await Build_Keywords(data["data"])
    return return_res
    

@rest_app.post("/get_chat_mesg")
async def get_chat_mesgs(data:dict):
    return_res = await Build_Chat_Graph(data["data"])
    return return_res

@rest_app.post("/convert_pdf_markup")  
async def get_markup_text(file: UploadFile = File(...)):
    md = MarkItDown()
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    try:
        # Convert the file using MarkItDown
        result = md.convert(temp_path)
        return {"markdown": result.markdown}
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@rest_app.post("/convert_to_down_doc")  
async def download_doc(data:dict):
    # 1. Define LoadOptions for Markdown
    load_options = LoadOptions(LoadFormat.MARKDOWN)
    load_options_docs = aw.loading.MarkdownLoadOptions()
    
    try:
        # Create a temporary file  
        if data["data"]["type"] == "html":
            with tempfile.NamedTemporaryFile(mode='w+t', encoding='utf-8', delete=False, suffix=".html") as temp_file:
                temp_file.write(data["data"]["doc"])
                temp_file_path = temp_file.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_path}")
        else:
            with tempfile.NamedTemporaryFile(mode='w+t', encoding='utf-8', delete=False, suffix=".md") as temp_file:
                temp_file.write(data["data"]["doc"])
                temp_file_path = temp_file.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_path}")
    
        # create output file
        if data["data"]["type"] == "excel":
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".xlsx") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")
        elif data["data"]["type"] == "pdf" or data["data"]["type"] == "html":
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".pdf") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")
        else:
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".docx") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")

        
        if data["data"]["type"] == "excel":
            # Load the Markdown file
            workbook = Workbook(temp_file_path,load_options)
            # Save as XLSX
            workbook.save(temp_file_output_path,SaveFormat.XLSX)
        elif data["data"]["type"] == "pdf":
            doc = aw.Document(temp_file_path, load_options_docs)
            # Save as pdf
            doc.save(temp_file_output_path,aw.SaveFormat.PDF)
        elif data["data"]["type"] == "html":
            doc = aw.Document(temp_file_path,aw.loading.HtmlLoadOptions())
            doc.save(temp_file_output_path,aw.SaveFormat.PDF)
        else:
            doc = aw.Document(temp_file_path, load_options_docs)
            # Save as docx
            doc.save(temp_file_output_path,aw.SaveFormat.DOCX)


        print("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++",temp_file_output_path)
        return FileResponse(
            path=temp_file_output_path, 
            filename="custom_name.xlsx", 
            media_type='application/xlsx'
        )
    except Exception as e:
        print(e) 
    finally:
        print("sent")
    #    if os.path.exists(temp_file_path) and os.path.exists(temp_file_output_path):
    #      os.remove(temp_file_path)
    #      os.remove(temp_file_output_path)


@rest_app.post("/improve_text")  
async def improve_text(data:dict):
    result =await Build_Improve_Text(data["data"])
    return result


app.mount("/rest", rest_app)

